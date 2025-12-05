/**
 * File type utilities for upload handling
 * Detects file types and provides metadata
 */

export type FileCategory = 'pdf' | 'audio' | 'video' | 'image' | 'unknown';

export interface FileTypeInfo {
    category: FileCategory;
    icon: string;
    color: string;
    maxSize: number; // in bytes
}

const FILE_TYPE_MAP: Record<string, FileTypeInfo> = {
    // PDF
    'application/pdf': { category: 'pdf', icon: '📄', color: '#ef4444', maxSize: 50 * 1024 * 1024 },

    // Audio
    'audio/mpeg': { category: 'audio', icon: '🎵', color: '#22c55e', maxSize: 100 * 1024 * 1024 },
    'audio/wav': { category: 'audio', icon: '🎵', color: '#22c55e', maxSize: 100 * 1024 * 1024 },
    'audio/ogg': { category: 'audio', icon: '🎵', color: '#22c55e', maxSize: 100 * 1024 * 1024 },
    'audio/mp4': { category: 'audio', icon: '🎵', color: '#22c55e', maxSize: 100 * 1024 * 1024 },
    'audio/x-m4a': { category: 'audio', icon: '🎵', color: '#22c55e', maxSize: 100 * 1024 * 1024 },

    // Video
    'video/mp4': { category: 'video', icon: '🎬', color: '#a855f7', maxSize: 500 * 1024 * 1024 },
    'video/webm': { category: 'video', icon: '🎬', color: '#a855f7', maxSize: 500 * 1024 * 1024 },
    'video/quicktime': { category: 'video', icon: '🎬', color: '#a855f7', maxSize: 500 * 1024 * 1024 },

    // Images
    'image/jpeg': { category: 'image', icon: '🖼️', color: '#3b82f6', maxSize: 20 * 1024 * 1024 },
    'image/png': { category: 'image', icon: '🖼️', color: '#3b82f6', maxSize: 20 * 1024 * 1024 },
    'image/gif': { category: 'image', icon: '🖼️', color: '#3b82f6', maxSize: 20 * 1024 * 1024 },
    'image/webp': { category: 'image', icon: '🖼️', color: '#3b82f6', maxSize: 20 * 1024 * 1024 },
    'image/svg+xml': { category: 'image', icon: '🖼️', color: '#3b82f6', maxSize: 5 * 1024 * 1024 },
};

const UNKNOWN_TYPE: FileTypeInfo = {
    category: 'unknown',
    icon: '📁',
    color: '#6b7280',
    maxSize: 50 * 1024 * 1024,
};

/**
 * Get file type information from a File object
 */
export function getFileTypeInfo(file: File): FileTypeInfo {
    return FILE_TYPE_MAP[file.type] || UNKNOWN_TYPE;
}

/**
 * Check if file type is supported
 */
export function isFileTypeSupported(file: File): boolean {
    return file.type in FILE_TYPE_MAP;
}

/**
 * Check if file size is within limits
 */
export function isFileSizeValid(file: File): boolean {
    const info = getFileTypeInfo(file);
    return file.size <= info.maxSize;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get accepted file types string for input element
 */
export function getAcceptedFileTypes(): string {
    return Object.keys(FILE_TYPE_MAP).join(',');
}

/**
 * Get human-readable list of supported formats
 */
export function getSupportedFormatsText(): string {
    return 'PDF, MP3, WAV, MP4, WebM, JPG, PNG, GIF, WebP';
}
