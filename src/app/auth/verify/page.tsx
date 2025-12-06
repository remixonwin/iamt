/**
 * Magic Link Verification Page
 * 
 * Landing page for email verification and password recovery magic links.
 */

'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/shared/contexts/AuthContext';

function VerifyContent() {
    const searchParams = useSearchParams();
    const { verifyMagicLink, isAuthenticated } = useAuth();
    
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verifying your link...');

    const token = searchParams.get('token');
    const type = searchParams.get('type') as 'verification' | 'recovery' | null;

    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Invalid verification link. No token provided.');
                return;
            }

            try {
                const success = await verifyMagicLink(token);

                if (success) {
                    setStatus('success');
                    if (type === 'verification') {
                        setMessage('Your email has been verified successfully!');
                    } else if (type === 'recovery') {
                        setMessage('Your recovery link is valid. You can now reset your password.');
                    } else {
                        setMessage('Verification successful!');
                    }
                } else {
                    setStatus('error');
                    setMessage('This verification link has expired or is invalid. Please request a new one.');
                }
            } catch (err) {
                console.error('Verification error:', err);
                setStatus('error');
                setMessage('An error occurred during verification. Please try again.');
            }
        };

        verify();
    }, [token, type, verifyMagicLink]);

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <div className="glass-card p-8 max-w-md w-full text-center">
                {status === 'loading' && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-6">
                            <svg className="animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Verifying...</h1>
                        <p className="text-gray-400">{message}</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-success to-emerald-600 flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Success!</h1>
                        <p className="text-gray-400 mb-6">{message}</p>
                        
                        {type === 'recovery' ? (
                            <Link href="/auth/login" className="btn-primary inline-block">
                                Reset Password
                            </Link>
                        ) : isAuthenticated ? (
                            <Link href="/profile" className="btn-primary inline-block">
                                Go to Profile
                            </Link>
                        ) : (
                            <Link href="/auth/login" className="btn-primary inline-block">
                                Sign In
                            </Link>
                        )}
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-error to-red-600 flex items-center justify-center">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
                        <p className="text-gray-400 mb-6">{message}</p>
                        
                        <div className="space-y-3">
                            <Link href="/auth/login" className="btn-primary block">
                                Back to Login
                            </Link>
                            <Link href="/auth/signup" className="btn-secondary block">
                                Create New Account
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}

export default function VerifyPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen flex items-center justify-center p-4">
                <div className="glass-card p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 mx-auto mb-6">
                        <svg className="animate-spin text-accent" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Loading...</h1>
                </div>
            </main>
        }>
            <VerifyContent />
        </Suspense>
    );
}
