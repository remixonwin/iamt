/**
 * Recovery Settings Component
 * 
 * Allows users to view their seed phrase, manage recovery email,
 * and export their keypair for backup.
 */

'use client';

import React, { useState } from 'react';
import { useAuth } from '@/shared/contexts/AuthContext';

interface RecoverySettingsProps {
    onExportKeypair?: () => Promise<string>;
}

export function RecoverySettings({ onExportKeypair }: RecoverySettingsProps) {
    const { user, getSeedPhrase } = useAuth();
    
    const [showSeedPhrase, setShowSeedPhrase] = useState(false);
    const [seedPhrase, setSeedPhrase] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [seedPhraseCopied, setSeedPhraseCopied] = useState(false);
    const [keypairExported, setKeypairExported] = useState(false);

    if (!user) {
        return null;
    }

    const handleRevealSeedPhrase = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const phrase = await getSeedPhrase(password);
            setSeedPhrase(phrase);
            setShowSeedPhrase(true);
            setPassword('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to decrypt seed phrase');
        } finally {
            setIsLoading(false);
        }
    };

    const handleHideSeedPhrase = () => {
        setSeedPhrase(null);
        setShowSeedPhrase(false);
    };

    const handleCopySeedPhrase = async () => {
        if (seedPhrase) {
            await navigator.clipboard.writeText(seedPhrase);
            setSeedPhraseCopied(true);
            setTimeout(() => setSeedPhraseCopied(false), 2000);
        }
    };

    const handleExportKeypair = async () => {
        if (!onExportKeypair) return;
        
        setIsLoading(true);
        try {
            const keypairJson = await onExportKeypair();
            
            // Download as file
            const blob = new Blob([keypairJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `iamt-keypair-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setKeypairExported(true);
            setTimeout(() => setKeypairExported(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to export keypair');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Account Recovery
            </h3>

            <div className="space-y-6">
                {/* Seed Phrase Section */}
                <div className="bg-surface/50 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h4 className="text-sm font-medium text-white">Recovery Seed Phrase</h4>
                            <p className="text-xs text-gray-500 mt-1">
                                12-word phrase to recover your account on any device
                            </p>
                        </div>
                        {showSeedPhrase && (
                            <button
                                onClick={handleHideSeedPhrase}
                                className="text-xs text-gray-400 hover:text-white"
                            >
                                Hide
                            </button>
                        )}
                    </div>

                    {showSeedPhrase && seedPhrase ? (
                        <div className="space-y-3">
                            <div className="bg-background/50 rounded-lg p-3">
                                <div className="grid grid-cols-3 gap-2">
                                    {seedPhrase.split(' ').map((word, index) => (
                                        <div key={index} className="flex items-center gap-2 text-sm">
                                            <span className="text-gray-500 font-mono text-xs w-5">{index + 1}.</span>
                                            <span className="text-white font-mono">{word}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={handleCopySeedPhrase}
                                className="btn-secondary text-sm w-full flex items-center justify-center gap-2"
                            >
                                {seedPhraseCopied ? (
                                    <>
                                        <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copy Seed Phrase
                                    </>
                                )}
                            </button>
                            <div className="flex items-start gap-2 text-xs text-yellow-500 bg-yellow-500/10 rounded p-2">
                                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span>Store this phrase securely offline. Anyone with access can recover your account.</span>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleRevealSeedPhrase} className="flex gap-2">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input flex-1"
                                placeholder="Enter your password"
                                required
                            />
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn-secondary whitespace-nowrap"
                            >
                                {isLoading ? (
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                ) : (
                                    'Reveal'
                                )}
                            </button>
                        </form>
                    )}

                    {error && (
                        <div className="mt-2 text-sm text-error">{error}</div>
                    )}
                </div>

                {/* Export Keypair Section */}
                {onExportKeypair && (
                    <div className="bg-surface/50 border border-white/10 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-medium text-white">Export Keypair</h4>
                                <p className="text-xs text-gray-500 mt-1">
                                    Download your encrypted keypair as a JSON backup file
                                </p>
                            </div>
                            <button
                                onClick={handleExportKeypair}
                                disabled={isLoading}
                                className="btn-secondary text-sm flex items-center gap-2"
                            >
                                {keypairExported ? (
                                    <>
                                        <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Exported!
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Export
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Security Tips */}
                <div className="text-xs text-gray-500 space-y-1">
                    <p className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-success" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Your keys are encrypted and never leave your device
                    </p>
                    <p className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-success" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Seed phrase is the only way to recover if you forget your password
                    </p>
                </div>
            </div>
        </div>
    );
}

export default RecoverySettings;
