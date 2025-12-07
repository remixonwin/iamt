/**
 * Login Page
 * 
 * User authentication with email/password and recovery options.
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/contexts/AuthContext';
import { validateSeedPhrase } from '@/adapters/identity/gunSea';

type LoginMode = 'password' | 'seed-phrase';

export default function LoginPage() {
    const { signIn, recoverWithSeedPhrase, resetLocalData, isLoading, error } = useAuth();
    
    const [mode, setMode] = useState<LoginMode>('password');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [seedPhrase, setSeedPhrase] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!email || !password) {
            setFormError('Email and password are required');
            return;
        }

        try {
            await signIn({ email, password });
            window.location.href = '/profile';
        } catch (err) {
            console.error('Login error:', err);
        }
    };

    const handleSeedPhraseRecovery = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        const normalizedPhrase = seedPhrase.trim().toLowerCase();

        if (!validateSeedPhrase(normalizedPhrase)) {
            setFormError('Invalid seed phrase. Please enter all 12 words.');
            return;
        }

        if (!newPassword || newPassword.length < 8) {
            setFormError('New password must be at least 8 characters');
            return;
        }

        try {
            await recoverWithSeedPhrase({ seedPhrase: normalizedPhrase, newPassword });
            window.location.href = '/profile';
        } catch (err) {
            console.error('Recovery error:', err);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setFormError('Please enter your email address first');
            return;
        }

        try {
            const response = await fetch('/api/send-magic-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    type: 'recovery',
                }),
            });

            if (response.ok) {
                setFormError(null);
                alert('Recovery link sent to your email!');
            } else {
                setFormError('Failed to send recovery email');
            }
        } catch (err) {
            console.error('Forgot password error:', err);
            setFormError('Failed to send recovery email');
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="glass-card p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold gradient-text mb-2">Welcome Back</h1>
                    <p className="text-gray-400">Sign in to your account</p>
                </div>

                {/* Mode Tabs */}
                <div className="flex mb-6 bg-surface/50 rounded-lg p-1">
                    <button
                        onClick={() => setMode('password')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                            mode === 'password'
                                ? 'bg-accent text-white'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Password
                    </button>
                    <button
                        onClick={() => setMode('seed-phrase')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                            mode === 'seed-phrase'
                                ? 'bg-accent text-white'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        Seed Phrase
                    </button>
                </div>

                {mode === 'password' ? (
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
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
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input w-full"
                                placeholder="Your password"
                                required
                                autoComplete="current-password"
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
                                    Signing In...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="w-full text-sm text-gray-400 hover:text-accent transition-colors"
                        >
                            Forgot your password?
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSeedPhraseRecovery} className="space-y-4">
                        <div>
                            <label htmlFor="seedPhrase" className="block text-sm font-medium text-gray-300 mb-1">
                                Recovery Seed Phrase
                            </label>
                            <textarea
                                id="seedPhrase"
                                value={seedPhrase}
                                onChange={(e) => setSeedPhrase(e.target.value)}
                                className="input w-full h-24 resize-none"
                                placeholder="Enter your 12-word recovery phrase..."
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Enter all 12 words separated by spaces
                            </p>
                        </div>

                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-1">
                                New Password
                            </label>
                            <input
                                type="password"
                                id="newPassword"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="input w-full"
                                placeholder="Set a new password"
                                required
                                minLength={8}
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
                                    Recovering...
                                </span>
                            ) : (
                                'Recover Account'
                            )}
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center">
                    <p className="text-gray-400 text-sm">
                        Don&apos;t have an account?{' '}
                        <Link href="/auth/signup" className="text-accent hover:underline">
                            Create Account
                        </Link>
                    </p>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Secured with end-to-end encryption</span>
                    </div>
                </div>

                {/* Troubleshooting Section */}
                <div className="mt-4 pt-4 border-t border-white/10">
                    <details className="text-xs text-gray-500">
                        <summary className="cursor-pointer hover:text-gray-400 transition-colors">
                            Having trouble signing in?
                        </summary>
                        <div className="mt-2 space-y-2 pl-2">
                            <p>If you&apos;re experiencing persistent login issues, you can reset your local data:</p>
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm('This will clear all local identity data. You will need to sign in again. Continue?')) {
                                        resetLocalData();
                                        window.location.reload();
                                    }
                                }}
                                className="text-warning hover:text-warning/80 underline"
                            >
                                Reset Local Data
                            </button>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
}
