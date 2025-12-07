/**
 * Retry Utility
 * 
 * Provides retry functionality with exponential backoff for async operations.
 * Used to improve resilience for Gun.js and P2P network operations.
 */

import { logger, LogCategory } from './logger';
import { SYNC_CONFIG } from '@/shared/config';

export interface RetryOptions {
    /** Maximum number of retry attempts */
    maxAttempts?: number;
    /** Base delay between retries in ms */
    baseDelayMs?: number;
    /** Whether to use exponential backoff */
    exponentialBackoff?: boolean;
    /** Maximum delay cap in ms */
    maxDelayMs?: number;
    /** Category for logging */
    logCategory?: string;
    /** Operation name for logging */
    operationName?: string;
    /** Custom condition to determine if error is retryable */
    isRetryable?: (error: Error) => boolean;
    /** Callback on each retry */
    onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: SYNC_CONFIG.gun.retryAttempts,
    baseDelayMs: SYNC_CONFIG.gun.retryDelayMs,
    exponentialBackoff: true,
    maxDelayMs: 10000,
    logCategory: LogCategory.SYNC,
    operationName: 'Operation',
    isRetryable: () => true,
    onRetry: () => { },
};

/**
 * Execute an async function with retry logic
 * 
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Promise with the function result
 * @throws Last error if all retries fail
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Check if we should retry
            if (attempt >= opts.maxAttempts || !opts.isRetryable(lastError)) {
                break;
            }

            // Calculate delay with exponential backoff
            let delay = opts.baseDelayMs;
            if (opts.exponentialBackoff) {
                delay = opts.baseDelayMs * Math.pow(2, attempt - 1);
            }
            // Add jitter (±20%)
            delay = delay * (0.8 + Math.random() * 0.4);
            delay = Math.min(delay, opts.maxDelayMs);

            logger.warn(opts.logCategory, `${opts.operationName} failed, retrying`, {
                attempt,
                maxAttempts: opts.maxAttempts,
                delayMs: Math.round(delay),
                error: lastError.message,
            });

            opts.onRetry(attempt, lastError, delay);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // All retries exhausted
    logger.error(opts.logCategory, `${opts.operationName} failed after ${opts.maxAttempts} attempts`, lastError);
    throw lastError;
}

/**
 * Create a retryable version of an async function
 * 
 * @param fn - Async function to wrap
 * @param options - Retry configuration
 * @returns Wrapped function with retry logic
 */
export function makeRetryable<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    options?: RetryOptions
): (...args: TArgs) => Promise<TResult> {
    return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Common retry configurations
 */
export const RetryPresets = {
    /** For Gun.js database operations */
    gunOperation: {
        maxAttempts: SYNC_CONFIG.gun.retryAttempts,
        baseDelayMs: SYNC_CONFIG.gun.retryDelayMs,
        logCategory: LogCategory.GUN,
        operationName: 'Gun.js operation',
    } as RetryOptions,

    /** For P2P file downloads */
    p2pDownload: {
        maxAttempts: SYNC_CONFIG.p2p.retryAttempts,
        baseDelayMs: 2000,
        maxDelayMs: 15000,
        logCategory: LogCategory.P2P,
        operationName: 'P2P download',
    } as RetryOptions,

    /** For authentication operations */
    auth: {
        maxAttempts: 2,
        baseDelayMs: 500,
        logCategory: LogCategory.AUTH,
        operationName: 'Auth operation',
        // Don't retry auth errors that are user-caused
        isRetryable: (error: Error) => {
            const message = error.message.toLowerCase();
            return !message.includes('wrong') &&
                !message.includes('invalid') &&
                !message.includes('not found');
        },
    } as RetryOptions,

    /** Quick retry for network hiccups */
    quick: {
        maxAttempts: 2,
        baseDelayMs: 200,
        exponentialBackoff: false,
    } as RetryOptions,
} as const;
