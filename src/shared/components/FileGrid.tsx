'use client';

import { getFileTypeInfo, formatFileSize, formatRelativeTime, truncateDid } from '@/shared/utils';

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
        ownerId?: string;
        ownerName?: string;
        ownerAvatarId?: string;
    }>;
    onDelete: (id: string) => void;
    onPreview: (id: string) => void;
    showUploader?: boolean;
}

function UploaderAvatar({ name, avatarId }: { name?: string; avatarId?: string }) {
    const initials = name ? name.slice(0, 2).toUpperCase() : '?';
    const colors = [
        'from-blue-500 to-purple-500',
        'from-green-500 to-teal-500',
        'from-orange-500 to-red-500',
        'from-pink-500 to-rose-500',
        'from-indigo-500 to-blue-500',
    ];
    const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;

    if (avatarId) {
        return (
            <img
                src={`/api/avatar/${avatarId}`}
                alt={name || 'User avatar'}
                className="w-6 h-6 rounded-full object-cover ring-2 ring-white/20"
                loading="lazy"
            />
        );
    }

    return (
        <div
            className={`w-6 h-6 rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-white/20`}
            aria-label={`Avatar for ${name || 'anonymous user'}`}
        >
            {initials}
        </div>
    );
}

export function FileGrid({ files, onDelete, onPreview, showUploader = true }: FileGridProps) {
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
                const isPublic = file.visibility === 'public';

                return (
                    <div
                        key={file.id}
                        className="group glass-card overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-200 relative"
                        onClick={() => onPreview(file.id)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Preview ${file.name}`}
                        onKeyDown={(e) => e.key === 'Enter' && onPreview(file.id)}
                    >
                        {/* Thumbnail */}
                        <div
                            className="aspect-square flex items-center justify-center overflow-hidden relative"
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

                            {/* Visibility Badge - Top Right */}
                            <div className="absolute top-2 right-2">
                                {file.visibility === 'private' && (
                                    <span className="px-2 py-1 rounded-full text-[10px] uppercase font-bold bg-green-500/90 text-white backdrop-blur-sm flex items-center gap-1 shadow-lg">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                        Private
                                    </span>
                                )}
                                {file.visibility === 'password-protected' && (
                                    <span className="px-2 py-1 rounded-full text-[10px] uppercase font-bold bg-yellow-500/90 text-white backdrop-blur-sm flex items-center gap-1 shadow-lg">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                        PWD
                                    </span>
                                )}
                                {file.encrypted && !file.canDecrypt && (
                                    <span className="px-2 py-1 rounded-full text-[10px] bg-red-500/90 text-white backdrop-blur-sm font-bold shadow-lg">
                                        🔒 Locked
                                    </span>
                                )}
                            </div>

                            {/* Delete Button - Top Left on Hover */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(file.id);
                                }}
                                className="absolute top-2 left-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100
                                    bg-black/50 hover:bg-[var(--error)] text-white
                                    transition-all duration-200 backdrop-blur-sm"
                                aria-label={`Delete ${file.name}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* File Info Section */}
                        <div className="p-3">
                            {/* File Name */}
                            <p className="font-medium text-sm truncate" title={file.name}>
                                {file.name}
                            </p>

                            {/* Size and Time */}
                            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                                <span>{formatFileSize(file.size)}</span>
                                <span>{formatRelativeTime(file.uploadedAt)}</span>
                            </div>

                            {/* Uploader Info - Only for Public Files */}
                            {showUploader && isPublic && (file.ownerId || file.ownerName) && (
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                                    <UploaderAvatar 
                                        name={file.ownerName} 
                                        avatarId={file.ownerAvatarId} 
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate" title={file.ownerName || file.ownerId}>
                                            {file.ownerName || truncateDid(file.ownerId || '')}
                                        </p>
                                        <p className="text-[10px] text-gray-500">Uploader</p>
                                    </div>
                                </div>
                            )}

                            {/* Anonymous Upload Indicator */}
                            {showUploader && isPublic && !file.ownerId && !file.ownerName && (
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                                    <div className="w-6 h-6 rounded-full bg-gray-500/30 flex items-center justify-center text-[10px] text-gray-400">
                                        ?
                                    </div>
                                    <p className="text-xs text-gray-500">Anonymous upload</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
