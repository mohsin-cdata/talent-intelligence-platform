'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, RefreshCw, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { PendingMutation } from '@/lib/mutation-manager';

// Auto-dismiss successful mutations after 3s
const SUCCESS_DISMISS_MS = 3000;
// Show at most 5 toasts at once
const MAX_VISIBLE = 5;

function MutationToastItem({
  mutation,
  onDismiss,
  onRetry,
}: {
  mutation: PendingMutation;
  onDismiss: () => void;
  onRetry?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss success
  useEffect(() => {
    if (mutation.status === 'success') {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300); // fade-out transition
      }, SUCCESS_DISMISS_MS);
      return () => clearTimeout(timer);
    }
  }, [mutation.status, onDismiss]);

  const statusConfig = {
    pending: { icon: Loader2, color: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-500', spin: true },
    executing: { icon: Loader2, color: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-500', spin: true },
    success: { icon: CheckCircle, color: 'bg-green-50 border-green-200', iconColor: 'text-green-500', spin: false },
    failed: { icon: XCircle, color: 'bg-red-50 border-red-200', iconColor: 'text-red-500', spin: false },
    timeout: { icon: Loader2, color: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-500', spin: false },
    cancelled: { icon: X, color: 'bg-gray-50 border-gray-200', iconColor: 'text-gray-500', spin: false },
  };

  const config = statusConfig[mutation.status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border shadow-sm transition-all duration-300',
        config.color,
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColor, config.spin && 'animate-spin')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{mutation.description}</p>
        {mutation.error && (
          <p className="text-xs text-red-600 mt-0.5 truncate">{mutation.error}</p>
        )}
        {mutation.status === 'success' && mutation.rowsAffected !== undefined && (
          <p className="text-xs text-green-600 mt-0.5">{mutation.rowsAffected} row(s) updated</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {mutation.status === 'failed' && onRetry && (
          <button
            onClick={onRetry}
            className="p-1 hover:bg-red-100 rounded transition-colors"
            title="Retry"
          >
            <RefreshCw className="w-3.5 h-3.5 text-red-500" />
          </button>
        )}
        {mutation.status === 'failed' && mutation.oldValue !== undefined && (
          <button
            onClick={() => {
              mutation.rollbackFn?.();
              onDismiss();
            }}
            className="p-1 hover:bg-red-100 rounded transition-colors"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        )}
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
    </div>
  );
}

export function MutationToastContainer() {
  const { pendingMutations, removePendingMutation } = useAppStore();

  // Show only mutations that are recent (last 30s) or not yet resolved
  const visibleMutations = pendingMutations
    .filter(m => {
      if (m.status === 'executing' || m.status === 'pending') return true;
      if (m.resolvedAt && Date.now() - m.resolvedAt > SUCCESS_DISMISS_MS + 500) return false;
      return true;
    })
    .slice(0, MAX_VISIBLE);

  if (visibleMutations.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {visibleMutations.map(mutation => (
        <MutationToastItem
          key={mutation.id}
          mutation={mutation}
          onDismiss={() => removePendingMutation(mutation.id)}
        />
      ))}
    </div>
  );
}
