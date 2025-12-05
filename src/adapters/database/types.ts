/**
 * Database Adapter Interface
 * 
 * Provides a unified interface for data persistence operations.
 * Implementations can target Gun.js, Ceramic Network, or local storage.
 * 
 * @example
 * ```typescript
 * const db = new GunDatabaseAdapter();
 * await db.set('users/alice', { name: 'Alice' });
 * const user = await db.get('users/alice');
 * ```
 */
export interface DatabaseAdapter {
    /**
     * Get data from a path
     * @param path - Data path (e.g., 'users/alice')
     * @returns Promise with data or null if not found
     */
    get<T>(path: string): Promise<T | null>;

    /**
     * Set data at a path
     * @param path - Data path
     * @param data - Data to store
     */
    set<T>(path: string, data: T): Promise<void>;

    /**
     * Subscribe to real-time updates at a path
     * @param path - Data path to watch
     * @param callback - Function called when data changes
     * @returns Unsubscribe function
     */
    subscribe<T>(path: string, callback: (data: T | null) => void): () => void;

    /**
     * Delete data at a path
     * @param path - Data path
     */
    delete(path: string): Promise<void>;

    /**
     * Check if data exists at a path
     * @param path - Data path
     */
    exists(path: string): Promise<boolean>;
}

/**
 * Query options for filtering data
 */
export interface QueryOptions {
    /** Filter by field value */
    where?: Record<string, unknown>;
    /** Maximum number of results */
    limit?: number;
    /** Order by field */
    orderBy?: string;
    /** Order direction */
    orderDirection?: 'asc' | 'desc';
}
