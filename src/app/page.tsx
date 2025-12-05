'use client';

import { useState, useEffect } from 'react';
import { FileUploader, FilePreview, FileGrid, type UploadedFile } from '@/shared/components';
import { getFileTypeInfo, formatFileSize } from '@/shared/utils';

interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
  uploadedAt: number;
}

export default function Home() {
  const [uploadQueue, setUploadQueue] = useState<UploadedFile[]>([]);
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'files'>('upload');

  // Load stored files from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('dweb-files');
    if (stored) {
      setStoredFiles(JSON.parse(stored));
    }
  }, []);

  // Handle new files selected
  const handleFilesSelected = (files: UploadedFile[]) => {
    setUploadQueue((prev) => [...prev, ...files]);

    // Simulate upload for each file
    files.forEach((file) => {
      simulateUpload(file.id);
    });
  };

  // Simulate upload progress
  const simulateUpload = (fileId: string) => {
    let progress = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;

      if (progress >= 100) {
        clearInterval(interval);
        progress = 100;

        // Mark as complete
        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, progress: 100, status: 'complete' as const }
              : f
          )
        );

        // Add to stored files after a short delay
        setTimeout(() => {
          setUploadQueue((prev) => {
            const completedFile = prev.find((f) => f.id === fileId);
            if (completedFile) {
              const newStoredFile: StoredFile = {
                id: completedFile.id,
                name: completedFile.file.name,
                size: completedFile.file.size,
                type: completedFile.file.type,
                preview: completedFile.preview,
                uploadedAt: Date.now(),
              };

              setStoredFiles((prevStored) => {
                const updated = [...prevStored, newStoredFile];
                localStorage.setItem('dweb-files', JSON.stringify(updated));
                return updated;
              });
            }
            return prev.filter((f) => f.id !== fileId);
          });
        }, 1000);
      } else {
        setUploadQueue((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, progress: Math.min(progress, 99), status: 'uploading' as const }
              : f
          )
        );
      }
    }, 200);
  };

  // Remove from upload queue
  const handleRemoveFromQueue = (id: string) => {
    setUploadQueue((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  // Delete stored file
  const handleDeleteFile = (id: string) => {
    setStoredFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      const updated = prev.filter((f) => f.id !== id);
      localStorage.setItem('dweb-files', JSON.stringify(updated));
      return updated;
    });
  };

  // Preview file (placeholder)
  const handlePreviewFile = (id: string) => {
    const file = storedFiles.find((f) => f.id === id);
    if (file?.preview) {
      window.open(file.preview, '_blank');
    }
  };

  // Calculate stats
  const totalSize = storedFiles.reduce((acc, f) => acc + f.size, 0);
  const filesByType = storedFiles.reduce((acc, f) => {
    const info = getFileTypeInfo({ type: f.type } as File);
    acc[info.category] = (acc[info.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="gradient-bg min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block mb-4 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)]">
            <span className="text-sm font-medium text-[var(--accent-light)]">
              🌐 Decentralized File Storage
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">IAMT</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            Upload and store your files on decentralized storage.
            PDF, audio, video, and images supported.
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

        {/* Tab Navigation */}
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
          {activeTab === 'upload' ? (
            <div className="space-y-6">
              <FileUploader onFilesSelected={handleFilesSelected} />

              {/* Upload Queue */}
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
          <p>Built with Next.js • Decentralized Architecture •
            <a href="https://github.com/remixonwin/iamt" className="text-[var(--accent)] hover:underline ml-1">
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
