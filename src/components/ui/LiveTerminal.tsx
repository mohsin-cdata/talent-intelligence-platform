'use client';

import { useRef, useEffect } from 'react';
import { Terminal, X, Minimize2, Maximize2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore, LogEntry } from '@/lib/store';
import { cn } from '@/lib/utils';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function LogEntryLine({ log }: { log: LogEntry }) {
  const typeColors = {
    info: 'text-blue-400',
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    api: 'text-purple-400',
    sql: 'text-cyan-400',
  };

  const typeLabels = {
    info: 'INFO',
    success: 'OK',
    error: 'ERR',
    warning: 'WARN',
    api: 'API',
    sql: 'SQL',
  };

  return (
    <div className="flex gap-2 py-0.5 font-mono text-xs hover:bg-white/5 px-2 -mx-2 rounded">
      <span className="text-gray-500 flex-shrink-0">{formatTime(new Date(log.timestamp))}</span>
      <span className={cn('w-12 flex-shrink-0 font-semibold', typeColors[log.type])}>
        [{typeLabels[log.type]}]
      </span>
      <span className="text-gray-300 break-all">
        {log.message}
        {log.details && (
          <span className="text-gray-500 ml-2">{log.details}</span>
        )}
      </span>
    </div>
  );
}

export function LiveTerminal() {
  const { liveLogs, logsTerminalOpen, setLogsTerminalOpen, clearLogs } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMinimized = !logsTerminalOpen;

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && logsTerminalOpen) {
      scrollRef.current.scrollTop = 0; // Scroll to top (newest logs are at top)
    }
  }, [liveLogs.length, logsTerminalOpen]);

  if (isMinimized) {
    // Minimized state - just a small bar
    return (
      <button
        onClick={() => setLogsTerminalOpen(true)}
        className="fixed bottom-12 right-4 z-40 flex items-center gap-2 px-3 py-2 bg-gray-900 text-gray-300 rounded-t-lg border border-gray-700 border-b-0 hover:bg-gray-800 transition-colors shadow-lg"
      >
        <Terminal className="w-4 h-4 text-green-400" />
        <span className="text-xs font-medium">Logs</span>
        {liveLogs.length > 0 && (
          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-medium rounded">
            {liveLogs.length}
          </span>
        )}
        <ChevronUp className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-12 right-4 z-40 w-[600px] max-w-[calc(100vw-2rem)] bg-gray-900 rounded-t-lg border border-gray-700 border-b-0 shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-gray-300">Live Logs</span>
          <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-[10px] font-medium rounded">
            {liveLogs.length} entries
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearLogs}
            className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setLogsTerminalOpen(false)}
            className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors"
            title="Minimize"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto p-2 text-xs font-mono"
        style={{ backgroundColor: '#0d1117' }}
      >
        {liveLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            <p>No logs yet. Execute a query to see logs here.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {liveLogs.map((log) => (
              <LogEntryLine key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Footer with quick stats */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-700 bg-gray-800/30 text-[10px] text-gray-500">
        <span>
          {liveLogs.filter((l) => l.type === 'error').length} errors • {liveLogs.filter((l) => l.type === 'api').length} API calls • {liveLogs.filter((l) => l.type === 'sql').length} queries
        </span>
        <span>Auto-scrolling enabled</span>
      </div>
    </div>
  );
}
