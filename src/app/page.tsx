'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileUploader, FilePreview, FileGrid, type UploadedFile } from '@/shared/components';
import { PinataStorageAdapter, GunDatabaseAdapter, type GunFileMetadata } from '@/adapters';
import { formatFileSize, getFileTypeInfo } from '@/shared/utils';

// Pinata JWT - In production, use environment variables
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI2NWUzN2I1OC0xM2VlLTQ0ZWItOTEzOC05NTRjZWMyODAwNjciLCJlbWFpbCI6InJlbWl4b253aW5AZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjQyYjJhNTA1NmM3ZTdlZWE3NDlmIiwic2NvcGVkS2V5U2VjcmV0IjoiNzk1NGMyMmFlMDRmNzg4NDE5MDJiY2RhNWZlYTQ3MTQ1ZmYyNDQxYzBhMWQwODc2ZTk2ZmFhNTEyNTg0MmRmMSIsImV4cCI6MTc5NjQzNjc5Mn0.6LdAEHTCcBhhOJfISlszUcC_0e4PvA--co5mmWK1JEw';

// Initialize storage (IPFS via Pinata)
const storage = new PinataStorageAdapter(PINATA_JWT);

interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
  url?: string;
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
      dbRef.current = new GunDatabaseAdapter();
      const db = dbRef.current;

      // Subscribe to Gun.js for real-time sync
      const unsubscribe = db.subscribe<GunFileMetadata & { url?: string }>('files', (syncedFiles) => {
        setSyncStatus('synced');

        const files: StoredFile[] = Object.values(syncedFiles)
          .filter((meta) => meta && meta.id)
          .map((meta) => ({
            id: meta.id,
            name: meta.name,
            size: meta.size,
            type: meta.type,
            uploadedAt: meta.createdAt,
            deviceId: meta.deviceId,
            url: meta.url,
            preview: meta.url, // Use IPFS URL as preview
          }));

        setStoredFiles(files);
      });

      // Initial load delay
      setTimeout(() => {
        if (syncStatus === 'connecting') {
          setSyncStatus('synced');
        }
        setIsLoading(false);
      }, 1500);

      return () => unsubscribe();
    }

    init();
  }, []);

  // Handle new files
  const handleFilesSelected = useCallback((files: UploadedFile[]) => {
    setUploadQueue((prev) => [...prev, ...files]);
    files.forEach((uploadedFile) => {
      uploadFile(uploadedFile);
    });
  }, []);

  // Upload file to IPFS and sync metadata
  const uploadFile = async (uploadedFile: UploadedFile) => {
    const { id, file } = uploadedFile;
    const db = dbRef.current;

    // Update progress
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
      // Upload to IPFS via Pinata
      const result = await storage.upload(file);

      clearInterval(progressInterval);

      // Mark complete
      setUploadQueue((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, progress: 100, status: 'complete' as const } : f
        )
      );

      // Sync metadata to Gun.js (includes IPFS URL!)
      const metadata = {
        id: result.cid,
        name: file.name,
        size: file.size,
        type: file.type,
        createdAt: Date.now(),
        deviceId: db?.getDeviceId() || 'unknown',
        url: result.url, // IPFS gateway URL
      };

      if (db) {
        await db.set('files', result.cid, metadata);
      }

      // Add to local state
      setStoredFiles((prev) => [...prev, {
        ...metadata,
        uploadedAt: metadata.createdAt,
        preview: result.url,
      }]);

      // Remove from queue
      setTimeout(() => {
        setUploadQueue((prev) => prev.filter((f) => f.id !== id));
      }, 1500);

    } catch (error) {
      clearInterval(progressInterval);
      console.error('Upload failed:', error);
      setUploadQueue((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: 'error' as const, error: 'IPFS upload failed' } : f
        )
      );
    }
  };

  // Remove from queue
  const handleRemoveFromQueue = (id: string) => {
    setUploadQueue((prev) => prev.filter((f) => f.id !== id));
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

  // Preview file - open IPFS URL
  const handlePreviewFile = (id: string) => {
    const file = storedFiles.find((f) => f.id === id);
    if (file?.url) {
      window.open(file.url, '_blank');
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
              🌐 IPFS + P2P Synced Storage
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">IAMT</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            Files stored on IPFS. Access from any device, anywhere.
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
                <p className="text-xs text-gray-500">on IPFS</p>
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
              Upload to IPFS
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
              <p className="text-gray-400">Connecting to IPFS network...</p>
            </div>
          ) : activeTab === 'upload' ? (
            <div className="space-y-6">
              <FileUploader onFilesSelected={handleFilesSelected} />

              {uploadQueue.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    Uploading to IPFS...
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
            Stored on IPFS via Pinata • Synced via Gun.js •
            <a href="https://github.com/remixonwin/iamt" className="text-[var(--accent)] hover:underline ml-1">
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
