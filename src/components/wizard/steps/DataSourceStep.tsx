'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Database, CheckSquare, Square, ChevronDown, ChevronRight, RefreshCw, Server, Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface DataSourceStepProps {
  lockedTables: string[];
  onChange: (tables: string[]) => void;
  cdataConfigured?: boolean;
  cdataEmail?: string;
  cdataPat?: string;
  cdataEndpoint?: string;
}

interface CatalogTable {
  name: string;
  displayName: string;
}

interface CatalogSchema {
  schema: string;
  tables: CatalogTable[];
}

interface CatalogInfo {
  catalog: string;
  schemas: CatalogSchema[];
  tableCount: number;
}

const TABLES_PER_PAGE = 30;

export function DataSourceStep({ lockedTables, onChange, cdataEmail, cdataPat, cdataEndpoint }: DataSourceStepProps) {
  const [catalogs, setCatalogs] = useState<CatalogInfo[]>([]);
  const [expandedCatalogs, setExpandedCatalogs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveData, setIsLiveData] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleTableCount, setVisibleTableCount] = useState<Record<string, number>>({});

  const discoverCatalogs = async () => {
    setIsLoading(true);
    setError('');
    try {
      const headers: Record<string, string> = {};
      if (cdataEmail) headers['x-cdata-email'] = cdataEmail;
      if (cdataPat) headers['x-cdata-pat'] = cdataPat;
      if (cdataEndpoint) headers['x-cdata-endpoint'] = cdataEndpoint;

      const response = await fetch('/api/catalogs?refresh=true', { headers });
      const data = await response.json();

      if (data.error) {
        setError(`Discovery error: ${data.error}`);
        return;
      }

      if (data.catalogs && data.catalogs.length > 0) {
        setCatalogs(data.catalogs);
        setIsLiveData(true);
        // Don't auto-expand — user picks which to explore
      } else {
        setError('No catalogs found. Check your CData credentials.');
      }
    } catch (err) {
      console.error('[DataSourceStep] Discovery error:', err);
      setError(`Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    discoverCatalogs();
  }, [cdataEmail, cdataPat, cdataEndpoint]);

  // Filter catalogs by search — matches catalog name, schema/source type name, and table names
  const filteredCatalogs = useMemo(() => {
    if (!searchQuery.trim()) return catalogs;
    const q = searchQuery.toLowerCase();
    return catalogs.filter((cat) => {
      // Match catalog (connection) name
      if (cat.catalog.toLowerCase().includes(q)) return true;
      // Match schema name (this is the source type, e.g. "GoogleSheets", "Asana", "GitHub")
      if (cat.schemas.some((s) => s.schema.toLowerCase().includes(q))) return true;
      // Match any table name
      return cat.schemas.some((s) =>
        s.tables.some((t) => t.name.toLowerCase().includes(q) || t.displayName.toLowerCase().includes(q))
      );
    });
  }, [catalogs, searchQuery]);

  const toggleCatalog = (catalogName: string) => {
    setExpandedCatalogs(prev => {
      const next = new Set(prev);
      if (next.has(catalogName)) {
        next.delete(catalogName);
      } else {
        next.add(catalogName);
      }
      return next;
    });
  };

  const getTableKey = (catalog: string, schema: string, table: string) =>
    `${catalog}.${schema}.${table}`;

  const toggleTable = (key: string) => {
    if (lockedTables.includes(key)) {
      onChange(lockedTables.filter((t) => t !== key));
    } else {
      onChange([...lockedTables, key]);
    }
  };

  const selectAllInCatalog = (cat: CatalogInfo) => {
    const keys = cat.schemas.flatMap(s => s.tables.map(t => getTableKey(cat.catalog, s.schema, t.name)));
    const existing = new Set(lockedTables);
    keys.forEach(k => existing.add(k));
    onChange(Array.from(existing));
  };

  const clearCatalog = (cat: CatalogInfo) => {
    const keys = new Set(cat.schemas.flatMap(s => s.tables.map(t => getTableKey(cat.catalog, s.schema, t.name))));
    onChange(lockedTables.filter(t => !keys.has(t)));
  };

  const totalTables = catalogs.reduce((sum, c) => sum + c.tableCount, 0);

  const getVisibleLimit = (catalogName: string) => visibleTableCount[catalogName] || TABLES_PER_PAGE;

  const showMoreTables = (catalogName: string) => {
    setVisibleTableCount(prev => ({
      ...prev,
      [catalogName]: (prev[catalogName] || TABLES_PER_PAGE) + TABLES_PER_PAGE,
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-cdata-black font-grafier">Data Source Selection</h3>
        <p className="text-sm text-gray-500 mt-1">
          Select data sources from your Connect AI account. Click a catalog to expand and choose tables.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search catalogs or tables..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-cdata-yellow focus:ring-2 focus:ring-cdata-yellow/20 focus:outline-none transition-all"
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLiveData ? (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Live from Connect AI
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 bg-gray-400 rounded-full" />
              Using defaults
            </span>
          )}
          <span className="text-xs text-gray-400">
            {filteredCatalogs.length}{searchQuery ? ` of ${catalogs.length}` : ''} catalog{filteredCatalogs.length !== 1 ? 's' : ''} / {totalTables} tables
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lockedTables.length > 0 && (
            <span className="text-xs font-medium text-cdata-black">{lockedTables.length} selected</span>
          )}
          <button
            onClick={discoverCatalogs}
            disabled={isLoading}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Selection controls */}
      {lockedTables.length > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{lockedTables.length} table{lockedTables.length !== 1 ? 's' : ''} selected</span>
          <button onClick={() => onChange([])} className="text-gray-400 hover:text-gray-600">
            Clear all
          </button>
        </div>
      )}

      {error && <p className="text-xs text-yellow-600">{error}</p>}

      {isLoading && catalogs.length === 0 && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-cdata-yellow animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Discovering data sources...</span>
        </div>
      )}

      {/* Catalog list */}
      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {filteredCatalogs.length === 0 && searchQuery && (
          <p className="text-xs text-gray-400 text-center py-4">
            No catalogs matching &ldquo;{searchQuery}&rdquo;
          </p>
        )}

        {filteredCatalogs.map((cat) => {
          const isExpanded = expandedCatalogs.has(cat.catalog);
          const selectedInCatalog = cat.schemas
            .flatMap(s => s.tables.map(t => getTableKey(cat.catalog, s.schema, t.name)))
            .filter(k => lockedTables.includes(k)).length;

          // Flatten all tables for this catalog (for lazy rendering)
          const allTables = cat.schemas.flatMap(s =>
            s.tables.map(t => ({ ...t, schema: s.schema, key: getTableKey(cat.catalog, s.schema, t.name) }))
          );
          const limit = getVisibleLimit(cat.catalog);
          const visibleTables = allTables.slice(0, limit);
          const hasMore = allTables.length > limit;

          return (
            <div key={cat.catalog} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Catalog header */}
              <button
                onClick={() => toggleCatalog(cat.catalog)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 transition-colors text-left',
                  selectedInCatalog > 0 ? 'bg-cdata-yellow/5 hover:bg-cdata-yellow/10' : 'bg-gray-50 hover:bg-gray-100'
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <Server className="w-4 h-4 text-cdata-yellow flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{cat.catalog}</p>
                  {cat.schemas.length > 0 && (
                    <p className="text-[10px] text-gray-400 truncate">{cat.schemas.map(s => s.schema).join(', ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedInCatalog > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-cdata-yellow/20 text-cdata-black rounded-full font-medium">
                      {selectedInCatalog}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">{cat.tableCount}</span>
                </div>
              </button>

              {/* Tables — only rendered when expanded */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {/* Select all / clear */}
                  <div className="flex items-center justify-end gap-2 px-3 py-1.5 bg-white border-b border-gray-50">
                    <button
                      onClick={() => selectAllInCatalog(cat)}
                      className="text-[10px] text-blue-500 hover:text-blue-600"
                    >
                      Select All ({allTables.length})
                    </button>
                    <button
                      onClick={() => clearCatalog(cat)}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Paginated table list */}
                  {visibleTables.map((table) => {
                    const isSelected = lockedTables.includes(table.key);
                    return (
                      <button
                        key={table.key}
                        onClick={() => toggleTable(table.key)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-all',
                          isSelected ? 'bg-cdata-yellow/5' : 'hover:bg-gray-50'
                        )}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-cdata-black flex-shrink-0" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                        )}
                        <Database className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-700 truncate">{table.displayName}</span>
                        {cat.schemas.length > 1 && (
                          <span className="text-[9px] text-gray-400 ml-auto flex-shrink-0">{table.schema}</span>
                        )}
                      </button>
                    );
                  })}

                  {/* Show more button */}
                  {hasMore && (
                    <button
                      onClick={() => showMoreTables(cat.catalog)}
                      className="w-full py-2 text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors text-center"
                    >
                      Show more ({allTables.length - limit} remaining)
                    </button>
                  )}

                  {allTables.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">No tables found</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lockedTables.length === 0 && (
        <p className="text-xs text-gray-400 text-center">
          No tables selected &mdash; all tables will be available for queries
        </p>
      )}
    </div>
  );
}
