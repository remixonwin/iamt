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

export interface UploadedFile {
    id: string;
    file: File;
    preview?: string;
    progress: number;
    status: 'pending' | 'uploading' | 'complete' | 'error';
    error?: string;
}

interface FileUploaderProps {
    onFilesSelected: (files: UploadedFile[]) => void;
    maxFiles?: number;
    disabled?: boolean;
}

export function FileUploader({
    onFilesSelected,
    maxFiles = 10,
    disabled = false
}: FileUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const processFiles = useCallback((fileList: FileList | null) => {
        if (!fileList) return;

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
            };

            // Create preview URL for all supported file types (PDF, audio, video, images)
            uploadedFile.preview = URL.createObjectURL(file);

            validFiles.push(uploadedFile);
        });

        setErrors(newErrors);
        if (validFiles.length > 0) {
            onFilesSelected(validFiles);
        }
    }, [maxFiles, onFilesSelected]);

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
                    {/* Icon */}
                    <div className={`
            w-16 h-16 mx-auto rounded-2xl flex items-center justify-center
            transition-all duration-300
            ${isDragging
                            ? 'bg-[var(--accent)] scale-110'
                            : 'bg-[var(--surface)]'
                        }
          `}>
                        <svg
                            className={`w-8 h-8 transition-colors ${isDragging ? 'text-white' : 'text-[var(--accent)]'}`}
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
                    </div>

                    {/* Text */}
                    <div>
                        <p className="text-lg font-medium">
                            {isDragging ? (
                                <span className="text-[var(--accent)]">Drop files here</span>
                            ) : (
                                <>
                                    <span className="text-[var(--accent)]">Click to upload</span>
                                    <span className="text-gray-400"> or drag and drop</span>
                                </>
                            )}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            {getSupportedFormatsText()}
                        </p>
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
