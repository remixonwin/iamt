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
                            {file.preview && (typeInfo.category === 'image' || typeInfo.category === 'video') ? (
                                typeInfo.category === 'image' ? (
                                    <img
                                        src={file.preview}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <video
                                        src={file.preview}
                                        className="w-full h-full object-cover"
                                        muted
                                    />
                                )
                            ) : (
                                <span className="text-4xl">{typeInfo.icon}</span>
                            )}
                        </div>

                        {/* File Info */}
                        <div className="relative">
                            <p className="font-medium text-sm truncate pr-6">{file.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {formatFileSize(file.size)}
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
