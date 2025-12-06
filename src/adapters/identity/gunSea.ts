/**
 * Gun.js SEA Identity Adapter
 * 
 * Provides decentralized identity management using Gun.js SEA
 * (Security, Encryption, Authorization) with did:key format
 * and BIP39 seed phrase backup.
 */

'use client';

import * as bip39 from 'bip39';
import bs58 from 'bs58';
import type { UserProfile, UserKeypair, SignupRequest, LoginRequest, RecoveryRequest } from './types';

// Gun.js relay configuration
const PRIMARY_RELAY = process.env.NEXT_PUBLIC_GUN_RELAY || 'http://localhost:8765/gun';

// Working public Gun.js relays for production
// Note: Vercel serverless functions don't support WebSockets, so we must use external relays
// These are the more reliable relays confirmed working 2024-2025
const PUBLIC_RELAYS: string[] = [
    'https://gun-manhattan.herokuapp.com/gun',
    'https://gun-matrix.herokuapp.com/gun',
];

// Determine if running in production
const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');

// In production, ALWAYS use public relays (Vercel serverless can't handle WebSockets)
const RELAYS = isProduction
    ? PUBLIC_RELAYS
    : [PRIMARY_RELAY];

const APP_NAMESPACE = 'iamt-identity-v1';

// Session storage key
const SESSION_KEY = 'iamt-session';

/**
 * Convert a public key to did:key format
 * Uses base58-btc multibase encoding with ed25519-pub multicodec
 */
export function publicKeyToDid(publicKey: string): string {
    try {
        // Gun.js SEA uses base64-encoded keys
        // Prefix with ed25519-pub multicodec (0xed01)
        const keyBytes = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0));
        const multicodecPrefix = new Uint8Array([0xed, 0x01]);
        const prefixedKey = new Uint8Array(multicodecPrefix.length + keyBytes.length);
        prefixedKey.set(multicodecPrefix);
        prefixedKey.set(keyBytes, multicodecPrefix.length);

        // Base58-btc encode with 'z' multibase prefix
        const encoded = bs58.encode(prefixedKey);
        return `did:key:z${encoded}`;
    } catch {
        // Fallback: hash the public key
        const hash = btoa(publicKey).slice(0, 32);
        return `did:key:z${hash}`;
    }
}

/**
 * Generate a 12-word BIP39 seed phrase
 */
export function generateSeedPhrase(): string {
    return bip39.generateMnemonic(128); // 128 bits = 12 words
}

/**
 * Validate a BIP39 seed phrase
 */
export function validateSeedPhrase(phrase: string): boolean {
    return bip39.validateMnemonic(phrase);
}

/**
 * Derive a deterministic password from seed phrase for Gun.js SEA
 */
async function seedPhraseToPassword(seedPhrase: string): Promise<string> {
    const seed = await bip39.mnemonicToSeed(seedPhrase);
    // Use first 32 bytes as password material
    const passwordBytes = seed.slice(0, 32);
    return btoa(String.fromCharCode(...passwordBytes));
}

/**
 * Encrypt data with password using Web Crypto API
 */
async function encryptWithPassword(data: string, password: string): Promise<{ encrypted: string; salt: string; iv: string }> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(data)
    );

    return {
        encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        salt: btoa(String.fromCharCode(...salt)),
        iv: btoa(String.fromCharCode(...iv))
    };
}

/**
 * Decrypt data with password
 */
async function decryptWithPassword(encrypted: string, password: string, salt: string, iv: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes },
        key,
        encryptedBytes
    );

    return decoder.decode(decrypted);
}

/**
 * Gun.js SEA Identity Adapter
 */
export class GunSeaAdapter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private gun: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private user: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private SEA: any = null;
    private initialized = false;
    private currentProfile: UserProfile | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            this.initGun();
        }
    }

    /**
     * Initialize Gun.js with SEA
     */
    private async initGun() {
        if (this.initialized) return;
        this.initialized = true;

        const Gun = (await import('gun')).default;
        await import('gun/sea');

        console.log('[GunSEA] Connecting to relays:', RELAYS);
        this.gun = Gun({
            peers: RELAYS,
            localStorage: true,
        });

        this.user = this.gun.user();
        this.SEA = (Gun as { SEA?: unknown }).SEA;

        console.log('[GunSEA] Initialized with relays:', RELAYS);

        // Try to restore session
        this.restoreSession();
    }

    /**
     * Ensure Gun.js is initialized
     */
    private async ensureGun() {
        if (!this.initialized && typeof window !== 'undefined') {
            await this.initGun();
        }
        // Wait for Gun to be ready
        while (!this.gun || !this.SEA) {
            await new Promise(r => setTimeout(r, 50));
        }
    }

    /**
     * Create a new user account
     */
    async createUser(request: SignupRequest): Promise<{ user: UserProfile; seedPhrase: string; keypair: UserKeypair }> {
        await this.ensureGun();

        // Generate seed phrase
        const seedPhrase = generateSeedPhrase();

        // Create Gun.js user with email as alias
        return new Promise((resolve, reject) => {
            this.user.create(request.email, request.password, async (ack: { err?: string; pub?: string }) => {
                if (ack.err) {
                    reject(new Error(ack.err));
                    return;
                }

                try {
                    // Authenticate immediately after creation
                    await this.authenticateInternal(request.email, request.password);

                    const publicKey = this.user.is?.pub || '';
                    const did = publicKeyToDid(publicKey);

                    // Encrypt seed phrase with password
                    const encryptedSeed = await encryptWithPassword(seedPhrase, request.password);

                    // Create user profile
                    const profile: UserProfile = {
                        did,
                        publicKey,
                        email: request.email,
                        displayName: request.displayName,
                        createdAt: Date.now(),
                        emailVerified: false,
                    };

                    // Store profile in user's graph
                    await this.saveProfile(profile);

                    // Create keypair record
                    const keypair: UserKeypair = {
                        did,
                        publicKey,
                        encryptedPrivateKey: '', // Gun.js manages this internally
                        passwordSalt: encryptedSeed.salt,
                        privateKeyIv: encryptedSeed.iv,
                        encryptedSeedPhrase: encryptedSeed.encrypted,
                        createdAt: Date.now(),
                    };

                    // Save session
                    this.saveSession(profile);
                    this.currentProfile = profile;

                    resolve({ user: profile, seedPhrase, keypair });
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Internal authentication helper
     */
    private authenticateInternal(email: string, password: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.user.auth(email, password, (ack: { err?: string }) => {
                if (ack.err) {
                    reject(new Error(ack.err));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Authenticate an existing user
     */
    async authenticate(request: LoginRequest): Promise<UserProfile> {
        await this.ensureGun();

        await this.authenticateInternal(request.email, request.password);

        // Load user profile
        const profile = await this.loadProfile();
        if (!profile) {
            throw new Error('Profile not found');
        }

        // Update last login
        profile.lastLoginAt = Date.now();
        await this.saveProfile(profile);

        // Save session
        this.saveSession(profile);
        this.currentProfile = profile;

        return profile;
    }

    /**
     * Recover account with seed phrase
     */
    async recoverWithSeedPhrase(request: RecoveryRequest): Promise<UserProfile> {
        await this.ensureGun();

        if (!validateSeedPhrase(request.seedPhrase)) {
            throw new Error('Invalid seed phrase');
        }

        // Derive original password from seed phrase
        const derivedPassword = await seedPhraseToPassword(request.seedPhrase);

        // Try to find and authenticate user
        // This is a simplified recovery - in production you'd need
        // to store a recovery record mapping seed hash to email
        throw new Error('Recovery requires email. Please use email-based recovery.');
    }

    /**
     * Sign out the current user
     */
    async signOut(): Promise<void> {
        await this.ensureGun();
        this.user.leave();
        this.currentProfile = null;
        this.clearSession();
    }

    /**
     * Get the current authenticated user
     */
    getCurrentUser(): UserProfile | null {
        return this.currentProfile;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.user?.is?.pub !== undefined;
    }

    /**
     * Save user profile to Gun.js user graph
     */
    private async saveProfile(profile: UserProfile): Promise<void> {
        return new Promise((resolve, reject) => {
            this.user
                .get(APP_NAMESPACE)
                .get('profile')
                .put(profile, (ack: { err?: string }) => {
                    if (ack.err) {
                        reject(new Error(ack.err));
                    } else {
                        resolve();
                    }
                });
        });
    }

    /**
     * Load user profile from Gun.js user graph
     */
    private async loadProfile(): Promise<UserProfile | null> {
        return new Promise((resolve) => {
            this.user
                .get(APP_NAMESPACE)
                .get('profile')
                .once((data: UserProfile | null) => {
                    resolve(data);
                });
        });
    }

    /**
     * Update user profile
     */
    async updateProfile(updates: Partial<Pick<UserProfile, 'displayName' | 'avatarId'>>): Promise<void> {
        if (!this.currentProfile) {
            throw new Error('Not authenticated');
        }

        this.currentProfile = { ...this.currentProfile, ...updates };
        await this.saveProfile(this.currentProfile);
        this.saveSession(this.currentProfile);
    }

    /**
     * Mark email as verified
     */
    async markEmailVerified(): Promise<void> {
        if (!this.currentProfile) {
            throw new Error('Not authenticated');
        }

        this.currentProfile.emailVerified = true;
        await this.saveProfile(this.currentProfile);
        this.saveSession(this.currentProfile);
    }

    /**
     * Get seed phrase (requires password verification)
     */
    async getSeedPhrase(password: string, keypair: UserKeypair): Promise<string> {
        try {
            return await decryptWithPassword(
                keypair.encryptedSeedPhrase,
                password,
                keypair.passwordSalt,
                keypair.privateKeyIv
            );
        } catch {
            throw new Error('Invalid password');
        }
    }

    /**
     * Get public key of current user
     */
    getPublicKey(): string | null {
        return this.user?.is?.pub || null;
    }

    /**
     * Get DID of current user
     */
    getDid(): string | null {
        const pubKey = this.getPublicKey();
        return pubKey ? publicKeyToDid(pubKey) : null;
    }

    /**
     * Save session to localStorage
     */
    private saveSession(profile: UserProfile): void {
        if (typeof window !== 'undefined') {
            localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
        }
    }

    /**
     * Clear session from localStorage
     */
    private clearSession(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(SESSION_KEY);
        }
    }

    /**
     * Restore session from localStorage
     */
    private restoreSession(): void {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(SESSION_KEY);
            if (saved) {
                try {
                    this.currentProfile = JSON.parse(saved);
                } catch {
                    this.clearSession();
                }
            }
        }
    }

    /**
     * Access Gun.js instance for advanced operations
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getGun(): any {
        return this.gun;
    }

    /**
     * Access SEA for cryptographic operations
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSEA(): any {
        return this.SEA;
    }
}

// Singleton instance
let gunSeaInstance: GunSeaAdapter | null = null;

export function getGunSeaAdapter(): GunSeaAdapter {
    if (!gunSeaInstance) {
        gunSeaInstance = new GunSeaAdapter();
    }
    return gunSeaInstance;
}
