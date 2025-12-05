import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockDatabaseAdapter } from '@/adapters';

describe('DatabaseAdapter', () => {
    let db: MockDatabaseAdapter;

    beforeEach(() => {
        db = new MockDatabaseAdapter();
        db.clear();
    });

    describe('set and get', () => {
        it('should store and retrieve data', async () => {
            const user = { name: 'Alice', age: 30 };

            await db.set('users/alice', user);
            const result = await db.get<typeof user>('users/alice');

            expect(result).toEqual(user);
        });

        it('should return null for non-existent path', async () => {
            const result = await db.get('non/existent/path');

            expect(result).toBeNull();
        });

        it('should overwrite existing data', async () => {
            await db.set('users/alice', { name: 'Alice' });
            await db.set('users/alice', { name: 'Alice Updated' });

            const result = await db.get<{ name: string }>('users/alice');

            expect(result?.name).toBe('Alice Updated');
        });
    });

    describe('subscribe', () => {
        it('should immediately call callback with current value', async () => {
            await db.set('test/path', { value: 42 });
            const callback = vi.fn();

            db.subscribe('test/path', callback);

            expect(callback).toHaveBeenCalledWith({ value: 42 });
        });

        it('should call callback with null for non-existent path', () => {
            const callback = vi.fn();

            db.subscribe('empty/path', callback);

            expect(callback).toHaveBeenCalledWith(null);
        });

        it('should notify on data changes', async () => {
            const callback = vi.fn();
            db.subscribe('test/path', callback);

            await db.set('test/path', { value: 100 });

            expect(callback).toHaveBeenCalledTimes(2); // initial null + update
            expect(callback).toHaveBeenLastCalledWith({ value: 100 });
        });

        it('should stop notifying after unsubscribe', async () => {
            const callback = vi.fn();
            const unsubscribe = db.subscribe('test/path', callback);

            unsubscribe();
            await db.set('test/path', { value: 999 });

            expect(callback).toHaveBeenCalledTimes(1); // only initial call
        });
    });

    describe('exists', () => {
        it('should return true for existing data', async () => {
            await db.set('test/path', { data: true });

            expect(await db.exists('test/path')).toBe(true);
        });

        it('should return false for non-existent data', async () => {
            expect(await db.exists('fake/path')).toBe(false);
        });
    });

    describe('delete', () => {
        it('should remove data from database', async () => {
            await db.set('test/path', { temp: true });

            await db.delete('test/path');

            expect(await db.exists('test/path')).toBe(false);
        });

        it('should notify subscribers of deletion', async () => {
            await db.set('test/path', { value: 1 });
            const callback = vi.fn();
            db.subscribe('test/path', callback);

            await db.delete('test/path');

            expect(callback).toHaveBeenLastCalledWith(null);
        });
    });
});
