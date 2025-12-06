/**
 * Sign Up Page
 * 
 * User registration with email/password and 12-word seed phrase backup.
 * Uses decentralized identity via Gun.js SEA.
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/contexts/AuthContext';

export default function SignupPage() {
    const router = useRouter();
    const { signUp, isLoading, error } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [seedPhrase, setSeedPhrase] = useState<string | null>(null);
    const [seedPhraseCopied, setSeedPhraseCopied] = useState(false);
    const [seedPhraseSaved, setSeedPhraseSaved] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        // Validation
        if (!email || !password) {
            setFormError('Email and password are required');
            return;
        }

        if (password.length < 8) {
            setFormError('Password must be at least 8 characters');
            return;
        }

        if (password !== confirmPassword) {
            setFormError('Passwords do not match');
            return;
        }

        try {
            const result = await signUp({ email, password, displayName: displayName || undefined });
            setSeedPhrase(result.seedPhrase);
        } catch (err) {
            // Error is handled by auth context
            console.error('Signup error:', err);
        }
    };

    const handleCopySeedPhrase = async () => {
        if (seedPhrase) {
            await navigator.clipboard.writeText(seedPhrase);
            setSeedPhraseCopied(true);
            setTimeout(() => setSeedPhraseCopied(false), 2000);
        }
    };

    const handleContinue = () => {
        router.push('/profile');
        // Hard fallback in case client-side routing is blocked
        setTimeout(() => {
            if (window.location.pathname !== '/profile') {
                window.location.href = '/profile';
            }
        }, 300);
    };

    // Show seed phrase backup screen after successful signup
    if (seedPhrase) {
        return (
            <main className="min-h-screen flex items-center justify-center p-4">
                <div className="glass-card p-8 max-w-lg w-full">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Save Your Recovery Phrase</h1>
                        <p className="text-gray-400 text-sm">
                            Write down these 12 words in order and store them safely.
                            This is the <strong className="text-white">only way</strong> to recover your account if you forget your password.
                        </p>
                    </div>

                    <div className="bg-surface/50 border border-white/10 rounded-lg p-4 mb-6">
                        <div className="grid grid-cols-3 gap-3">
                            {seedPhrase.split(' ').map((word, index) => (
                                <div key={index} className="flex items-center gap-2 bg-background/50 rounded px-3 py-2">
                                    <span className="text-gray-500 text-xs font-mono">{index + 1}.</span>
                                    <span className="text-white font-mono text-sm">{word}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleCopySeedPhrase}
                        className="w-full btn-secondary mb-4 flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {seedPhraseCopied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>

                    <div className="flex items-start gap-3 mb-6">
                        <input
                            type="checkbox"
                            id="saved"
                            checked={seedPhraseSaved}
                            onChange={(e) => setSeedPhraseSaved(e.target.checked)}
                            className="mt-1 w-4 h-4 rounded border-white/20 bg-surface text-accent focus:ring-accent"
                        />
                        <label htmlFor="saved" className="text-sm text-gray-300">
                            I have saved my recovery phrase in a secure location. I understand that if I lose it, I will not be able to recover my account.
                        </label>
                    </div>

                    <button
                        type="button"
                        onClick={handleContinue}
                        disabled={!seedPhraseSaved}
                        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Continue to Profile
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="glass-card p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold gradient-text mb-2">Create Account</h1>
                    <p className="text-gray-400">Join the decentralized web</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input w-full"
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div>
                        <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-1">
                            Display Name <span className="text-gray-500">(optional)</span>
                        </label>
                        <input
                            type="text"
                            id="displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="input w-full"
                            placeholder="How should we call you?"
                            autoComplete="name"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input w-full"
                            placeholder="At least 8 characters"
                            required
                            minLength={8}
                            autoComplete="new-password"
                        />
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="input w-full"
                            placeholder="Repeat your password"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    {(formError || error) && (
                        <div className="bg-error/10 border border-error/20 rounded-lg p-3 text-error text-sm">
                            {formError || error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Creating Account...
                            </span>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-gray-400 text-sm">
                        Already have an account?{' '}
                        <Link href="/auth/login" className="text-accent hover:underline">
                            Sign In
                        </Link>
                    </p>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>Your identity is secured with decentralized encryption</span>
                    </div>
                </div>
            </div>
        </main>
    );
}
