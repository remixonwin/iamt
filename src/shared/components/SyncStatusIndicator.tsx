/**
 * Sync Status Indicator
 * 
 * Visual indicator for connection and sync status.
 * Shows online/offline state and active sync activities.
 */

'use client';

import React, { useState } from 'react';
import { useSync } from '@/shared/contexts/SyncContext';

interface SyncStatusIndicatorProps {
    /** Show detailed popover on hover */
    showDetails?: boolean;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Additional CSS classes */
    className?: string;
}

export function SyncStatusIndicator({
    showDetails = true,
    size = 'md',
    className = '',
}: SyncStatusIndicatorProps) {
    const { connectionStatus, isOnline, activities, lastSyncTime } = useSync();
    const [showPopover, setShowPopover] = useState(false);

    const sizeClasses = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4',
    };

    const statusColors = {
        connected: 'bg-green-500',
        connecting: 'bg-yellow-500 animate-pulse',
        disconnected: 'bg-red-500',
    };

    const hasActivity = activities.length > 0;

    return (
        <div
            className={`relative inline-flex items-center gap-2 ${className}`}
            onMouseEnter={() => showDetails && setShowPopover(true)}
            onMouseLeave={() => setShowPopover(false)}
        >
            {/* Status dot */}
            <div className="relative">
                <div
                    className={`${sizeClasses[size]} rounded-full ${statusColors[connectionStatus.state]}`}
                    title={isOnline ? 'Connected' : 'Disconnected'}
                />
                {/* Activity ring */}
                {hasActivity && (
                    <div className="absolute -inset-1 rounded-full border-2 border-blue-500 animate-ping opacity-75" />
                )}
            </div>

            {/* Status text (optional) */}
            {size === 'lg' && (
                <span className="text-sm text-gray-400">
                    {isOnline ? 'Synced' : 'Offline'}
                </span>
            )}

            {/* Details popover */}
            {showDetails && showPopover && (
                <div className="absolute top-full left-0 mt-2 z-50 min-w-[200px] p-3 bg-[var(--surface)] border border-white/10 rounded-lg shadow-xl">
                    <div className="space-y-2 text-sm">
                        {/* Connection status */}
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400">Status</span>
                            <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
                                {connectionStatus.state}
                            </span>
                        </div>

                        {/* Connected peers */}
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400">Peers</span>
                            <span>{connectionStatus.connectedPeers}</span>
                        </div>

                        {/* Last sync */}
                        {lastSyncTime && (
                            <div className="flex items-center justify-between">
                                <span className="text-gray-400">Last sync</span>
                                <span>{formatRelativeTime(lastSyncTime)}</span>
                            </div>
                        )}

                        {/* Active activities */}
                        {activities.length > 0 && (
                            <div className="pt-2 border-t border-white/10">
                                <span className="text-gray-400 text-xs">Active:</span>
                                {activities.map(activity => (
                                    <div key={activity.id} className="flex items-center gap-2 mt-1">
                                        <span className="text-xs">
                                            {activity.type === 'upload' ? '⬆️' : activity.type === 'download' ? '⬇️' : '🔄'}
                                        </span>
                                        <span className="text-xs truncate flex-1">
                                            {activity.name || activity.id}
                                        </span>
                                        {activity.progress !== undefined && (
                                            <span className="text-xs text-gray-500">
                                                {activity.progress}%
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Format timestamp as relative time
 */
function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
}

export default SyncStatusIndicator;
