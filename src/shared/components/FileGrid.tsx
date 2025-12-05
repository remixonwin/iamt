'use client';

import { getFileTypeInfo, formatFileSize } from '@/shared/utils';

interface FileGridProps {
    files: Array<{
        id: string;
        name: string;
        size: number;
        type: string;
        preview?: string;
        uploadedAt: number;
        visibility?: 'public' | 'private' | 'password-protected';
        encrypted?: boolean;
        canDecrypt?: boolean;
    }>;
    onDelete: (id: string) => void;
    onPreview: (id: string) => void;
}

export function FileGrid({ files, onDelete, onPreview }: FileGridProps) {
    if (files.length === 0) {
        return (
            <div className="text-center py-16 text-gray-500">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--surface)] flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                        />
                    </svg>
                </div>
                <p className="text-lg font-medium">No files yet</p>
                <p className="text-sm mt-1">Upload your first file to get started</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((file) => {
                const typeInfo = getFileTypeInfo({ type: file.type } as File);

                return (
                    <div
                        key={file.id}
                        className="group glass-card p-4 cursor-pointer hover:scale-[1.02] transition-all duration-200"
                        onClick={() => onPreview(file.id)}
                    >
                        {/* Thumbnail */}
                        <div
                            className="aspect-square rounded-xl mb-3 flex items-center justify-center overflow-hidden"
                            style={{ backgroundColor: `${typeInfo.color}15` }}
                        >
                            {file.preview && typeInfo.category === 'image' ? (
                                <img
                                    src={file.preview}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : file.preview && typeInfo.category === 'video' ? (
                                <video
                                    src={file.preview}
                                    className="w-full h-full object-cover"
                                    muted
                                />
                            ) : file.preview && typeInfo.category === 'audio' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                    <span className="text-3xl mb-2">🎵</span>
                                    <audio
                                        src={file.preview}
                                        controls
                                        className="w-full h-8"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            ) : file.preview && typeInfo.category === 'pdf' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center">
                                    <span className="text-4xl mb-1">📄</span>
                                    <span className="text-xs text-gray-400">Click to view</span>
                                </div>
                            ) : (
                                <span className="text-4xl">{typeInfo.icon}</span>
                            )}
                        </div>

                        {/* File Info */}
                        <div className="relative">
                            <p className="font-medium text-sm truncate pr-6">{file.name}</p>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
                                <span>{formatFileSize(file.size)}</span>
                                {file.visibility === 'public' && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        Public
                                    </span>
                                )}
                                {file.visibility === 'private' && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                        Private
                                    </span>
                                )}
                                {file.visibility === 'password-protected' && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                        PWD
                                    </span>
                                )}
                                {file.encrypted && !file.canDecrypt && (
                                    <span className="px-1 py-0.5 rounded text-[9px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold">
                                        🔒 Can't decrypt
                                    </span>
                                )}
                            </p>

                            {/* Delete Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(file.id);
                                }}
                                className="absolute -top-1 right-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100
                           hover:bg-[var(--error)]/20 hover:text-[var(--error)]
                           transition-all duration-200"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
