/**
 * Sync Status Context
 * 
 * Provides global, real-time synchronization status to the UI.
 * Tracks Gun.js connection state and sync activity.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { gunConnection, ConnectionStatus, ConnectionState } from '@/adapters/database/gunConnection';
import { logger, LogCategory } from '@/shared/utils/logger';

export interface SyncActivity {
    type: 'upload' | 'download' | 'sync';
    id: string;
    name?: string;
    progress?: number; // 0-100
    startTime: number;
}

export interface SyncContextValue {
    /** Gun.js connection status */
    connectionStatus: ConnectionStatus;
    /** Whether fully connected and ready */
    isOnline: boolean;
    /** Active sync activities */
    activities: SyncActivity[];
    /** Last successful sync time */
    lastSyncTime: number | null;
    /** Add a sync activity */
    startActivity: (activity: Omit<SyncActivity, 'startTime'>) => void;
    /** Update activity progress */
    updateActivity: (id: string, progress: number) => void;
    /** Remove completed activity */
    endActivity: (id: string) => void;
    /** Force reconnect */
    reconnect: () => Promise<void>;
}

const defaultStatus: ConnectionStatus = {
    state: 'disconnected',
    relays: [],
    connectedPeers: 0,
    lastConnectionTime: null,
};

const SyncContext = createContext<SyncContextValue>({
    connectionStatus: defaultStatus,
    isOnline: false,
    activities: [],
    lastSyncTime: null,
    startActivity: () => { },
    updateActivity: () => { },
    endActivity: () => { },
    reconnect: async () => { },
});

export function SyncProvider({ children }: { children: ReactNode }) {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(defaultStatus);
    const [activities, setActivities] = useState<SyncActivity[]>([]);
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

    // Subscribe to connection changes
    useEffect(() => {
        const unsubscribe = gunConnection.onConnectionChange((status) => {
            setConnectionStatus(status);
            if (status.state === 'connected' && status.lastConnectionTime) {
                setLastSyncTime(status.lastConnectionTime);
            }
            logger.debug(LogCategory.SYNC, 'Connection status changed', status);
        });

        return unsubscribe;
    }, []);

    // Clean up stale activities (older than 60s)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setActivities(prev =>
                prev.filter(a => now - a.startTime < 60000)
            );
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const startActivity = useCallback((activity: Omit<SyncActivity, 'startTime'>) => {
        const newActivity: SyncActivity = {
            ...activity,
            startTime: Date.now(),
        };
        setActivities(prev => [...prev, newActivity]);
        logger.debug(LogCategory.SYNC, 'Activity started', activity);
    }, []);

    const updateActivity = useCallback((id: string, progress: number) => {
        setActivities(prev =>
            prev.map(a => a.id === id ? { ...a, progress } : a)
        );
    }, []);

    const endActivity = useCallback((id: string) => {
        setActivities(prev => prev.filter(a => a.id !== id));
        setLastSyncTime(Date.now());
        logger.debug(LogCategory.SYNC, 'Activity ended', id);
    }, []);

    const reconnect = useCallback(async () => {
        logger.info(LogCategory.SYNC, 'Manual reconnect requested');
        await gunConnection.ensureGun();
    }, []);

    const isOnline = connectionStatus.state === 'connected';

    return (
        <SyncContext.Provider
            value={{
                connectionStatus,
                isOnline,
                activities,
                lastSyncTime,
                startActivity,
                updateActivity,
                endActivity,
                reconnect,
            }}
        >
            {children}
        </SyncContext.Provider>
    );
}

/**
 * Hook to access sync status
 */
export function useSync(): SyncContextValue {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error('useSync must be used within a SyncProvider');
    }
    return context;
}

/**
 * Hook to get just the online status
 */
export function useIsOnline(): boolean {
    const { isOnline } = useSync();
    return isOnline;
}
