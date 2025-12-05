'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileUploader, FilePreview, FileGrid, type UploadedFile } from '@/shared/components';
import { IndexedDBStorageAdapter, GunDatabaseAdapter, type GunFileMetadata } from '@/adapters';
import { formatFileSize, getFileTypeInfo } from '@/shared/utils';

// Initialize adapters
const storage = new IndexedDBStorageAdapter();

interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
  uploadedAt: number;
  deviceId?: string;
}

export default function Home() {
  const [uploadQueue, setUploadQueue] = useState<UploadedFile[]>([]);
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'files'>('upload');
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'synced' | 'offline'>('connecting');
  const dbRef = useRef<GunDatabaseAdapter | null>(null);

  // Load files and set up sync
  useEffect(() => {
    async function init() {
      // Initialize Gun.js adapter (client-side only)
      dbRef.current = new GunDatabaseAdapter();
      const db = dbRef.current;

      // Load local files from IndexedDB
      try {
        const localFiles = await storage.getAllFiles();
        const localFileMap = new Map(localFiles.map(f => [f.id, f]));

        // Subscribe to Gun.js for real-time sync
        const unsubscribe = db.subscribe<GunFileMetadata>('files', (syncedFiles) => {
          setSyncStatus('synced');

          // Merge synced metadata with local files
          const merged: StoredFile[] = [];

          Object.values(syncedFiles).forEach((meta) => {
            if (meta && meta.id) {
              const localFile = localFileMap.get(meta.id);
              merged.push({
                id: meta.id,
                name: meta.name,
                size: meta.size,
                type: meta.type,
                uploadedAt: meta.createdAt,
                deviceId: meta.deviceId,
                preview: localFile?.preview, // Use local preview if available
              });
            }
          });

          // Also include local-only files not yet synced
          localFiles.forEach((local) => {
            if (!syncedFiles[local.id]) {
              merged.push({
                id: local.id,
                name: local.name,
                size: local.size,
                type: local.type,
                uploadedAt: local.createdAt,
                preview: local.preview,
              });
            }
          });

          setStoredFiles(merged);
        });

        // Initial load
        setTimeout(() => {
          if (syncStatus === 'connecting') {
            setSyncStatus('synced');
          }
          setIsLoading(false);
        }, 1000);

        return () => unsubscribe();
      } catch (error) {
        console.error('Failed to initialize:', error);
        setSyncStatus('offline');
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // Handle new files selected
  const handleFilesSelected = useCallback((files: UploadedFile[]) => {
    setUploadQueue((prev) => [...prev, ...files]);
    files.forEach((uploadedFile) => {
      uploadFile(uploadedFile);
    });
  }, []);

  // Upload file to IndexedDB and sync metadata to Gun.js
  const uploadFile = async (uploadedFile: UploadedFile) => {
    const { id, file } = uploadedFile;
    const db = dbRef.current;

    // Simulate progress while uploading
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 20 + 10;
      if (progress < 90) {
        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, progress, status: 'uploading' as const } : f
          )
        );
      }
    }, 100);

    try {
      // Store in IndexedDB
      const result = await storage.upload(file);

      clearInterval(progressInterval);

      // Mark complete
      setUploadQueue((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, progress: 100, status: 'complete' as const } : f
        )
      );

      // Create metadata for Gun.js sync
      const metadata: GunFileMetadata = {
        id: result.cid,
        name: file.name,
        size: file.size,
        type: file.type,
        createdAt: Date.now(),
        deviceId: db?.getDeviceId() || 'unknown',
      };

      // Sync to Gun.js (will propagate to other devices)
      if (db) {
        await db.set('files', result.cid, metadata);
      }

      // Add to local state
      const newStoredFile: StoredFile = {
        id: result.cid,
        name: file.name,
        size: file.size,
        type: file.type,
        preview: uploadedFile.preview,
        uploadedAt: Date.now(),
        deviceId: db?.getDeviceId(),
      };

      setStoredFiles((prev) => [...prev, newStoredFile]);

      // Remove from queue
      setTimeout(() => {
        setUploadQueue((prev) => prev.filter((f) => f.id !== id));
      }, 1500);

    } catch (error) {
      clearInterval(progressInterval);
      setUploadQueue((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: 'error' as const, error: 'Upload failed' } : f
        )
      );
    }
  };

  // Remove from queue
  const handleRemoveFromQueue = (id: string) => {
    setUploadQueue((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  // Delete file
  const handleDeleteFile = async (id: string) => {
    const db = dbRef.current;
    try {
      await storage.delete(id);
      if (db) {
        await db.delete('files', id);
      }
      setStoredFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  // Preview file
  const handlePreviewFile = async (id: string) => {
    try {
      const blob = await storage.download(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      // File might be from another device, not stored locally
      console.error('File not available locally:', error);
      alert('This file is from another device and not available locally.');
    }
  };

  // Stats
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
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block mb-4 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)]">
            <span className="text-sm font-medium text-[var(--accent-light)]">
              🌐 P2P Synced Storage
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">IAMT</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            Upload files. They sync across all your devices in real-time.
          </p>
        </div>

        {/* Stats Bar */}
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
                <p className="text-xs text-gray-500">Total Size</p>
              </div>
              <div className="h-8 w-px bg-[var(--border)]" />
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${syncStatusColor[syncStatus]} ${syncStatus === 'connecting' ? 'animate-pulse' : ''}`} />
                <span className="text-xs text-gray-500 capitalize">{syncStatus}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {Object.entries(filesByType).map(([type, count]) => (
                <span
                  key={type}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--surface)]"
                >
                  {count} {type}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'upload'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface)] text-gray-400 hover:text-white'
              }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Upload
            </span>
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${activeTab === 'files'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface)] text-gray-400 hover:text-white'
              }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                />
              </svg>
              My Files ({storedFiles.length})
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="glass-card glow p-8">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              <p className="text-gray-400">Connecting to sync network...</p>
            </div>
          ) : activeTab === 'upload' ? (
            <div className="space-y-6">
              <FileUploader onFilesSelected={handleFilesSelected} />

              {uploadQueue.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    Uploading {uploadQueue.length} file{uploadQueue.length !== 1 ? 's' : ''}
                  </h3>
                  {uploadQueue.map((file) => (
                    <FilePreview
                      key={file.id}
                      uploadedFile={file}
                      onRemove={handleRemoveFromQueue}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <FileGrid
              files={storedFiles}
              onDelete={handleDeleteFile}
              onPreview={handlePreviewFile}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>
            P2P sync via Gun.js • Local storage via IndexedDB •
            <a href="https://github.com/remixonwin/iamt" className="text-[var(--accent)] hover:underline ml-1">
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
