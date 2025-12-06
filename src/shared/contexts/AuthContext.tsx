/**
 * Authentication Context
 * 
 * Provides authentication state and methods to the entire app.
 * Uses Gun.js SEA for decentralized identity management.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type {
    AuthContextValue,
    AuthState,
    UserProfile,
    SignupRequest,
    LoginRequest,
    RecoveryRequest,
    UserKeypair,
} from '@/adapters/identity/types';
import { getGunSeaAdapter } from '@/adapters/identity/gunSea';
import { createVerificationToken, buildMagicLinkUrl, verifyMagicLink as verifyToken } from '@/adapters/identity/magicLink';

// Initial auth state
const initialState: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
};

// Create context with default values
const AuthContext = createContext<AuthContextValue>({
    ...initialState,
    signUp: async () => { throw new Error('AuthProvider not mounted'); },
    signIn: async () => { throw new Error('AuthProvider not mounted'); },
    signOut: async () => { throw new Error('AuthProvider not mounted'); },
    sendVerificationEmail: async () => { throw new Error('AuthProvider not mounted'); },
    verifyMagicLink: async () => { throw new Error('AuthProvider not mounted'); },
    recoverWithSeedPhrase: async () => { throw new Error('AuthProvider not mounted'); },
    updateProfile: async () => { throw new Error('AuthProvider not mounted'); },
    getSeedPhrase: async () => { throw new Error('AuthProvider not mounted'); },
});

// Storage key for user keypair
const KEYPAIR_STORAGE_KEY = 'iamt-user-keypair';
// Storage key for lightweight session snapshot
const SESSION_STORAGE_KEY = 'iamt-session';

/**
 * Get stored keypair from localStorage
 */
function getStoredKeypair(): UserKeypair | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

/**
 * Store keypair in localStorage
 */
function storeKeypair(keypair: UserKeypair): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(KEYPAIR_STORAGE_KEY, JSON.stringify(keypair));
    }
}

/**
 * Clear keypair from localStorage
 */
function clearKeypair(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(KEYPAIR_STORAGE_KEY);
    }
}

function getStoredSession(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored) as UserProfile;
    } catch {
        return null;
    }
}

/**
 * AuthProvider component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    // Hydrate immediately from localStorage to avoid redirect flicker on reload
    const [state, setState] = useState<AuthState>(() => {
        const storedSession = getStoredSession();
        if (storedSession) {
            return {
                user: storedSession,
                isAuthenticated: true,
                isLoading: true, // remain true until adapter confirms
                error: null,
            };
        }
        return initialState;
    });
    const [keypair, setKeypair] = useState<UserKeypair | null>(() => getStoredKeypair());

    // Initialize auth state on mount
    useEffect(() => {
        const initAuth = async () => {
            try {
                const adapter = getGunSeaAdapter();
                const storedKeypair = getStoredKeypair();
                const storedSession = getStoredSession();

                // Optimistically hydrate from stored session to avoid redirect flicker
                if (storedSession) {
                    setState({
                        user: storedSession,
                        isAuthenticated: true,
                        isLoading: true, // keep loading until adapter is ready
                        error: null,
                    });
                    setKeypair(storedKeypair);
                }

                // Wait for adapter to initialize and expose a user; retry a few times
                let user = adapter.getCurrentUser();
                for (let i = 0; i < 10 && !user; i++) {
                    await new Promise(r => setTimeout(r, 150));
                    user = adapter.getCurrentUser();
                }

                if (user && adapter.isAuthenticated()) {
                    setState({
                        user,
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                    });
                    setKeypair(storedKeypair);
                } else if (storedSession) {
                    // Fall back to stored session if adapter never surfaced a user yet
                    setState({
                        user: storedSession,
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                    });
                    setKeypair(storedKeypair);
                } else {
                    setState({
                        ...initialState,
                        isLoading: false,
                    });
                }
            } catch (error) {
                console.error('[Auth] Init error:', error);
                setState({
                    ...initialState,
                    isLoading: false,
                    error: 'Failed to initialize authentication',
                });
            }
        };

        initAuth();
    }, []);

    /**
     * Sign up a new user
     */
    const signUp = useCallback(async (request: SignupRequest): Promise<{ user: UserProfile; seedPhrase: string }> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const adapter = getGunSeaAdapter();
            const result = await adapter.createUser(request);

            // Store keypair locally
            storeKeypair(result.keypair);
            setKeypair(result.keypair);

            setState(prev => ({
                ...prev,
                user: result.user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            }));

            return { user: result.user, seedPhrase: result.seedPhrase };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Sign up failed';
            setState(prev => ({ ...prev, isLoading: false, error: message }));
            throw error;
        }
    }, []);

    /**
     * Sign in an existing user
     */
    const signIn = useCallback(async (request: LoginRequest): Promise<UserProfile> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const adapter = getGunSeaAdapter();
            const user = await adapter.authenticate(request);

            setState(prev => ({
                ...prev,
                user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            }));

            return user;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Sign in failed';
            setState(prev => ({ ...prev, isLoading: false, error: message }));
            throw error;
        }
    }, []);

    /**
     * Sign out the current user
     */
    const signOut = useCallback(async (): Promise<void> => {
        try {
            const adapter = getGunSeaAdapter();
            await adapter.signOut();
            clearKeypair();
            setKeypair(null);

            setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                error: null,
            });
        } catch (error) {
            console.error('[Auth] Sign out error:', error);
        }
    }, []);

    /**
     * Send verification email with magic link
     */
    const sendVerificationEmail = useCallback(async (): Promise<void> => {
        if (!state.user) {
            throw new Error('Not authenticated');
        }

        try {
            const token = await createVerificationToken(state.user.email);
            const magicLink = buildMagicLinkUrl(token.token, 'verification');

            // Send email via API
            const response = await fetch('/api/send-magic-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: state.user.email,
                    magicLink,
                    type: 'verification',
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to send verification email');
            }
        } catch (error) {
            console.error('[Auth] Send verification email error:', error);
            throw error;
        }
    }, [state.user]);

    /**
     * Verify a magic link token
     */
    const verifyMagicLink = useCallback(async (token: string): Promise<boolean> => {
        try {
            const result = await verifyToken(token);
            
            if (result.success && result.type === 'verification') {
                // Update local state
                setState(prev => {
                    if (prev.user) {
                        return {
                            ...prev,
                            user: { ...prev.user, emailVerified: true },
                        };
                    }
                    return prev;
                });
            }

            return result.success;
        } catch (error) {
            console.error('[Auth] Verify magic link error:', error);
            return false;
        }
    }, []);

    /**
     * Recover account with seed phrase
     */
    const recoverWithSeedPhrase = useCallback(async (request: RecoveryRequest): Promise<UserProfile> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const adapter = getGunSeaAdapter();
            const user = await adapter.recoverWithSeedPhrase(request);

            setState({
                user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
            });

            return user;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Recovery failed';
            setState(prev => ({ ...prev, isLoading: false, error: message }));
            throw error;
        }
    }, []);

    /**
     * Update user profile
     */
    const updateProfile = useCallback(async (updates: Partial<Pick<UserProfile, 'displayName' | 'avatarId'>>): Promise<void> => {
        if (!state.user) {
            throw new Error('Not authenticated');
        }

        try {
            const adapter = getGunSeaAdapter();
            await adapter.updateProfile(updates);

            setState(prev => ({
                ...prev,
                user: prev.user ? { ...prev.user, ...updates } : null,
            }));
        } catch (error) {
            console.error('[Auth] Update profile error:', error);
            throw error;
        }
    }, [state.user]);

    /**
     * Get seed phrase (requires password)
     */
    const getSeedPhrase = useCallback(async (password: string): Promise<string> => {
        if (!keypair) {
            throw new Error('No keypair found');
        }

        try {
            const adapter = getGunSeaAdapter();
            return await adapter.getSeedPhrase(password, keypair);
        } catch (error) {
            console.error('[Auth] Get seed phrase error:', error);
            throw error;
        }
    }, [keypair]);

    const value: AuthContextValue = {
        ...state,
        signUp,
        signIn,
        signOut,
        sendVerificationEmail,
        verifyMagicLink,
        recoverWithSeedPhrase,
        updateProfile,
        getSeedPhrase,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth(): AuthContextValue {
    const auth = useAuth();

    useEffect(() => {
        if (!auth.isLoading && !auth.isAuthenticated) {
            window.location.href = '/auth/login';
        }
    }, [auth.isLoading, auth.isAuthenticated]);

    return auth;
}
