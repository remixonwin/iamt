'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { FileUploader, FilePreview, FileGrid, FileViewer, type UploadedFile, type FileVisibility, NavigationHeader } from '@/shared/components';
import { WebTorrentStorageAdapter, GunDatabaseAdapter, type GunFileMetadata } from '@/adapters';
import { formatFileSize, getFileTypeInfo } from '@/shared/utils';
import { getKeyring } from '@/shared/utils/keyring';
import { useAuth } from '@/shared/contexts/AuthContext';

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
  ownerId?: string;
  ownerName?: string;
  ownerAvatarId?: string;
  // Privacy fields
  visibility: FileVisibility;
  encrypted: boolean;
  canDecrypt?: boolean;
  // Deduplication fields
  contentHash?: string;
  deduplicated?: boolean;
}

export default function Home() {
  const { user, isAuthenticated, gunUser } = useAuth();
  const [uploadQueue, setUploadQueue] = useState<UploadedFile[]>([]);
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'public' | 'my-files'>('upload');
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'synced' | 'offline'>('connecting');
  const [viewerData, setViewerData] = useState<{ file: StoredFile; blob: Blob } | null>(null);
  const dbRef = useRef<GunDatabaseAdapter | null>(null);

  // Initialize
  useEffect(() => {
    async function init() {
      try {
        dbRef.current = new GunDatabaseAdapter();
        const db = dbRef.current;
        const keyring = getKeyring();

        // Load from localStorage backup IMMEDIATELY (works even without relay)
        const backupFiles = db.loadFromLocalBackup();

        // Also load user-specific files if authenticated
        const userBackupFiles = user?.did ? db.loadUserFilesBackup(user.did) : {};
        const allBackupFiles = { ...backupFiles, ...userBackupFiles };

        let initialFiles: StoredFile[] = [];

        // 1. Load Local Backup
        if (Object.keys(allBackupFiles).length > 0) {
          console.log('[Page] Loading files from localStorage backup:', Object.keys(allBackupFiles).length);
          const filesFromBackup: StoredFile[] = await Promise.all(
            Object.values(allBackupFiles)
              .filter((meta) => meta && meta.id)
              .map(async (meta) => ({
                id: meta.id,
                name: meta.name,
                size: meta.size,
                type: meta.originalType || meta.type,
                uploadedAt: meta.createdAt,
                deviceId: meta.deviceId,
                ownerId: meta.ownerId,
                magnetURI: (meta as GunFileMetadata & { magnetURI?: string }).magnetURI,
                visibility: meta.visibility || 'public',
                encrypted: meta.encrypted || false,
                canDecrypt: meta.encrypted ? await keyring.hasKey(meta.id) : true,
              }))
          );
          initialFiles = filesFromBackup;
          setStoredFiles(filesFromBackup);
          setIsLoading(false);
        }

        // 2. Subscribe to User's personal file graph for cross-device sync
        let unsubscribeUser = () => { };
        if (isAuthenticated && user && gunUser) {
          console.log('[Page] Subscribing to user file graph for cross-device sync');
          unsubscribeUser = db.subscribeUserFiles(gunUser, async (userFiles) => {
            console.log('[Page] User files synced:', Object.keys(userFiles).length);

            // Merge with current files, prioritizing user graph data
            setStoredFiles((prev) => {
              const existingIds = new Set(prev.map(f => f.id));
              const newUserFiles = Object.values(userFiles)
                .filter((meta) => meta && meta.id && !existingIds.has(meta.id))
                .map((meta) => ({
                  id: meta.id,
                  name: meta.name,
                  size: meta.size,
                  type: meta.originalType || meta.type,
                  uploadedAt: meta.createdAt,
                  deviceId: meta.deviceId,
                  ownerId: meta.ownerId,
                  magnetURI: (meta as GunFileMetadata & { magnetURI?: string }).magnetURI,
                  visibility: meta.visibility || 'public',
                  encrypted: meta.encrypted || false,
                  canDecrypt: true, // Will check async when rendering
                }));
              return [...prev, ...newUserFiles];
            });
          });
        }

        // 3. Subscribe to Gun.js global graph for public files
        const unsubscribe = db.subscribe<GunFileMetadata & { magnetURI?: string }>('files', async (syncedFiles) => {
          setSyncStatus('synced');

          // Merge Gun.js data with localStorage backup
          const mergedFiles = { ...allBackupFiles, ...syncedFiles };

          const files: StoredFile[] = await Promise.all(
            Object.values(mergedFiles)
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
                  ownerId: meta.ownerId,
                  ownerName: meta.ownerName,
                  ownerAvatarId: meta.ownerAvatarId,
                  magnetURI: (meta as GunFileMetadata & { magnetURI?: string }).magnetURI,
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

        return () => {
          unsubscribe();
          unsubscribeUser();
        };
      } catch (err) {
        console.error('Initialization failed:', err);
        // Fallback so app still loads
        setIsLoading(false);
        setSyncStatus('offline');
      }
    }

    init();
  }, [isAuthenticated, user, gunUser]);

  const handleFilesSelected = useCallback((files: UploadedFile[]) => {
    setUploadQueue((prev) => [...prev, ...files]);
    files.forEach((uploadedFile) => uploadFile(uploadedFile));
  }, [isAuthenticated, user, gunUser]); // Add dependencies

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
        originalType: file.type,
        // Deduplication fields
        contentHash: result.contentHash,
        deduplicated: result.deduplicated,
        // Owner info for attribution
        ownerId: user?.did,
        ownerName: user?.displayName || user?.email?.split('@')[0],
        ownerAvatarId: user?.avatarId,
      };

      // Only add encryption metadata if present (Gun.js rejects undefined values)
      if (result.encryptionMetadata?.iv) {
        metadata.encryptionIv = result.encryptionMetadata.iv;
      }
      if (result.encryptionMetadata?.salt) {
        metadata.encryptionSalt = result.encryptionMetadata.salt;
      }

      if (db) {
        // If authenticated, save to User Graph for cross-device sync
        if (isAuthenticated && user && gunUser) {
          console.log('[Upload] Saving to user graph for cross-device sync');
          await db.saveUserFile(metadata, gunUser, user.did);
          // Link encryption key to owner for access control
          if (metadata.encrypted) {
            const keyring = getKeyring();
            await keyring.linkFileToUser(result.cid, user.did);
          }
        } else {
          // Not authenticated - save to device-local global graph only
          await db.set('files', result.cid, metadata);
        }
      } else {
        console.warn('[Upload] Database not initialized - file metadata may not persist across sessions');
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
        contentHash: metadata.contentHash,
        deduplicated: metadata.deduplicated,
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
      // Find the file to get its contentHash for reference counting
      const fileToDelete = storedFiles.find(f => f.id === id);
      await storage.delete(id, fileToDelete?.contentHash);
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
        // Password-protected files always need password input
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
        } else if (!file.canDecrypt) {
          // Private file but we don't have the key
          alert('You do not have the key to decrypt this file. Only the owner can access it.');
          return;
        } else {
          // Private file and we have the key
          try {
            blob = await storage.downloadAndDecrypt(id, user?.did);
          } catch (error) {
            // If it fails, might be password-protected that was mislabeled
            if (error instanceof Error && error.message.includes('password-protected')) {
              const password = window.prompt('Enter password to decrypt this file:');
              if (!password) return;
              try {
                blob = await storage.downloadWithPassword(id, password, user?.did);
              } catch {
                alert('Incorrect password or decryption failed');
                return;
              }
            } else {
              throw error;
            }
          }
        }
      } else {
        // Public file, download directly
        blob = await storage.download(id);
      }

      // Open in-page viewer instead of downloading
      setViewerData({ file, blob });
    } catch (error) {
      console.error('Download/Decryption failed:', error);
      alert('Failed to open file. ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const totalSize = storedFiles.reduce((acc, f) => acc + f.size, 0);

  const publicImages = storedFiles.filter((f) => {
    if (f.visibility !== 'public') return false;
    const info = getFileTypeInfo({ type: f.type } as File);
    return info.category === 'image';
  });

  const myFiles = storedFiles.filter((f) => {
    if (user?.did && f.ownerId) {
      return f.ownerId === user.did;
    }
    return f.deviceId === dbRef.current?.getDeviceId();
  });

  const filesByType = publicImages.reduce((acc, f) => {
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
      {/* Navigation Header */}
      <NavigationHeader />

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
            onClick={() => setActiveTab('public')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'public' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-gray-400 hover:text-white'
              }`}
          >
            Public Images ({publicImages.length})
          </button>
          <button
            onClick={() => setActiveTab('my-files')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'my-files' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface)] text-gray-400 hover:text-white'
              }`}
          >
            My Files ({myFiles.length})
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
          ) : activeTab === 'public' ? (
            <FileGrid files={publicImages} onDelete={handleDeleteFile} onPreview={handlePreviewFile} />
          ) : (
            <FileGrid files={myFiles} onDelete={handleDeleteFile} onPreview={handlePreviewFile} />
          )}
        </div>

        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>P2P via WebTorrent • Synced via Gun.js • Local storage server</p>
        </footer>
      </div>

      {/* File Viewer Modal */}
      {viewerData && (
        <FileViewer
          file={viewerData.file}
          blob={viewerData.blob}
          onClose={() => setViewerData(null)}
        />
      )}
    </main>
  );
}
