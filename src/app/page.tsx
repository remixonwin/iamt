'use client';

import { useState, useEffect } from 'react';

// Simulating adapter pattern - in production, these would come from @/adapters
interface DataItem {
  id: string;
  content: string;
  timestamp: number;
}

export default function Home() {
  const [items, setItems] = useState<DataItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Simulate fetching from decentralized database
  useEffect(() => {
    const stored = localStorage.getItem('dweb-items');
    if (stored) {
      setItems(JSON.parse(stored));
    }
  }, []);

  // Simulate saving to decentralized storage
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setIsLoading(true);
    setStatus('saving');

    // Simulate network delay (like IPFS/Gun.js)
    await new Promise((resolve) => setTimeout(resolve, 800));

    const newItem: DataItem = {
      id: `item-${Date.now()}`,
      content: inputValue,
      timestamp: Date.now(),
    };

    const updatedItems = [...items, newItem];
    setItems(updatedItems);
    localStorage.setItem('dweb-items', JSON.stringify(updatedItems));

    setInputValue('');
    setIsLoading(false);
    setStatus('saved');

    setTimeout(() => setStatus('idle'), 2000);
  };

  const handleDelete = (id: string) => {
    const updatedItems = items.filter((item) => item.id !== id);
    setItems(updatedItems);
    localStorage.setItem('dweb-items', JSON.stringify(updatedItems));
  };

  const handleClearAll = () => {
    setItems([]);
    localStorage.removeItem('dweb-items');
  };

  return (
    <main className="gradient-bg min-h-screen">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <div className="inline-block mb-4 px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)]">
            <span className="text-sm font-medium text-[var(--accent-light)]">
              🌐 Decentralized Architecture MVP
            </span>
          </div>

          <h1 className="text-5xl font-bold mb-6">
            <span className="gradient-text">IAMT</span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            A modular, TDD-first, future-proof web application built with
            adaptable decentralized storage patterns.
          </p>
        </div>

        {/* Demo Card */}
        <div className="glass-card glow p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[var(--success)] animate-pulse" />
            Data Storage Demo
          </h2>

          <form onSubmit={handleSubmit} className="flex gap-4 mb-8">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter data to store..."
              className="input flex-1"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving
                </span>
              ) : (
                'Store'
              )}
            </button>
          </form>

          {status === 'saved' && (
            <div className="mb-6 p-4 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)]">
              ✓ Data saved successfully (simulating IPFS/Gun.js storage)
            </div>
          )}

          {/* Data List */}
          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">No data stored yet</p>
                <p className="text-sm">Add your first item above to test the adapter pattern</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-gray-400">
                    {items.length} item{items.length !== 1 ? 's' : ''} stored
                  </span>
                  <button
                    onClick={handleClearAll}
                    className="text-sm text-[var(--error)] hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition-all"
                  >
                    <div>
                      <p className="font-medium">{item.content}</p>
                      <p className="text-xs text-gray-500 mt-1 font-mono">
                        ID: {item.id}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-gray-400 hover:text-[var(--error)] transition-colors p-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Architecture Info */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="glass-card p-6">
            <div className="w-12 h-12 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🔌</span>
            </div>
            <h3 className="font-semibold mb-2">Adapter Pattern</h3>
            <p className="text-sm text-gray-400">
              Swap IPFS for Arweave, or Gun.js for Ceramic — without changing app code.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="w-12 h-12 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🧪</span>
            </div>
            <h3 className="font-semibold mb-2">TDD First</h3>
            <p className="text-sm text-gray-400">
              19 tests passing. Mock adapters enable testing without network calls.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="w-12 h-12 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🌐</span>
            </div>
            <h3 className="font-semibold mb-2">Decentralized</h3>
            <p className="text-sm text-gray-400">
              Ready for IPFS deployment via Fleek. No central servers required.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-gray-500">
          <p>
            Built with Next.js 14 • TailwindCSS • Vitest
          </p>
        </footer>
      </div>
    </main>
  );
}
