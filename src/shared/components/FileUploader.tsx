'use client';

import { useState, useCallback, useRef } from 'react';
import {
    getFileTypeInfo,
    isFileTypeSupported,
    isFileSizeValid,
    formatFileSize,
    getAcceptedFileTypes,
    getSupportedFormatsText,
} from '@/shared/utils';

/** File visibility options */
export type FileVisibility = 'public' | 'private' | 'password-protected';

export interface UploadedFile {
    id: string;
    file: File;
    preview?: string;
    progress: number;
    status: 'pending' | 'uploading' | 'complete' | 'error';
    error?: string;
    /** File visibility setting */
    visibility: FileVisibility;
    /** Password for password-protected files */
    password?: string;
}

interface FileUploaderProps {
    onFilesSelected: (files: UploadedFile[]) => void;
    maxFiles?: number;
    disabled?: boolean;
    /** Default visibility for uploaded files */
    defaultVisibility?: FileVisibility;
}

export function FileUploader({
    onFilesSelected,
    maxFiles = 10,
    disabled = false,
    defaultVisibility = 'public'
}: FileUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [visibility, setVisibility] = useState<FileVisibility>(defaultVisibility);
    const [password, setPassword] = useState('');
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const processFiles = useCallback((fileList: FileList | null) => {
        if (!fileList) return;

        // Validate password for password-protected files
        if (visibility === 'password-protected' && !password.trim()) {
            setErrors(['Please enter a password for password-protected files']);
            return;
        }

        const newErrors: string[] = [];
        const validFiles: UploadedFile[] = [];

        Array.from(fileList).slice(0, maxFiles).forEach((file) => {
            if (!isFileTypeSupported(file)) {
                newErrors.push(`${file.name}: Unsupported file type`);
                return;
            }

            if (!isFileSizeValid(file)) {
                const info = getFileTypeInfo(file);
                newErrors.push(`${file.name}: File too large (max ${formatFileSize(info.maxSize)})`);
                return;
            }

            const uploadedFile: UploadedFile = {
                id: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file,
                progress: 0,
                status: 'pending',
                visibility,
                password: visibility === 'password-protected' ? password : undefined,
            };

            // Create preview URL for all supported file types (PDF, audio, video, images)
            uploadedFile.preview = URL.createObjectURL(file);

            validFiles.push(uploadedFile);
        });

        setErrors(newErrors);
        if (validFiles.length > 0) {
            onFilesSelected(validFiles);
            // Reset password after upload
            if (visibility === 'password-protected') {
                setPassword('');
            }
        }
    }, [maxFiles, onFilesSelected, visibility, password]);

    const handleVisibilityChange = (newVisibility: FileVisibility) => {
        setVisibility(newVisibility);
        setShowPasswordInput(newVisibility === 'password-protected');
        if (newVisibility !== 'password-protected') {
            setPassword('');
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsDragging(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (!disabled) processFiles(e.dataTransfer.files);
    }, [disabled, processFiles]);

    const handleClick = () => {
        if (!disabled) inputRef.current?.click();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        processFiles(e.target.files);
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className="space-y-4">
            {/* Visibility Toggle */}
            <div className="glass-card p-4 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-300">File Privacy</span>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        {visibility === 'private' && (
                            <span className="flex items-center gap-1 text-green-400">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                Encrypted
                            </span>
                        )}
                        {visibility === 'password-protected' && (
                            <span className="flex items-center gap-1 text-yellow-400">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                                </svg>
                                Password Protected
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => handleVisibilityChange('public')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
                            ${visibility === 'public'
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-[var(--surface)] text-gray-400 hover:text-white hover:bg-[var(--surface-hover)]'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Public
                    </button>
                    <button
                        type="button"
                        onClick={() => handleVisibilityChange('private')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
                            ${visibility === 'private'
                                ? 'bg-green-600 text-white'
                                : 'bg-[var(--surface)] text-gray-400 hover:text-white hover:bg-[var(--surface-hover)]'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Private
                    </button>
                    <button
                        type="button"
                        onClick={() => handleVisibilityChange('password-protected')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
                            ${visibility === 'password-protected'
                                ? 'bg-yellow-600 text-white'
                                : 'bg-[var(--surface)] text-gray-400 hover:text-white hover:bg-[var(--surface-hover)]'
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        Password
                    </button>
                </div>

                {/* Password Input */}
                {showPasswordInput && (
                    <div className="mt-3">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password for encryption"
                            className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Share this password with people you want to access the file
                        </p>
                    </div>
                )}

                {/* Visibility Info */}
                <div className="mt-3 text-xs text-gray-500">
                    {visibility === 'public' && (
                        <p>🌐 Anyone with the link can download this file</p>
                    )}
                    {visibility === 'private' && (
                        <p>🔒 Only you can decrypt this file (key stored locally)</p>
                    )}
                    {visibility === 'password-protected' && (
                        <p>🔑 Anyone with the password can decrypt this file</p>
                    )}
                </div>
            </div>

            {/* Drop Zone */}
            <div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
          relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-300 ease-out
          ${isDragging
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 scale-[1.02]'
                        : 'border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--surface)]'
                    }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
            >
                {/* Animated background gradient */}
                <div className={`
          absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300
          bg-gradient-to-br from-[var(--accent)]/5 via-transparent to-purple-500/5
          ${isDragging ? 'opacity-100' : ''}
        `} />

                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={getAcceptedFileTypes()}
                    onChange={handleInputChange}
                    className="hidden"
                    disabled={disabled}
                />

                <div className="relative z-10 space-y-4">
                    {/* Icon with lock indicator for encrypted uploads */}
                    <div className={`
            w-16 h-16 mx-auto rounded-2xl flex items-center justify-center relative
            transition-all duration-300
            ${isDragging
                            ? 'bg-[var(--accent)] scale-110'
                            : visibility === 'private' 
                                ? 'bg-green-600/20' 
                                : visibility === 'password-protected'
                                    ? 'bg-yellow-600/20'
                                    : 'bg-[var(--surface)]'
                        }
          `}>
                        <svg
                            className={`w-8 h-8 transition-colors ${
                                isDragging ? 'text-white' : 
                                visibility === 'private' ? 'text-green-400' :
                                visibility === 'password-protected' ? 'text-yellow-400' :
                                'text-[var(--accent)]'
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                        </svg>
                        {visibility !== 'public' && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--bg)] flex items-center justify-center">
                                <svg className={`w-3 h-3 ${visibility === 'private' ? 'text-green-400' : 'text-yellow-400'}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Text */}
                    <div>
                        <p className="text-lg font-medium">
                            {isDragging ? (
                                <span className="text-[var(--accent)]">Drop files here</span>
                            ) : (
                                <>
                                    <span className={
                                        visibility === 'private' ? 'text-green-400' :
                                        visibility === 'password-protected' ? 'text-yellow-400' :
                                        'text-[var(--accent)]'
                                    }>Click to upload</span>
                                    <span className="text-gray-400"> or drag and drop</span>
                                </>
                            )}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            {getSupportedFormatsText()}
                        </p>
                        {visibility !== 'public' && (
                            <p className="text-xs text-gray-600 mt-1">
                                Files will be encrypted before upload
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Messages */}
            {errors.length > 0 && (
                <div className="space-y-2">
                    {errors.map((error, i) => (
                        <div
                            key={i}
                            className="p-3 rounded-lg bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--error)] text-sm flex items-center gap-2"
                        >
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
