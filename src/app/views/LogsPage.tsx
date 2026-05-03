'use client';

import { useState } from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Download,
  Filter,
  DollarSign,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { useAppStore, getUsageSummary } from '@/lib/store';
import { cn, formatNumber } from '@/lib/utils';
import { QueryLog } from '@/types';

// Usage Summary Card
function UsageSummaryCard({
  title,
  tokens,
  cost,
  queries,
  highlight = false,
}: {
  title: string;
  tokens: number;
  cost: number;
  queries: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-5 transition-all',
        highlight
          ? 'bg-cdata-yellow/10 border-cdata-yellow'
          : 'bg-white border-gray-200 hover:shadow-md'
      )}
    >
      <p className="text-sm text-gray-500 font-medium mb-3">{title}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Tokens</span>
          <span className="text-lg font-bold text-cdata-black">{formatNumber(tokens)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Cost</span>
          <span className="text-lg font-bold text-green-600">${cost.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Queries</span>
          <span className="text-sm font-medium text-gray-600">{queries}</span>
        </div>
      </div>
    </div>
  );
}

// Usage Trend Chart (simplified)
function UsageTrendChart({ logs }: { logs: QueryLog[] }) {
  // Group logs by day for last 7 days
  const today = new Date();
  const days: { date: string; tokens: number; cost: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'short' });

    const dayLogs = logs.filter((log) => {
      const logDate = new Date(log.timestamp);
      return (
        logDate.getDate() === date.getDate() &&
        logDate.getMonth() === date.getMonth() &&
        logDate.getFullYear() === date.getFullYear()
      );
    });

    const tokens = dayLogs.reduce((sum, log) => sum + log.tokenUsage.totalTokens, 0);
    const cost = dayLogs.reduce((sum, log) => sum + log.tokenUsage.estimatedCost, 0);

    days.push({ date: dateStr, tokens, cost });
  }

  const maxTokens = Math.max(...days.map((d) => d.tokens), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-cdata-black">Usage Trend (7 Days)</h2>
        <TrendingUp className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex items-end justify-between h-32 gap-2">
        {days.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col items-center justify-end h-24">
              {day.tokens > 0 && (
                <span className="text-xs font-medium text-gray-500 mb-1">
                  {formatNumber(day.tokens)}
                </span>
              )}
              <div
                className={cn(
                  'w-full rounded-t transition-all',
                  day.tokens > 0 ? 'bg-cdata-yellow' : 'bg-gray-100'
                )}
                style={{ height: `${Math.max((day.tokens / maxTokens) * 100, day.tokens > 0 ? 10 : 0)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{day.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Single Log Entry
function LogEntry({ log, expanded, onToggle }: { log: QueryLog; expanded: boolean; onToggle: () => void }) {
  const timeAgo = getTimeAgo(new Date(log.timestamp));

  return (
    <div
      className={cn(
        'bg-white rounded-lg border transition-all',
        expanded ? 'border-cdata-yellow shadow-md' : 'border-gray-200 hover:border-gray-300'
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        {log.success ? (
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-cdata-black truncate">{log.query}</p>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span>{timeAgo}</span>
            <span>{log.rowCount} rows</span>
            <span>{log.duration}ms</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500">{formatNumber(log.tokenUsage.totalTokens)} tokens</p>
            <p className="text-xs font-medium text-green-600">${log.tokenUsage.estimatedCost.toFixed(3)}</p>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3 animate-in">
          {/* SQL */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Generated SQL</p>
            <pre className="bg-gray-50 rounded p-3 text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">
              {log.sql || 'No SQL generated'}
            </pre>
          </div>

          {/* Token breakdown */}
          <div className="flex gap-4">
            <div className="flex-1 bg-gray-50 rounded p-3">
              <p className="text-xs text-gray-500">Prompt Tokens</p>
              <p className="text-sm font-semibold text-cdata-black">
                {formatNumber(log.tokenUsage.promptTokens)}
              </p>
            </div>
            <div className="flex-1 bg-gray-50 rounded p-3">
              <p className="text-xs text-gray-500">Completion Tokens</p>
              <p className="text-sm font-semibold text-cdata-black">
                {formatNumber(log.tokenUsage.completionTokens)}
              </p>
            </div>
            <div className="flex-1 bg-gray-50 rounded p-3">
              <p className="text-xs text-gray-500">Duration</p>
              <p className="text-sm font-semibold text-cdata-black">{log.duration}ms</p>
            </div>
          </div>

          {/* Error if present */}
          {log.error && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-xs font-medium text-red-700">Error</p>
              <p className="text-sm text-red-600">{log.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function for time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

export function LogsPage() {
  const { queryLogs, tokenUsage, clearQueryLogs } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');

  // Calculate usage summaries
  const todayUsage = getUsageSummary(queryLogs, 'day');
  const weekUsage = getUsageSummary(queryLogs, 'week');
  const monthUsage = getUsageSummary(queryLogs, 'month');

  // Filter logs
  const filteredLogs = queryLogs.filter((log) => {
    if (filterStatus === 'success') return log.success;
    if (filterStatus === 'error') return !log.success;
    return true;
  });

  const handleExport = () => {
    const data = JSON.stringify(queryLogs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cdata-black">Query Logs & Token Usage</h1>
          <p className="text-gray-500 mt-1">Monitor your API usage and query history</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-cdata-black border border-gray-200 rounded-lg hover:border-gray-300 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={clearQueryLogs}
            className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg hover:border-red-300 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear Logs
          </button>
        </div>
      </div>

      {/* Usage Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UsageSummaryCard
          title="Today"
          tokens={tokenUsage.today.totalTokens}
          cost={tokenUsage.today.estimatedCost}
          queries={todayUsage.queryCount}
          highlight
        />
        <UsageSummaryCard
          title="This Week"
          tokens={tokenUsage.week.totalTokens}
          cost={tokenUsage.week.estimatedCost}
          queries={weekUsage.queryCount}
        />
        <UsageSummaryCard
          title="This Month"
          tokens={tokenUsage.month.totalTokens}
          cost={tokenUsage.month.estimatedCost}
          queries={monthUsage.queryCount}
        />
      </div>

      {/* Usage Trend Chart */}
      <UsageTrendChart logs={queryLogs} />

      {/* Query Logs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-cdata-black">Recent Queries</h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:border-cdata-yellow outline-none"
            >
              <option value="all">All ({queryLogs.length})</option>
              <option value="success">Success ({queryLogs.filter((l) => l.success).length})</option>
              <option value="error">Errors ({queryLogs.filter((l) => !l.success).length})</option>
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No query logs yet</p>
            <p className="text-sm text-gray-400">
              Logs will appear here as you make searches
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <LogEntry
                key={log.id}
                log={log}
                expanded={expandedId === log.id}
                onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
