import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GunDatabaseAdapter } from '@/adapters/database/gun';

// Mock Gun.js
const mockGunChain = {
    get: vi.fn().mockReturnThis(),
    map: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    put: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
};

const mockGunConstructor = vi.fn(() => mockGunChain);

vi.mock('gun', () => {
    return {
        default: mockGunConstructor
    };
});

describe('GunDatabaseAdapter', () => {
    let db: GunDatabaseAdapter;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset chainable mocks return values if needed
        mockGunChain.get.mockReturnThis();
        mockGunChain.map.mockReturnThis();
        mockGunChain.once.mockReturnThis();
        mockGunChain.put.mockReturnThis();
        mockGunChain.on.mockReturnThis();

        db = new GunDatabaseAdapter();

        // Ensure initialized to avoid ensureGun delay during tests
        // Access private method ensureGun via proper casting or simply invoke it via public method interaction
        // checking the source, ensureGun has a 1000ms delay on first init.
        const initPromise = (db as any).ensureGun();
        await initPromise;

        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('initialization', () => {
        it('should initialize gun instance', async () => {
            expect(mockGunConstructor).toHaveBeenCalled();
        });

        it('should generate a device ID', () => {
            const deviceId = db.getDeviceId();
            expect(deviceId).toMatch(/^device-\d+-[a-z0-9]+$/);
        });
    });

    describe('get', () => {
        it('should retrieve data from path', async () => {
            const testData = { key: 'value', _: 'metadata' };

            // Mock implementation of once to call the callback
            mockGunChain.once.mockImplementation((cb) => {
                cb(testData, 'someKey');
                return mockGunChain;
            });

            const promise = db.get('test/path');

            // Allow microtasks to run (once is called)
            await Promise.resolve();

            vi.runAllTimers(); // Advance timers to trigger the resolve timeout (2000ms)

            const result = await promise;
            // The adapter filters out the '_' key
            expect(result).toEqual({ someKey: { key: 'value' } });
        });

        it('should return null if no data found', async () => {
            mockGunChain.once.mockImplementation((cb) => {
                // No data
                return mockGunChain;
            });

            const promise = db.get('test/path');
            await Promise.resolve();
            vi.runAllTimers();

            const result = await promise;
            expect(result).toBeNull();
        });
    });

    describe('set', () => {
        it('should put data to path', async () => {
            mockGunChain.put.mockImplementation((val, cb) => {
                if (cb) cb({ err: undefined }); // Success ack
                return mockGunChain;
            });

            const promise = db.set('test/path', 'key1', { foo: 'bar' });
            await Promise.resolve();
            vi.runAllTimers(); // Trigger timeout if put calls cb async or the 5000ms timeout fallback

            await promise;
            expect(mockGunChain.put).toHaveBeenCalledWith({ foo: 'bar' }, expect.any(Function));
        });
    });

    describe('delete', () => {
        it('should put null to path', async () => {
            mockGunChain.put.mockImplementation((val, cb) => {
                if (cb) cb();
                return mockGunChain;
            });

            await db.delete('test/path', 'key1');
            expect(mockGunChain.put).toHaveBeenCalledWith(null, expect.any(Function));
        });
    });

    describe('exists', () => {
        it('should return true if data exists', async () => {
            mockGunChain.once.mockImplementation((cb) => {
                cb({ some: 'data' });
                return mockGunChain;
            });

            const exists = await db.exists('test/path', 'key1');
            expect(exists).toBe(true);
        });

        it('should return false if data is null', async () => {
            mockGunChain.once.mockImplementation((cb) => {
                cb(null);
                return mockGunChain;
            });

            const exists = await db.exists('test/path', 'key1');
            expect(exists).toBe(false);
        });
    });

    describe('subscribe', () => {
        it('should call callback on updates', async () => {
            mockGunChain.on.mockImplementation((cb) => {
                // Simulate update
                cb({ val: 123, _: 'meta' }, 'key1');
                return mockGunChain;
            });

            const callback = vi.fn();
            db.subscribe('test/path', callback);

            // Wait for ensureGun.then to run
            await Promise.resolve();
            await Promise.resolve(); // Extra tick for safety

            vi.runAllTimers(); // Trigger debounce (100ms)

            expect(callback).toHaveBeenCalledWith({ key1: { val: 123 } });
        });
    });
});
