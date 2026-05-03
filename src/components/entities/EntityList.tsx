// EntityList - Renders a list of entities as EntityCards
// Handles empty states, loading, and entity type grouping

'use client';

import { TableMap } from '@/lib/agents/types';
import { EntityCard } from './EntityCard';
import { Loader2, Search } from 'lucide-react';

interface EntityListProps {
  rows: Record<string, any>[];
  tableMap: TableMap;
  loading?: boolean;
  onEntityClick?: (row: Record<string, any>, index: number) => void;
  selectedIndex?: number;
  maxItems?: number;
  emptyMessage?: string;
}

export function EntityList({
  rows,
  tableMap,
  loading,
  onEntityClick,
  selectedIndex,
  maxItems = 50,
  emptyMessage = 'No results found',
}: EntityListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Search className="w-8 h-8 mb-2" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  const displayed = rows.slice(0, maxItems);

  return (
    <div className="space-y-3">
      {/* Result count */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-gray-500">
          {rows.length} {tableMap.entityType}{rows.length !== 1 ? 's' : ''}
          {rows.length > maxItems && ` (showing ${maxItems})`}
        </p>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
          {tableMap.subDomain}
        </span>
      </div>

      {/* Cards */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {displayed.map((row, i) => (
          <EntityCard
            key={i}
            row={row}
            tableMap={tableMap}
            onClick={onEntityClick ? () => onEntityClick(row, i) : undefined}
            selected={selectedIndex === i}
          />
        ))}
      </div>
    </div>
  );
}
