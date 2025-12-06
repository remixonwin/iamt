import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getKeyring } from '@/shared/utils/keyring';
import 'fake-indexeddb/auto';

describe('LocalKeyring', () => {
    const keyring = getKeyring();

    beforeEach(async () => {
        await keyring.clearAll();
    });

    it('should store and retrieve a key', async () => {
        const fileId = 'cid123';
        const key = 'base64key';
        const iv = 'base64iv';
        const fileName = 'test.txt';
        const mimeType = 'text/plain';

        await keyring.storeKey(fileId, key, iv, fileName, mimeType);

        const hasKey = await keyring.hasKey(fileId);
        expect(hasKey).toBe(true);

        const entry = await keyring.getKey(fileId);
        expect(entry).not.toBeNull();
        expect(entry?.fileId).toBe(fileId);
        expect(entry?.key).toBe(key);
        expect(entry?.fileName).toBe(fileName);
    });

    it('should return null for non-existent key', async () => {
        const entry = await keyring.getKey('non-existent');
        expect(entry).toBeNull();
    });

    it('should delete a key', async () => {
        await keyring.storeKey('del-id', 'k', 'i', 'f', 'm');
        expect(await keyring.hasKey('del-id')).toBe(true);

        await keyring.deleteKey('del-id');
        expect(await keyring.hasKey('del-id')).toBe(false);
    });

    it('should export keyring as JSON', async () => {
        await keyring.storeKey('exp1', 'k1', 'i1', 'f1', 'm1');

        const json = await keyring.exportKeyring();
        const data = JSON.parse(json);

        expect(data.version).toBe(1);
        expect(data.keys).toHaveLength(1);
        expect(data.keys[0].fileId).toBe('exp1');
    });

    it('should import keyring from JSON', async () => {
        const backup = JSON.stringify({
            keys: [{
                fileId: 'imp1',
                key: 'k2',
                iv: 'i2',
                fileName: 'f2',
                mimeType: 'm2',
                createdAt: Date.now(),
                isPasswordProtected: false
            }]
        });

        const count = await keyring.importKeyring(backup);
        expect(count).toBe(1);
        expect(await keyring.hasKey('imp1')).toBe(true);
    });

    it('should link file to user and enforce owner access', async () => {
        const fileId = 'owner-test';
        const ownerId = 'did:key:z123';

        await keyring.storeKey(fileId, 'k', 'i', 'f', 'm');
        await keyring.linkFileToUser(fileId, ownerId);

        // Owner should access
        const entry = await keyring.getKey(fileId, ownerId);
        expect(entry).not.toBeNull();
        expect(entry?.ownerId).toBe(ownerId);

        // Non-owner should not access
        const denied = await keyring.getKey(fileId, 'different-user');
        expect(denied).toBeNull();

        // No user specified should access (backwards compatibility)
        const noUser = await keyring.getKey(fileId);
        expect(noUser).not.toBeNull();
    });

    it('should get keys by owner', async () => {
        const ownerId = 'did:key:z456';
        await keyring.storeKey('file1', 'k1', 'i1', 'f1', 'm1');
        await keyring.storeKey('file2', 'k2', 'i2', 'f2', 'm2');
        await keyring.linkFileToUser('file1', ownerId);

        const ownerKeys = await keyring.getKeysByOwner(ownerId);
        expect(ownerKeys).toHaveLength(1);
        expect(ownerKeys[0].fileId).toBe('file1');
    });
});
