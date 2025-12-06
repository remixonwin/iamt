/**
 * Profile Card Component
 * 
 * Displays user profile information including avatar,
 * display name, email, and file statistics.
 */

'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/shared/contexts/AuthContext';

interface ProfileCardProps {
    fileCount?: number;
    storageUsed?: number;
    onAvatarChange?: (file: File) => Promise<void>;
}

export function ProfileCard({ fileCount = 0, storageUsed = 0, onAvatarChange }: ProfileCardProps) {
    const { user, updateProfile, sendVerificationEmail, isLoading } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!user) {
        return null;
    }

    const formatStorageSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };

    const handleSaveDisplayName = async () => {
        setIsSaving(true);
        try {
            await updateProfile({ displayName: displayName || undefined });
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to update display name:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onAvatarChange) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Avatar must be less than 5MB');
            return;
        }

        setIsUploadingAvatar(true);
        try {
            await onAvatarChange(file);
        } catch (error) {
            console.error('Failed to upload avatar:', error);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleSendVerification = async () => {
        try {
            await sendVerificationEmail();
            setVerificationSent(true);
        } catch (error) {
            console.error('Failed to send verification email:', error);
        }
    };

    // Generate avatar initials
    const initials = (user.displayName || user.email)
        .split(/[\s@]/)
        .slice(0, 2)
        .map(s => s[0]?.toUpperCase() || '')
        .join('');

    return (
        <div className="glass-card p-6">
            <div className="flex items-start gap-6">
                {/* Avatar */}
                <div className="relative">
                    <button
                        onClick={handleAvatarClick}
                        disabled={isUploadingAvatar || !onAvatarChange}
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center text-2xl font-bold text-white overflow-hidden hover:ring-2 hover:ring-accent/50 transition-all disabled:cursor-default"
                    >
                        {isUploadingAvatar ? (
                            <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : user.avatarId ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={`/api/avatar/${user.avatarId}`}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            initials
                        )}
                    </button>
                    {onAvatarChange && (
                        <div className="absolute -bottom-1 -right-1 p-1 bg-surface rounded-full border border-white/10">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                    />
                </div>

                {/* Profile Info */}
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="input py-1 px-2 text-lg"
                                    placeholder="Display name"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSaveDisplayName}
                                    disabled={isSaving}
                                    className="p-1 text-success hover:bg-success/10 rounded"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setDisplayName(user.displayName || '');
                                    }}
                                    className="p-1 text-gray-400 hover:bg-white/10 rounded"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-xl font-bold text-white">
                                    {user.displayName || 'Anonymous User'}
                                </h2>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>{user.email}</span>
                        {user.emailVerified ? (
                            <span className="text-success" title="Verified">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </span>
                        ) : verificationSent ? (
                            <span className="text-xs text-yellow-500">Check your email!</span>
                        ) : (
                            <button
                                onClick={handleSendVerification}
                                disabled={isLoading}
                                className="text-xs text-accent hover:underline"
                            >
                                Verify email
                            </button>
                        )}
                    </div>

                    <div className="text-xs text-gray-500 mt-1">
                        Member since {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                <div className="text-center">
                    <div className="text-2xl font-bold text-white">{fileCount}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Files</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-white">{formatStorageSize(storageUsed)}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Storage Used</div>
                </div>
            </div>
        </div>
    );
}

export default ProfileCard;
