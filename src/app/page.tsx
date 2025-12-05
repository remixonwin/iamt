'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileUploader, FilePreview, FileGrid, type UploadedFile, type FileVisibility } from '@/shared/components';
import { WebTorrentStorageAdapter, GunDatabaseAdapter, type GunFileMetadata } from '@/adapters';
import { formatFileSize, getFileTypeInfo } from '@/shared/utils';
import { getKeyring } from '@/shared/utils/keyring';

// P2P Storage server - Use env var or default to public tunnel, fallback to localhost for dev/test
const STORAGE_API = process.env.NEXT_PUBLIC_STORAGE_API || 'http://localhost:3001';

// Initialize storage
const storage = new WebTorrentStorageAdapter(STORAGE_API);

interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
  magnetURI?: string;
  uploadedAt: number;
  deviceId?: string;
  // Privacy fields
  visibility: FileVisibility;
  encrypted: boolean;
  canDecrypt?: boolean;
}

export default function Home() {
  const [uploadQueue, setUploadQueue] = useState<UploadedFile[]>([]);
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'files'>('upload');
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'synced' | 'offline'>('connecting');
  const dbRef = useRef<GunDatabaseAdapter | null>(null);

  // Initialize
  useEffect(() => {
    async function init() {
      try {
        dbRef.current = new GunDatabaseAdapter();
        const db = dbRef.current;
        const keyring = getKeyring();

        // Subscribe to Gun.js for sync
        const unsubscribe = db.subscribe<GunFileMetadata & { magnetURI?: string }>('files', async (syncedFiles) => {
          setSyncStatus('synced');

          const files: StoredFile[] = await Promise.all(
            Object.values(syncedFiles)
              .filter((meta) => meta && meta.id)
              .map(async (meta) => {
                // Check if we can decrypt this file
                const canDecrypt = meta.encrypted ? await keyring.hasKey(meta.id) : true;

                return {
                  id: meta.id,
                  name: meta.name,
                  size: meta.size,
                  type: meta.originalType || meta.type,
                  uploadedAt: meta.createdAt,
                  deviceId: meta.deviceId,
                  magnetURI: meta.magnetURI,
                  visibility: meta.visibility || 'public',
                  encrypted: meta.encrypted || false,
                  canDecrypt,
                };
              })
          );

          setStoredFiles(files);
        });

        setTimeout(() => {
          setSyncStatus('synced');
          setIsLoading(false);
        }, 1500);

        return () => unsubscribe();
      } catch (err) {
        console.error('Initialization failed:', err);
        // Fallback so app still loads
        setIsLoading(false);
        setSyncStatus('offline');
      }
    }

    init();
  }, []);

  const handleFilesSelected = useCallback((files: UploadedFile[]) => {
    setUploadQueue((prev) => [...prev, ...files]);
    files.forEach((uploadedFile) => uploadFile(uploadedFile));
  }, []);

  const uploadFile = async (uploadedFile: UploadedFile) => {
    const { id, file, visibility, password } = uploadedFile;
    const db = dbRef.current;

    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress < 80) {
        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, progress, status: 'uploading' as const } : f
          )
        );
      }
    }, 200);

    try {
      // Upload to WebTorrent server (with encryption if private/password-protected)
      const result = await storage.upload(file, {
        visibility,
        password,
      });

      clearInterval(progressInterval);

      setUploadQueue((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, progress: 100, status: 'complete' as const } : f
        )
      );

      // Sync to Gun.js (includes magnet URI and encryption metadata!)
      const metadata: GunFileMetadata & { magnetURI?: string } = {
        id: result.cid,
        name: file.name,
        size: file.size,
        type: visibility !== 'public' ? 'application/octet-stream' : file.type,
        createdAt: Date.now(),
        deviceId: db?.getDeviceId() || 'unknown',
        magnetURI: result.url,
        // Privacy/encryption fields
        visibility: result.visibility,
        encrypted: result.visibility !== 'public',
        encryptionIv: result.encryptionMetadata?.iv,
        encryptionSalt: result.encryptionMetadata?.salt,
        originalType: file.type,
      };

      if (db) {
        await db.set('files', result.cid, metadata);
      }

      setStoredFiles((prev) => [...prev, {
        id: metadata.id,
        name: metadata.name,
        size: metadata.size,
        type: metadata.originalType || metadata.type,
        uploadedAt: metadata.createdAt,
        magnetURI: metadata.magnetURI,
        visibility: metadata.visibility,
        encrypted: metadata.encrypted,
        canDecrypt: true, // We just uploaded it, so we can decrypt it
      }]);

      setTimeout(() => {
        setUploadQueue((prev) => prev.filter((f) => f.id !== id));
      }, 1500);

    } catch (error) {
      clearInterval(progressInterval);
      console.error('Upload failed:', error);
      setUploadQueue((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: 'error' as const, error: 'Upload failed' } : f
        )
      );
    }
  };

  const handleRemoveFromQueue = (id: string) => {
    setUploadQueue((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDeleteFile = async (id: string) => {
    const db = dbRef.current;
    try {
      await storage.delete(id);
      if (db) await db.delete('files', id);
      setStoredFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handlePreviewFile = async (id: string) => {
    try {
      const file = storedFiles.find(f => f.id === id);

      if (!file) {
        console.error('File not found');
        return;
      }

      let blob: Blob;

      if (file.encrypted) {
        if (!file.canDecrypt) {
          // For password-protected files, prompt for password
          if (file.visibility === 'password-protected') {
            const password = window.prompt('Enter password to decrypt this file:');
            if (!password) return;

            try {
              blob = await storage.downloadWithPassword(id, password);
            } catch (error) {
              alert('Incorrect password or decryption failed');
              console.error('Decryption failed:', error);
              return;
            }
          } else {
            alert('You do not have the key to decrypt this file. Only the owner can access it.');
            return;
          }
        } else {
          // We have the key, decrypt
          blob = await storage.downloadAndDecrypt(id);
        }
      } else {
        // Public file, download directly
        blob = await storage.download(id);
      }

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Download/Decryption failed:', error);
      alert('Failed to open file. ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const totalSize = storedFiles.reduce((acc, f) => acc + f.size, 0);
  const filesByType = storedFiles.reduce((acc, f) => {
    const info = getFileTypeInfo({ type: f.type } as File);
    acc[info.category] = (acc[info.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const syncStatusColor = {
    connecting: 'bg-yellow-500',
    synced: 'bg-[var(--success)]',
    offline: 'bg-[var(--error)]',
  };

  return (
    <main className="gradient-bg min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <div className="inline-block mb-4 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)]">
            <span className="text-sm font-medium text-[var(--accent-light)]">
              🌐 P2P Torrent Storage
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">IAMT</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            Files shared via WebTorrent. Download from any device using magnet links.
          </p>
        </div>

        <div className="glass-card p-4 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold">{storedFiles.length}</p>
                <p className="text-xs text-gray-500">Files</p>
              </div>
              <div className="h-8 w-px bg-[var(--border)]" />
              <div>
                <p className="text-2xl font-bold">{formatFileSize(totalSize)}</p>
                <p className="text-xs text-gray-500">Seeding</p>
              </div>
              <div className="h-8 w-px bg-[var(--border)]" />
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${syncStatusColor[syncStatus]} ${syncStatus === 'connecting' ? 'animate-pulse' : ''}`} />
                <span className="text-xs text-gray-500 capitalize">{syncStatus}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {Object.entries(filesByType).map(([type, count]) => (
                <span key={type} className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--surface)]">
                  {count} {type}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'upload' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-gray-400 hover:text-white'
              }`}
          >
            Upload
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'files' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-gray-400 hover:text-white'
              }`}
          >
            My Files ({storedFiles.length})
          </button>
        </div>

        <div className="glass-card glow p-8">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              <p className="text-gray-400">Connecting to P2P network...</p>
            </div>
          ) : activeTab === 'upload' ? (
            <div className="space-y-6">
              <FileUploader onFilesSelected={handleFilesSelected} />

              {uploadQueue.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-400">Uploading & Seeding...</h3>
                  {uploadQueue.map((file) => (
                    <FilePreview key={file.id} uploadedFile={file} onRemove={handleRemoveFromQueue} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <FileGrid files={storedFiles} onDelete={handleDeleteFile} onPreview={handlePreviewFile} />
          )}
        </div>

        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>P2P via WebTorrent • Synced via Gun.js • Local storage server</p>
        </footer>
      </div>
    </main>
  );
}
