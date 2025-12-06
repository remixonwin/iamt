/**
 * Auth Form Component
 * 
 * Reusable email/password form for login and signup pages.
 */

'use client';

import React, { useState } from 'react';

interface AuthFormProps {
    mode: 'login' | 'signup';
    onSubmit: (data: { email: string; password: string; displayName?: string }) => Promise<void>;
    isLoading?: boolean;
    error?: string | null;
}

export function AuthForm({ mode, onSubmit, isLoading = false, error }: AuthFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        // Validation
        if (!email || !password) {
            setFormError('Email and password are required');
            return;
        }

        if (mode === 'signup') {
            if (password.length < 8) {
                setFormError('Password must be at least 8 characters');
                return;
            }

            if (password !== confirmPassword) {
                setFormError('Passwords do not match');
                return;
            }
        }

        try {
            await onSubmit({
                email,
                password,
                displayName: mode === 'signup' ? displayName || undefined : undefined,
            });
        } catch (err) {
            // Error handled by parent
            console.error('Form submission error:', err);
        }
    };

    return (
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
                    disabled={isLoading}
                />
            </div>

            {mode === 'signup' && (
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
                        disabled={isLoading}
                    />
                </div>
            )}

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
                    placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                    required
                    minLength={mode === 'signup' ? 8 : undefined}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    disabled={isLoading}
                />
            </div>

            {mode === 'signup' && (
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
                        disabled={isLoading}
                    />
                </div>
            )}

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
                        {mode === 'signup' ? 'Creating Account...' : 'Signing In...'}
                    </span>
                ) : (
                    mode === 'signup' ? 'Create Account' : 'Sign In'
                )}
            </button>
        </form>
    );
}

export default AuthForm;
