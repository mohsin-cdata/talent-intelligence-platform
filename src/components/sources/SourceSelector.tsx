'use client';

import { useEffect, useRef } from 'react';
import { Database, Check, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, SourceInfo } from '@/lib/store';
import { apiClient } from '@/lib/api-client';

interface SourceSelectorProps {
  className?: string;
}

export function SourceSelector({ className }: SourceSelectorProps) {
  const {
    sourceRegistry,
    setSourceRegistry,
    lockedDataSources,
    toggleLockedDataSource,
    setLockedDataSources,
  } = useAppStore();

  const fetchAttempted = useRef(false);
  const isLoading = useRef(false);

  // Fetch source registry from catalogs API on mount
  useEffect(() => {
    if (fetchAttempted.current || sourceRegistry.length > 0) return;
    fetchAttempted.current = true;

    const fetchSources = async () => {
      isLoading.current = true;
      try {
        const response = await apiClient('/api/catalogs', { method: 'GET' });
        const data = await response.json();
        if (data.catalogs?.length > 0) {
          const sources: SourceInfo[] = data.catalogs.map((c: any) => ({
            catalog: c.catalog,
            tableCount: c.tableCount || 0,
            isWritable: true, // assume writable until proven otherwise
            connectedAt: Date.now(),
          }));
          setSourceRegistry(sources);

          // If no sources locked yet, auto-lock all
          if (lockedDataSources.length === 0) {
            setLockedDataSources(sources.map(s => s.catalog));
          }
        }
      } catch (err) {
        console.error('[SourceSelector] Failed to fetch sources:', err);
      } finally {
        isLoading.current = false;
      }
    };

    fetchSources();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    fetchAttempted.current = false;
    setSourceRegistry([]);
    isLoading.current = true;
    try {
      const response = await apiClient('/api/catalogs?refresh=true', { method: 'GET' });
      const data = await response.json();
      if (data.catalogs?.length > 0) {
        const sources: SourceInfo[] = data.catalogs.map((c: any) => ({
          catalog: c.catalog,
          tableCount: c.tableCount || 0,
          isWritable: true,
          connectedAt: Date.now(),
        }));
        setSourceRegistry(sources);
      }
    } catch (err) {
      console.error('[SourceSelector] Refresh failed:', err);
    } finally {
      isLoading.current = false;
    }
  };

  if (sourceRegistry.length === 0) {
    return null; // Don't render until sources are loaded
  }

  const allSelected = lockedDataSources.length === sourceRegistry.length;
  const multiSourceActive = lockedDataSources.length > 1;

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
        <Database className="w-3.5 h-3.5" />
        <span>Sources:</span>
      </div>

      {/* All toggle */}
      <button
        onClick={() => {
          if (allSelected) {
            // Deselect all is not useful -- select just the first one
            setLockedDataSources([sourceRegistry[0].catalog]);
          } else {
            setLockedDataSources(sourceRegistry.map(s => s.catalog));
          }
        }}
        className={cn(
          'px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200',
          allSelected
            ? 'bg-cdata-yellow text-cdata-black border-cdata-yellow'
            : 'bg-white text-gray-600 border-gray-200 hover:border-cdata-yellow hover:bg-cdata-yellow/5'
        )}
      >
        All ({sourceRegistry.length})
      </button>

      {/* Individual source chips */}
      {sourceRegistry.map((source) => {
        const isSelected = lockedDataSources.includes(source.catalog);
        return (
          <button
            key={source.catalog}
            onClick={() => toggleLockedDataSource(source.catalog)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 inline-flex items-center gap-1',
              isSelected
                ? 'bg-cdata-yellow/20 text-cdata-black border-cdata-yellow'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            )}
            title={`${source.tableCount} tables${source.isWritable ? '' : ' (read-only)'}`}
          >
            {isSelected && <Check className="w-3 h-3" />}
            {source.catalog}
            <span className="text-gray-400 font-normal">({source.tableCount})</span>
          </button>
        );
      })}

      {/* Federation indicator */}
      {multiSourceActive && (
        <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 border border-indigo-200">
          Federation
        </span>
      )}

      {/* Refresh */}
      <button
        onClick={refresh}
        className="p-1 hover:bg-gray-100 rounded transition-colors"
        title="Refresh sources"
      >
        <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
      </button>
    </div>
  );
}
