/**
 * Identity Badge Component
 * 
 * Displays the user's DID (Decentralized Identifier) with
 * copy functionality and email verification status.
 */

'use client';

import React, { useState } from 'react';

interface IdentityBadgeProps {
    did: string;
    emailVerified: boolean;
    compact?: boolean;
}

export function IdentityBadge({ did, emailVerified, compact = false }: IdentityBadgeProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(did);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Truncate DID for display
    const truncatedDid = did.length > 24
        ? `${did.slice(0, 12)}...${did.slice(-8)}`
        : did;

    if (compact) {
        return (
            <div className="inline-flex items-center gap-2">
                <code className="text-xs text-gray-400 font-mono">{truncatedDid}</code>
                {emailVerified && (
                    <span className="text-success" title="Email Verified">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="bg-surface/50 border border-white/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Decentralized Identity
                </span>
                {emailVerified ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-1 rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Unverified
                    </span>
                )}
            </div>
            
            <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-white font-mono bg-background/50 px-3 py-2 rounded overflow-hidden text-ellipsis">
                    {truncatedDid}
                </code>
                <button
                    onClick={handleCopy}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                    title="Copy full DID"
                >
                    {copied ? (
                        <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    )}
                </button>
            </div>

            <p className="text-xs text-gray-500 mt-2">
                Your unique decentralized identifier (did:key format)
            </p>
        </div>
    );
}

export default IdentityBadge;
