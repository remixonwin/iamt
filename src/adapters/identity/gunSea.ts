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
import { gunConnection } from '@/adapters/database/gunConnection';
import { logger, LogCategory } from '@/shared/utils/logger';

type RawUserProfile = UserProfile & { _?: unknown };

function sanitizeUserProfile(profile: RawUserProfile): UserProfile {
    const { _, ...rest } = profile;
    const sanitized = { ...rest } as Record<string, unknown>;

    for (const key of Object.keys(sanitized)) {
        if (sanitized[key] === undefined) {
            delete sanitized[key];
        }
    }

    return sanitized as unknown as UserProfile;
}

// App namespace for identity data
const APP_NAMESPACE = 'iamt-identity-v1';

// Session storage key
const SESSION_KEY = 'iamt-session';

/**
 * Safely decode base64 string with validation
 */
function safeAtob(base64: string, context: string = 'data'): Uint8Array {
    if (!base64 || typeof base64 !== 'string') {
        throw new Error(`Invalid ${context}: empty or not a string`);
    }
    // Remove any whitespace and validate base64 format
    const cleaned = base64.trim();
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
        throw new Error(`Invalid ${context}: contains invalid base64 characters`);
    }
    try {
        return Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
    } catch (e) {
        throw new Error(`Failed to decode ${context}: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
}

/**
 * Convert a public key to did:key format
 * Uses base58-btc multibase encoding with ed25519-pub multicodec
 */
export function publicKeyToDid(publicKey: string): string {
    try {
        // Validate and decode the base64 public key
        const keyBytes = safeAtob(publicKey, 'publicKey');
        // Prefix with ed25519-pub multicodec (0xed01)
        const multicodecPrefix = new Uint8Array([0xed, 0x01]);
        const prefixedKey = new Uint8Array(multicodecPrefix.length + keyBytes.length);
        prefixedKey.set(multicodecPrefix);
        prefixedKey.set(keyBytes, multicodecPrefix.length);

        // Base58-btc encode with 'z' multibase prefix
        const encoded = bs58.encode(prefixedKey);
        return `did:key:z${encoded}`;
    } catch (err) {
        // Fallback: hash the public key
        logger.warn(LogCategory.GUN_SEA, 'publicKeyToDid fallback due to error:', err);
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

    // Validate and decode base64 inputs with safe function
    const saltBytes = safeAtob(salt, 'salt');
    const ivBytes = safeAtob(iv, 'iv');
    const encryptedBytes = safeAtob(encrypted, 'encrypted data');

    // Create fresh ArrayBuffers for Web Crypto API (avoids SharedArrayBuffer type issues)
    const saltArray = new Uint8Array(saltBytes.length);
    saltArray.set(saltBytes);
    const ivArray = new Uint8Array(ivBytes.length);
    ivArray.set(ivBytes);
    const encryptedArray = new Uint8Array(encryptedBytes.length);
    encryptedArray.set(encryptedBytes);

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: saltArray, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivArray },
        key,
        encryptedArray
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
    private hasAttemptedCorruptionRecovery = false;
    private readyPromise: Promise<void> | null = null;
    private resolveReady: (() => void) | null = null;

    // E2E test mode flag - check at runtime
    private get isE2EMode(): boolean {
        return process.env.NEXT_PUBLIC_E2E_MODE === 'true';
    }

    constructor() {
        if (typeof window !== 'undefined') {
            // In E2E mode, resolve immediately without Gun.js initialization
            if (this.isE2EMode) {
                logger.info(LogCategory.GUN_SEA, 'E2E mode - skipping Gun.js SEA initialization');
                this.readyPromise = Promise.resolve();
                this.initialized = true;
            } else {
                this.readyPromise = new Promise((resolve) => {
                    this.resolveReady = resolve;
                });
                this.initGun();
            }
        } else {
            this.readyPromise = Promise.resolve();
        }
    }

    /**
     * Wait for adapter to be fully initialized (with timeout)
     */
    async waitForReady(timeoutMs: number = 5000): Promise<void> {
        if (this.readyPromise) {
            const timeout = new Promise<void>((_, reject) =>
                setTimeout(() => reject(new Error('GunSEA init timeout')), timeoutMs)
            );
            try {
                await Promise.race([this.readyPromise, timeout]);
            } catch {
                // Timeout or error - continue anyway
                logger.warn(LogCategory.GUN_SEA, 'waitForReady timeout or error, continuing');
            }
        }
    }

    /**
     * Initialize Gun.js with SEA using shared connection
     */
    private async initGun() {
        if (this.initialized) return;
        this.initialized = true;

        try {
            // Use shared connection manager
            this.gun = await gunConnection.getGun();
            this.user = await gunConnection.getUser();
            this.SEA = await gunConnection.getSEA();

            logger.info(LogCategory.GUN_SEA, 'Initialized via shared connection', { relays: gunConnection.getRelays().length });

            // Try to restore session
            this.restoreSession();
        } catch (e) {
            logger.error(LogCategory.GUN_SEA, 'Failed to init', e);
        } finally {
            if (this.resolveReady) {
                this.resolveReady();
            }
        }
    }

    /**
     * Ensure Gun.js is initialized (with timeout to prevent infinite wait)
     */
    private async ensureGun() {
        // In E2E mode, we don't need actual Gun.js
        if (this.isE2EMode) {
            return;
        }
        if (!this.initialized && typeof window !== 'undefined') {
            await this.initGun();
        }
        // Wait for Gun to be ready with timeout
        const startTime = Date.now();
        const timeout = 10000; // 10 second timeout
        while (!this.gun || !this.SEA) {
            if (Date.now() - startTime > timeout) {
                logger.error(LogCategory.GUN_SEA, 'Gun.js initialization timeout after 10 seconds');
                throw new Error('Connection timeout. Please check your network and try again.');
            }
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

        // E2E mode: create mock user without Gun.js
        if (this.isE2EMode) {
            const mockPubKey = btoa(request.email + Date.now()).slice(0, 32);
            const did = publicKeyToDid(mockPubKey);

            const profile: UserProfile = {
                did,
                publicKey: mockPubKey,
                email: request.email,
                displayName: request.displayName,
                createdAt: Date.now(),
                emailVerified: false,
            };

            const keypair: UserKeypair = {
                did,
                publicKey: mockPubKey,
                encryptedPrivateKey: '',
                passwordSalt: 'e2e-salt',
                privateKeyIv: 'e2e-iv',
                encryptedSeedPhrase: 'e2e-encrypted',
                createdAt: Date.now(),
            };

            this.saveSession(profile);
            this.currentProfile = profile;

            return { user: profile, seedPhrase, keypair };
        }

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
                    const storedProfile = await this.saveProfile(profile);

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
                    this.saveSession(storedProfile);
                    this.currentProfile = storedProfile;

                    resolve({ user: storedProfile, seedPhrase, keypair });
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Internal authentication helper
     */
    private async authenticateInternal(email: string, password: string): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            this.user.auth(email, password, (ack: { err?: string }) => {
                if (ack.err) {
                    if (ack.err.includes('Invalid data') || ack.err.includes('Number at')) {
                        this.handleCorruptedDataError(email, password).then(resolve).catch(reject);
                    } else {
                        reject(new Error(ack.err));
                    }
                } else {
                    resolve();
                }
            });
        });
    }

    private async handleCorruptedDataError(email: string, password: string): Promise<void> {
        console.error('[GunSEA] Data corruption detected during auth. Attempting automatic recovery.');

        if (this.hasAttemptedCorruptionRecovery) {
            throw new Error('Local identity data appears corrupted. Please clear your browser storage for this site and try again.');
        }

        this.hasAttemptedCorruptionRecovery = true;
        this.clearLocalGunData();

        await new Promise<void>((resolve, reject) => {
            this.user.auth(email, password, (ack: { err?: string }) => {
                if (ack.err) {
                    console.error('[GunSEA] Auth failed after corruption cleanup:', ack.err);
                    reject(new Error('We had to reset your local identity data. Please sign in again.'));
                } else {
                    console.info('[GunSEA] Auth succeeded after automatic corruption cleanup.');
                    resolve();
                }
            });
        });
    }

    private clearLocalGunData(): void {
        if (typeof window === 'undefined') return;

        try {
            console.warn('[GunSEA] Clearing local Gun identity data for recovery.');

            this.clearSession();

            try {
                if (this.gun && this.gun._ && this.gun._.opt && this.gun._.opt.file) {
                    const fileKey = this.gun._.opt.file as string;
                    localStorage.removeItem(fileKey);
                }
            } catch {
                // Best-effort; ignore if structure not as expected
            }

            try {
                const gunKeys = Object.keys(localStorage).filter(key => key.toLowerCase().includes('gun'));
                for (const key of gunKeys) {
                    localStorage.removeItem(key);
                }
            } catch {
                // Ignore
            }
        } catch {
            // Ignore errors while attempting cleanup; user can still manually clear storage
        }
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
        const storedProfile = await this.saveProfile(profile);

        // Save session
        this.saveSession(storedProfile);
        this.currentProfile = storedProfile;

        return storedProfile;
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
     * Clear local user data on sign out (session, backups, keys, and all Gun data)
     * This is a public method that can be called from UI for user-initiated reset
     */
    clearLocalUserData(): void {
        if (typeof window === 'undefined') return;

        try {
            logger.info(LogCategory.GUN_SEA, 'Clearing all local identity data');

            // Clear session
            this.clearSession();
            this.currentProfile = null;

            // Clear Gun local data
            this.clearLocalGunData();

            // Clear files backup to prevent cross-session access
            localStorage.removeItem('iamt-files-backup');

            // Clear all Gun-related localStorage keys more thoroughly
            try {
                const keysToRemove = Object.keys(localStorage).filter(key => 
                    key.toLowerCase().includes('gun') || 
                    key.includes('iamt-') ||
                    key.includes('SEA')
                );
                for (const key of keysToRemove) {
                    localStorage.removeItem(key);
                }
            } catch {
                // Ignore
            }

            // Reset corruption recovery flag
            this.hasAttemptedCorruptionRecovery = false;

            logger.info(LogCategory.GUN_SEA, 'Local data cleared successfully');
        } catch (error) {
            logger.error(LogCategory.GUN_SEA, 'Error clearing local user data:', error);
        }
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
        // trust local session if available
        return this.currentProfile !== null || (this.user?.is?.pub !== undefined);
    }

    /**
     * Save user profile to Gun.js user graph
     */
    private async saveProfile(profile: UserProfile): Promise<UserProfile> {
        const cleanProfile = sanitizeUserProfile(profile);

        await new Promise<void>((resolve, reject) => {
            this.user
                .get(APP_NAMESPACE)
                .get('profile')
                .put(cleanProfile, (ack: { err?: string }) => {
                    if (ack.err) {
                        reject(new Error(ack.err));
                    } else {
                        resolve();
                    }
                });
        });

        return cleanProfile;
    }

    /**
     * Load user profile from Gun.js user graph
     */
    private async loadProfile(): Promise<UserProfile | null> {
        return new Promise((resolve) => {
            this.user
                .get(APP_NAMESPACE)
                .get('profile')
                .once((data: RawUserProfile | null) => {
                    try {
                        resolve(data ? sanitizeUserProfile(data) : null);
                    } catch (err) {
                        console.error('[GunSEA] Error loading profile:', err);
                        resolve(null);
                    }
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
        const storedProfile = await this.saveProfile(this.currentProfile);
        this.currentProfile = storedProfile;
        this.saveSession(storedProfile);
    }

    /**
     * Mark email as verified
     */
    async markEmailVerified(): Promise<void> {
        if (!this.currentProfile) {
            throw new Error('Not authenticated');
        }

        this.currentProfile.emailVerified = true;
        const storedProfile = await this.saveProfile(this.currentProfile);
        this.currentProfile = storedProfile;
        this.saveSession(storedProfile);
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
            const cleanProfile = sanitizeUserProfile(profile);
            localStorage.setItem(SESSION_KEY, JSON.stringify(cleanProfile));
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
                    const parsed = JSON.parse(saved) as RawUserProfile;
                    // Validate required fields to detect corrupted data
                    if (!parsed || !parsed.did || !parsed.email || typeof parsed.createdAt !== 'number') {
                        logger.warn(LogCategory.GUN_SEA, 'Invalid session data detected, clearing');
                        this.clearSession();
                        return;
                    }
                    this.currentProfile = sanitizeUserProfile(parsed);
                } catch (err) {
                    logger.warn(LogCategory.GUN_SEA, 'Failed to parse session, clearing:', err);
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
     * Get the authenticated Gun user instance for personal graph operations
     * This is required for cross-device file sync via user.get('files')
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getUser(): any {
        return this.user;
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
