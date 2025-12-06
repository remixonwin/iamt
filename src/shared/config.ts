/**
 * Application Configuration
 * 
 * Centralized configuration for timeouts, retries, and other settings.
 */

export const SYNC_CONFIG = {
    gun: {
        /** Time to wait for Gun.js initialization (ms) */
        initializationTimeout: 3000,
        /** Time to wait for data operations (ms) */
        operationTimeout: 5000,
        /** Number of retry attempts for failed operations */
        retryAttempts: 3,
        /** Base delay between retries (ms) - will be multiplied by attempt number */
        retryDelayMs: 1000,
        /** Time to wait for data gathering in subscriptions (ms) */
        dataGatherTimeout: 2000,
    },
    p2p: {
        /** Time to wait for P2P downloads (ms) */
        downloadTimeout: 15000,
        /** Number of retry attempts for failed downloads */
        retryAttempts: 2,
    },
    localStorage: {
        /** Maximum backup size (bytes) */
        maxBackupSize: 10 * 1024 * 1024, // 10MB
    },
    logging: {
        /** Maximum number of log entries to keep in memory */
        maxBufferSize: 100,
        /** Whether to log to console in production */
        consoleInProduction: false,
        /** Log level: 'debug' | 'info' | 'warn' | 'error' */
        minLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    },
};

export type SyncConfig = typeof SYNC_CONFIG;
