'use client';

import { cn } from '@/lib/utils';
import { ConnectionStatus } from '@/types';

interface StatusIndicatorProps {
  status: ConnectionStatus;
  label?: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<ConnectionStatus, { color: string; pulse: boolean; label: string }> = {
  connected: { color: 'bg-green-500', pulse: false, label: 'Connected' },
  disconnected: { color: 'bg-gray-400', pulse: false, label: 'Not configured' },
  testing: { color: 'bg-yellow-500', pulse: true, label: 'Testing...' },
  error: { color: 'bg-red-500', pulse: false, label: 'Error' },
};

export function StatusIndicator({ status, label, size = 'sm' }: StatusIndicatorProps) {
  const config = statusConfig[status];
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={cn(dotSize, 'rounded-full', config.color)} />
        {config.pulse && (
          <div className={cn(dotSize, 'rounded-full', config.color, 'absolute inset-0 animate-ping opacity-75')} />
        )}
      </div>
      {(label || config.label) && (
        <span className="text-xs text-gray-600">{label || config.label}</span>
      )}
    </div>
  );
}
