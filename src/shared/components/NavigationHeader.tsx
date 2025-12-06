'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/contexts/AuthContext';

export function NavigationHeader() {
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();

    return (
        <nav className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link href="/" className="text-xl font-bold gradient-text">
                IAMT
            </Link>
            <div className="flex items-center gap-4">
                {authLoading ? (
                    <div className="w-8 h-8 rounded-full bg-[var(--surface)] animate-pulse" />
                ) : isAuthenticated && user ? (
                    <Link
                        href="/profile"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-sm font-medium">
                            {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-medium text-white hidden sm:inline">Profile</span>
                    </Link>
                ) : (
                    <>
                        <Link
                            href="/auth/login"
                            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                        >
                            Login
                        </Link>
                        <Link
                            href="/auth/signup"
                            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
                        >
                            Sign Up
                        </Link>
                    </>
                )}
            </div>
        </nav>
    );
}
