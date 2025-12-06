/**
 * Identity Adapter Types
 * 
 * Defines interfaces for decentralized identity management
 * using Gun.js SEA (Security, Encryption, Authorization).
 */

/**
 * User profile stored in Gun.js user graph
 */
export interface UserProfile {
    /** Decentralized Identifier (did:key:z...) */
    did: string;
    /** Gun.js public key (raw) */
    publicKey: string;
    /** User's email address */
    email: string;
    /** Optional display name */
    displayName?: string;
    /** Avatar file ID (stored via WebTorrent) */
    avatarId?: string;
    /** Account creation timestamp */
    createdAt: number;
    /** Whether email is verified via magic link */
    emailVerified: boolean;
    /** Last login timestamp */
    lastLoginAt?: number;
}

/**
 * Authentication state for React context
 */
export interface AuthState {
    /** Current user profile or null if not authenticated */
    user: UserProfile | null;
    /** Whether user is authenticated */
    isAuthenticated: boolean;
    /** Whether auth state is loading */
    isLoading: boolean;
    /** Error message if auth failed */
    error: string | null;
}

/**
 * Magic link token stored in Gun.js
 */
export interface MagicLinkToken {
    /** Unique token ID */
    token: string;
    /** User's email address */
    email: string;
    /** Token creation timestamp */
    createdAt: number;
    /** Token expiration timestamp (15 minutes from creation) */
    expiresAt: number;
    /** Whether token has been used */
    used: boolean;
    /** Token type: verification or recovery */
    type: 'verification' | 'recovery';
}

/**
 * User keypair for storage in local keyring
 */
export interface UserKeypair {
    /** User's DID */
    did: string;
    /** Gun.js public key */
    publicKey: string;
    /** Encrypted private key (encrypted with user's password) */
    encryptedPrivateKey: string;
    /** Salt for password-based key derivation */
    passwordSalt: string;
    /** IV for private key encryption */
    privateKeyIv: string;
    /** 12-word BIP39 seed phrase (encrypted) */
    encryptedSeedPhrase: string;
    /** Creation timestamp */
    createdAt: number;
}

/**
 * Signup request data
 */
export interface SignupRequest {
    email: string;
    password: string;
    displayName?: string;
}

/**
 * Login request data
 */
export interface LoginRequest {
    email: string;
    password: string;
}

/**
 * Seed phrase recovery request
 */
export interface RecoveryRequest {
    seedPhrase: string;
    newPassword: string;
}

/**
 * Auth context methods
 */
export interface AuthContextValue extends AuthState {
    /** Sign up a new user */
    signUp: (request: SignupRequest) => Promise<{ user: UserProfile; seedPhrase: string }>;
    /** Sign in an existing user */
    signIn: (request: LoginRequest) => Promise<UserProfile>;
    /** Sign out the current user */
    signOut: () => Promise<void>;
    /** Send email verification magic link */
    sendVerificationEmail: () => Promise<void>;
    /** Verify magic link token */
    verifyMagicLink: (token: string) => Promise<boolean>;
    /** Recover account with seed phrase */
    recoverWithSeedPhrase: (request: RecoveryRequest) => Promise<UserProfile>;
    /** Update user profile */
    updateProfile: (updates: Partial<Pick<UserProfile, 'displayName' | 'avatarId'>>) => Promise<void>;
    /** Get seed phrase (requires password) */
    getSeedPhrase: (password: string) => Promise<string>;
    /** Gun.js user instance for personal graph operations (cross-device sync) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gunUser: any;
}
