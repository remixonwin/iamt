import type { DatabaseAdapter } from './types';

/**
 * Mock Database Adapter for testing
 * 
 * Stores data in memory. Use this adapter in tests to avoid
 * hitting real Gun.js/Ceramic services.
 * 
 * @example
 * ```typescript
 * const db = new MockDatabaseAdapter();
 * await db.set('users/alice', { name: 'Alice' });
 * const user = await db.get('users/alice');
 * expect(user.name).toBe('Alice');
 * ```
 */
export class MockDatabaseAdapter implements DatabaseAdapter {
    private store = new Map<string, unknown>();
    private subscribers = new Map<string, Set<(data: unknown) => void>>();

    async get<T>(path: string): Promise<T | null> {
        const data = this.store.get(path);
        return (data as T) ?? null;
    }

    async set<T>(path: string, data: T): Promise<void> {
        this.store.set(path, data);
        this.notifySubscribers(path, data);
    }

    subscribe<T>(path: string, callback: (data: T | null) => void): () => void {
        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, new Set());
        }

        const pathSubscribers = this.subscribers.get(path)!;
        const wrappedCallback = (data: unknown) => callback(data as T | null);
        pathSubscribers.add(wrappedCallback);

        // Immediately call with current value
        const currentValue = this.store.get(path);
        callback((currentValue as T) ?? null);

        // Return unsubscribe function
        return () => {
            pathSubscribers.delete(wrappedCallback);
        };
    }

    async delete(path: string): Promise<void> {
        this.store.delete(path);
        this.notifySubscribers(path, null);
    }

    async exists(path: string): Promise<boolean> {
        return this.store.has(path);
    }

    private notifySubscribers(path: string, data: unknown): void {
        const pathSubscribers = this.subscribers.get(path);
        if (pathSubscribers) {
            pathSubscribers.forEach((callback) => callback(data));
        }
    }

    /** Clear all stored data (useful between tests) */
    clear(): void {
        this.store.clear();
        this.subscribers.clear();
    }
}
