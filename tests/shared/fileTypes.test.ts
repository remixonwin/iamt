import { describe, it, expect } from 'vitest';
import {
    getFileTypeInfo,
    isFileTypeSupported,
    isFileSizeValid,
    formatFileSize,
    getAcceptedFileTypes,
    getSupportedFormatsText,
} from '@/shared/utils';

describe('File Type Utilities', () => {
    describe('getFileTypeInfo', () => {
        it('should identify PDF files', () => {
            const file = { type: 'application/pdf' } as File;
            const info = getFileTypeInfo(file);

            expect(info.category).toBe('pdf');
            expect(info.icon).toBe('📄');
            expect(info.maxSize).toBe(50 * 1024 * 1024); // 50MB
        });

        it('should identify audio files', () => {
            const mp3 = { type: 'audio/mpeg' } as File;
            const wav = { type: 'audio/wav' } as File;

            expect(getFileTypeInfo(mp3).category).toBe('audio');
            expect(getFileTypeInfo(wav).category).toBe('audio');
            expect(getFileTypeInfo(mp3).icon).toBe('🎵');
        });

        it('should identify video files', () => {
            const mp4 = { type: 'video/mp4' } as File;
            const webm = { type: 'video/webm' } as File;

            expect(getFileTypeInfo(mp4).category).toBe('video');
            expect(getFileTypeInfo(webm).category).toBe('video');
            expect(getFileTypeInfo(mp4).icon).toBe('🎬');
        });

        it('should identify image files', () => {
            const jpg = { type: 'image/jpeg' } as File;
            const png = { type: 'image/png' } as File;
            const gif = { type: 'image/gif' } as File;

            expect(getFileTypeInfo(jpg).category).toBe('image');
            expect(getFileTypeInfo(png).category).toBe('image');
            expect(getFileTypeInfo(gif).category).toBe('image');
            expect(getFileTypeInfo(jpg).icon).toBe('🖼️');
        });

        it('should return unknown for unsupported types', () => {
            const file = { type: 'application/octet-stream' } as File;
            const info = getFileTypeInfo(file);

            expect(info.category).toBe('unknown');
            expect(info.icon).toBe('📁');
        });
    });

    describe('isFileTypeSupported', () => {
        it('should return true for supported types', () => {
            expect(isFileTypeSupported({ type: 'application/pdf' } as File)).toBe(true);
            expect(isFileTypeSupported({ type: 'audio/mpeg' } as File)).toBe(true);
            expect(isFileTypeSupported({ type: 'video/mp4' } as File)).toBe(true);
            expect(isFileTypeSupported({ type: 'image/jpeg' } as File)).toBe(true);
        });

        it('should return false for unsupported types', () => {
            expect(isFileTypeSupported({ type: 'application/zip' } as File)).toBe(false);
            expect(isFileTypeSupported({ type: 'text/plain' } as File)).toBe(false);
        });
    });

    describe('isFileSizeValid', () => {
        it('should accept files within size limits', () => {
            const smallPdf = { type: 'application/pdf', size: 1024 * 1024 } as File; // 1MB
            const smallImage = { type: 'image/jpeg', size: 5 * 1024 * 1024 } as File; // 5MB

            expect(isFileSizeValid(smallPdf)).toBe(true);
            expect(isFileSizeValid(smallImage)).toBe(true);
        });

        it('should reject files exceeding size limits', () => {
            const largePdf = { type: 'application/pdf', size: 100 * 1024 * 1024 } as File; // 100MB
            const largeImage = { type: 'image/jpeg', size: 50 * 1024 * 1024 } as File; // 50MB

            expect(isFileSizeValid(largePdf)).toBe(false);
            expect(isFileSizeValid(largeImage)).toBe(false);
        });
    });

    describe('formatFileSize', () => {
        it('should format bytes correctly', () => {
            expect(formatFileSize(0)).toBe('0 B');
            expect(formatFileSize(500)).toBe('500 B');
        });

        it('should format kilobytes correctly', () => {
            expect(formatFileSize(1024)).toBe('1 KB');
            expect(formatFileSize(1536)).toBe('1.5 KB');
        });

        it('should format megabytes correctly', () => {
            expect(formatFileSize(1024 * 1024)).toBe('1 MB');
            expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
        });

        it('should format gigabytes correctly', () => {
            expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
        });
    });

    describe('getAcceptedFileTypes', () => {
        it('should return comma-separated MIME types', () => {
            const accepted = getAcceptedFileTypes();

            expect(accepted).toContain('application/pdf');
            expect(accepted).toContain('audio/mpeg');
            expect(accepted).toContain('video/mp4');
            expect(accepted).toContain('image/jpeg');
        });
    });

    describe('getSupportedFormatsText', () => {
        it('should return human-readable format list', () => {
            const text = getSupportedFormatsText();

            expect(text).toContain('PDF');
            expect(text).toContain('MP3');
            expect(text).toContain('MP4');
            expect(text).toContain('JPG');
        });
    });
});
