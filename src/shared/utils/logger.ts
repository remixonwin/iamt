/**
 * Centralized Logger Service
 * 
 * Provides consistent logging across the application with:
 * - Log levels (debug/info/warn/error)
 * - Category tagging
 * - In-memory log buffer for debugging
 * - Hook for production error reporting (Sentry, etc.)
 */

import { SYNC_CONFIG } from '@/shared/config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    level: LogLevel;
    category: string;
    message: string;
    data?: unknown;
    timestamp: number;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Logger categories for consistent tagging
 */
export const LogCategory = {
    GUN: 'Gun.js',
    GUN_SEA: 'GunSEA',
    AUTH: 'Auth',
    P2P: 'P2P',
    STORAGE: 'Storage',
    CRYPTO: 'Crypto',
    KEYRING: 'Keyring',
    SYNC: 'Sync',
    APP: 'App',
} as const;

export type LogCategoryType = (typeof LogCategory)[keyof typeof LogCategory];

/**
 * Logger class - singleton pattern
 */
class Logger {
    private static instance: Logger;
    private logBuffer: LogEntry[] = [];
    private maxBufferSize: number;
    private minLevel: LogLevel;
    private consoleInProduction: boolean;

    /**
     * Hook for external error reporting (Sentry, LogRocket, etc.)
     * Set this to forward errors to your error tracking service
     */
    public onError?: (entry: LogEntry) => void;

    /**
     * Hook for all logs (useful for custom log aggregation)
     */
    public onLog?: (entry: LogEntry) => void;

    private constructor() {
        this.maxBufferSize = SYNC_CONFIG.logging.maxBufferSize;
        this.minLevel = SYNC_CONFIG.logging.minLevel as LogLevel;
        this.consoleInProduction = SYNC_CONFIG.logging.consoleInProduction;
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
    }

    private isProduction(): boolean {
        return typeof window !== 'undefined' &&
            !window.location.hostname.includes('localhost');
    }

    private formatMessage(category: string, message: string): string {
        return `[${category}] ${message}`;
    }

    /**
     * Core logging method
     */
    log(level: LogLevel, category: string, message: string, data?: unknown): void {
        const entry: LogEntry = {
            level,
            category,
            message,
            data,
            timestamp: Date.now(),
        };

        // Always add to buffer
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }

        // Call external hooks
        this.onLog?.(entry);
        if (level === 'error') {
            this.onError?.(entry);
        }

        // Check if we should log to console
        if (!this.shouldLog(level)) return;
        if (this.isProduction() && !this.consoleInProduction && level !== 'error') return;

        // Format and log to console
        const formattedMessage = this.formatMessage(category, message);

        switch (level) {
            case 'debug':
                if (data !== undefined) {
                    console.debug(formattedMessage, data);
                } else {
                    console.debug(formattedMessage);
                }
                break;
            case 'info':
                if (data !== undefined) {
                    console.info(formattedMessage, data);
                } else {
                    console.info(formattedMessage);
                }
                break;
            case 'warn':
                if (data !== undefined) {
                    console.warn(formattedMessage, data);
                } else {
                    console.warn(formattedMessage);
                }
                break;
            case 'error':
                if (data !== undefined) {
                    console.error(formattedMessage, data);
                } else {
                    console.error(formattedMessage);
                }
                break;
        }
    }

    /**
     * Convenience methods
     */
    debug(category: string, message: string, data?: unknown): void {
        this.log('debug', category, message, data);
    }

    info(category: string, message: string, data?: unknown): void {
        this.log('info', category, message, data);
    }

    warn(category: string, message: string, data?: unknown): void {
        this.log('warn', category, message, data);
    }

    error(category: string, message: string, data?: unknown): void {
        this.log('error', category, message, data);
    }

    /**
     * Get recent logs for debugging
     */
    getRecentLogs(count?: number): LogEntry[] {
        const n = count || this.maxBufferSize;
        return this.logBuffer.slice(-n);
    }

    /**
     * Get logs filtered by level
     */
    getLogsByLevel(level: LogLevel): LogEntry[] {
        return this.logBuffer.filter(entry => entry.level === level);
    }

    /**
     * Get logs filtered by category
     */
    getLogsByCategory(category: string): LogEntry[] {
        return this.logBuffer.filter(entry => entry.category === category);
    }

    /**
     * Clear all buffered logs
     */
    clearLogs(): void {
        this.logBuffer = [];
    }

    /**
     * Export logs as JSON for debugging
     */
    exportLogs(): string {
        return JSON.stringify(this.logBuffer, null, 2);
    }

    /**
     * Set minimum log level
     */
    setMinLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    /**
     * Enable/disable console logging in production
     */
    setConsoleInProduction(enabled: boolean): void {
        this.consoleInProduction = enabled;
    }
}

/**
 * Get the singleton logger instance
 */
export const logger = Logger.getInstance();

/**
 * Expose to window for debugging in browser console
 */
if (typeof window !== 'undefined') {
    (window as unknown as { __iamtLogger: Logger }).__iamtLogger = logger;
}
