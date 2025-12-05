'use client';

import { getFileTypeInfo, formatFileSize } from '@/shared/utils';
import type { UploadedFile } from './FileUploader';

interface FilePreviewProps {
    uploadedFile: UploadedFile;
    onRemove: (id: string) => void;
}

export function FilePreview({ uploadedFile, onRemove }: FilePreviewProps) {
    const { file, preview, progress, status, error } = uploadedFile;
    const typeInfo = getFileTypeInfo(file);

    return (
        <div className={`
      group relative glass-card p-4 transition-all duration-300
      ${status === 'error' ? 'border-[var(--error)]/50' : ''}
      ${status === 'complete' ? 'border-[var(--success)]/30' : ''}
    `}>
            <div className="flex items-start gap-4">
                {/* Preview Thumbnail */}
                <div
                    className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: `${typeInfo.color}20` }}
                >
                    {preview && typeInfo.category === 'image' ? (
                        <img
                            src={preview}
                            alt={file.name}
                            className="w-full h-full object-cover"
                        />
                    ) : preview && typeInfo.category === 'video' ? (
                        <video
                            src={preview}
                            className="w-full h-full object-cover"
                            muted
                        />
                    ) : (
                        <span className="text-2xl">{typeInfo.icon}</span>
                    )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-medium truncate pr-8">{file.name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                        {formatFileSize(file.size)}
                        <span className="mx-2">•</span>
                        <span style={{ color: typeInfo.color }}>{typeInfo.category.toUpperCase()}</span>
                    </p>

                    {/* Progress Bar */}
                    {status === 'uploading' && (
                        <div className="mt-3">
                            <div className="h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-[var(--accent)] to-purple-500 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{progress}% uploaded</p>
                        </div>
                    )}

                    {/* Status Messages */}
                    {status === 'complete' && (
                        <p className="text-sm text-[var(--success)] mt-2 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Uploaded successfully
                        </p>
                    )}

                    {status === 'error' && error && (
                        <p className="text-sm text-[var(--error)] mt-2 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            {error}
                        </p>
                    )}
                </div>

                {/* Remove Button */}
                <button
                    onClick={() => onRemove(uploadedFile.id)}
                    className="absolute top-3 right-3 p-2 rounded-lg opacity-0 group-hover:opacity-100 
                     bg-[var(--surface)] hover:bg-[var(--error)]/20 hover:text-[var(--error)]
                     transition-all duration-200"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
