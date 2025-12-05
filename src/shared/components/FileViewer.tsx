'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatFileSize, getFileTypeInfo } from '@/shared/utils';

interface FileViewerProps {
    file: {
        id: string;
        name: string;
        size: number;
        type: string;
        visibility?: 'public' | 'private' | 'password-protected';
        encrypted?: boolean;
    };
    blob: Blob;
    onClose: () => void;
}

export function FileViewer({ file, blob, onClose }: FileViewerProps) {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const typeInfo = getFileTypeInfo({ type: file.type } as File);

    // Create download handler from blob
    const handleDownload = useCallback(() => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [blob, file.name]);

    useEffect(() => {
        if (blob) {
            const url = URL.createObjectURL(blob);
            setObjectUrl(url);
            if (isTextFile(file.type, file.name)) {
                blob.text().then(setTextContent).catch(console.error);
            }
            return () => URL.revokeObjectURL(url);
        }
    }, [blob, file.type, file.name]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
            if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.25));
            if (e.key === '0') setZoom(1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const renderContent = useCallback(() => {
        if (!objectUrl) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                    <span className="text-6xl">{typeInfo.icon}</span>
                    <p className="text-gray-400">Loading preview...</p>
                </div>
            );
        }

        // Image preview
        if (file.type.startsWith('image/')) {
            return (
                <div className="flex items-center justify-center h-full overflow-auto p-4">
                    <img
                        src={objectUrl}
                        alt={file.name}
                        className="max-w-full max-h-full object-contain transition-transform duration-200"
                        style={{ transform: `scale(${zoom})` }}
                    />
                </div>
            );
        }

        // Video preview
        if (file.type.startsWith('video/')) {
            return (
                <div className="flex items-center justify-center h-full p-4">
                    <video
                        src={objectUrl}
                        controls
                        autoPlay
                        className="max-w-full max-h-full rounded-lg"
                        style={{ maxHeight: 'calc(100vh - 200px)' }}
                    />
                </div>
            );
        }

        // Audio preview
        if (file.type.startsWith('audio/')) {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center animate-pulse">
                        <span className="text-6xl">🎵</span>
                    </div>
                    <p className="text-lg font-medium">{file.name}</p>
                    <audio src={objectUrl} controls autoPlay className="w-full max-w-md" />
                </div>
            );
        }

        // PDF preview
        if (file.type === 'application/pdf') {
            return <iframe src={objectUrl} className="w-full h-full border-0" title={file.name} />;
        }

        // Text/Code preview
        if (isTextFile(file.type, file.name)) {
            return (
                <div className="h-full overflow-auto p-4">
                    <pre className="font-mono text-sm bg-[var(--surface)] p-4 rounded-lg overflow-x-auto whitespace-pre-wrap break-words">
                        {textContent ? (file.name.endsWith('.json') ? formatJSON(textContent) : textContent) : 'Loading...'}
                    </pre>
                </div>
            );
        }

        // Fallback - show file info with download option
        return (
            <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
                <div
                    className="w-24 h-24 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${typeInfo.color}20` }}
                >
                    <span className="text-5xl">{typeInfo.icon}</span>
                </div>
                <div>
                    <p className="text-xl font-medium">{file.name}</p>
                    <p className="text-gray-400 mt-1">{formatFileSize(file.size)}</p>
                    <p className="text-sm mt-2" style={{ color: typeInfo.color }}>
                        {typeInfo.category.toUpperCase()} • {file.type || 'Unknown type'}
                    </p>
                </div>
                <p className="text-gray-500 text-sm">Preview not available for this file type.</p>
                <button
                    onClick={handleDownload}
                    className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/80 rounded-xl font-medium transition-colors"
                >
                    Download File
                </button>
            </div>
        );
    }, [objectUrl, file, typeInfo, zoom, textContent, handleDownload]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            {/* Close on backdrop click */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Viewer Container */}
            <div className="relative w-full h-full max-w-6xl max-h-[90vh] m-4 bg-[var(--background)] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${typeInfo.color}20` }}
                        >
                            <span className="text-xl">{typeInfo.icon}</span>
                        </div>
                        <div>
                            <h2 className="font-medium truncate max-w-md">{file.name}</h2>
                            <p className="text-sm text-gray-400">
                                {formatFileSize(file.size)}
                                {file.visibility && file.visibility !== 'public' && (
                                    <span className="ml-2">
                                        {file.visibility === 'private' ? '🔒 Private' : '🔑 Password Protected'}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Zoom controls for images */}
                        {file.type.startsWith('image/') && objectUrl && (
                            <div className="flex items-center gap-1 mr-4 bg-[var(--surface)] rounded-lg p-1">
                                <button
                                    onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    title="Zoom out (-)"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    </svg>
                                </button>
                                <span className="px-2 text-sm min-w-[4rem] text-center">{Math.round(zoom * 100)}%</span>
                                <button
                                    onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    title="Zoom in (+)"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setZoom(1)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-xs"
                                    title="Reset zoom (0)"
                                >
                                    Reset
                                </button>
                            </div>
                        )}

                        {/* Download button */}
                        <button
                            onClick={handleDownload}
                            className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors"
                            title="Download"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[var(--surface)] rounded-lg transition-colors"
                            title="Close (Esc)"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden bg-[var(--surface)]/50">
                    {renderContent()}
                </div>

                {/* Footer */}
                <div className="px-6 py-2 border-t border-white/10 text-xs text-gray-500 flex items-center justify-between">
                    <span>
                        {file.type.startsWith('image/') && 'Use +/- to zoom • 0 to reset • '}
                        Press Esc to close
                    </span>
                    <span style={{ color: typeInfo.color }}>{typeInfo.category}</span>
                </div>
            </div>
        </div>
    );
}

function isTextFile(mimeType: string, fileName: string): boolean {
    const textTypes = [
        'text/plain', 'text/html', 'text/css', 'text/javascript', 'text/markdown',
        'text/csv', 'text/xml', 'application/javascript', 'application/typescript',
        'application/xml', 'application/json',
    ];
    const textExtensions = [
        '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.css', '.html', '.htm',
        '.xml', '.csv', '.log', '.sh', '.bash', '.py', '.rb', '.go', '.rs',
        '.c', '.cpp', '.h', '.java', '.kt', '.swift', '.php', '.sql',
        '.yaml', '.yml', '.toml', '.ini', '.conf', '.env', '.gitignore', '.json',
    ];
    if (textTypes.includes(mimeType)) return true;
    return textExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
}

function formatJSON(text: string): string {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}
