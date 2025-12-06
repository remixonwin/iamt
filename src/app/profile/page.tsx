/**
 * Profile Dashboard Page
 * 
 * User profile management with identity display, file stats,
 * and account recovery settings.
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '@/shared/contexts/AuthContext';
import { ProfileCard } from '@/shared/components/ProfileCard';
import { IdentityBadge } from '@/shared/components/IdentityBadge';
import { RecoverySettings } from '@/shared/components/RecoverySettings';

interface FileStats {
    fileCount: number;
    storageUsed: number;
}

export default function ProfilePage() {
    const { user, signOut, isLoading } = useRequireAuth();
    const [fileStats, setFileStats] = useState<FileStats>({ fileCount: 0, storageUsed: 0 });
    const [isSigningOut, setIsSigningOut] = useState(false);

    // Load file stats
    useEffect(() => {
        const loadFileStats = async () => {
            try {
                // Import the database adapter dynamically
                const { GunDatabaseAdapter } = await import('@/adapters/database/gun');
                const db = new GunDatabaseAdapter();
                
                // Wait for initialization
                await new Promise(r => setTimeout(r, 500));
                
                const files = await db.getFiles();
                const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
                
                setFileStats({
                    fileCount: files.length,
                    storageUsed: totalSize,
                });
            } catch (error) {
                console.error('Failed to load file stats:', error);
            }
        };

        if (user) {
            loadFileStats();
        }
    }, [user]);

    const handleSignOut = async () => {
        setIsSigningOut(true);
        try {
            await signOut();
            window.location.href = '/';
        } catch (error) {
            console.error('Sign out error:', error);
        } finally {
            setIsSigningOut(false);
        }
    };

    const handleAvatarChange = async (file: File) => {
        // TODO: Upload avatar via WebTorrent storage adapter
        console.log('Avatar upload:', file.name);
        // For now, just log - full implementation would use storage adapter
    };

    const handleExportKeypair = async (): Promise<string> => {
        // Get keypair from localStorage
        const keypairJson = localStorage.getItem('iamt-user-keypair');
        if (!keypairJson) {
            throw new Error('No keypair found');
        }
        return keypairJson;
    };

    // If still loading but we have no user yet, render page shell with a loader banner
    const showLoadingBanner = isLoading && !user;

    // Not authenticated - useRequireAuth will redirect
    if (!user) {
        return null;
    }

    return (
        <main className="min-h-screen p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {showLoadingBanner && (
                    <div className="mb-4 flex items-center gap-3 rounded-lg bg-surface/60 border border-white/10 p-3 text-sm text-gray-300">
                        <svg className="animate-spin h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Loading profile...</span>
                    </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/" className="text-accent hover:underline text-sm mb-2 inline-block">
                            ← Back to Files
                        </Link>
                        <h1 className="text-3xl font-bold gradient-text">Profile</h1>
                    </div>
                    <button
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="btn-secondary flex items-center gap-2"
                    >
                        {isSigningOut ? (
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        )}
                        Sign Out
                    </button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Left Column */}
                    <div className="space-y-6">
                        {/* Profile Card */}
                        <ProfileCard
                            fileCount={fileStats.fileCount}
                            storageUsed={fileStats.storageUsed}
                            onAvatarChange={handleAvatarChange}
                        />

                        {/* Identity Badge */}
                        <IdentityBadge
                            did={user.did}
                            emailVerified={user.emailVerified}
                        />
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Recovery Settings */}
                        <RecoverySettings onExportKeypair={handleExportKeypair} />

                        {/* Quick Actions */}
                        <div className="glass-card p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                            <div className="space-y-3">
                                <Link
                                    href="/"
                                    className="flex items-center gap-3 p-3 bg-surface/50 hover:bg-surface rounded-lg transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-white">Upload Files</div>
                                        <div className="text-xs text-gray-500">Add new files to your storage</div>
                                    </div>
                                </Link>

                                <Link
                                    href="/?tab=files"
                                    className="flex items-center gap-3 p-3 bg-surface/50 hover:bg-surface rounded-lg transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-white">My Files</div>
                                        <div className="text-xs text-gray-500">View and manage your files</div>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-8 border-t border-white/10 text-center text-xs text-gray-500">
                    <p>Your identity is secured with decentralized encryption.</p>
                    <p className="mt-1">
                        DID: <code className="text-gray-400">{user.did.slice(0, 20)}...</code>
                    </p>
                </div>
            </div>
        </main>
    );
}
