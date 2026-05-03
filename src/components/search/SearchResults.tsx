'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Database, AlertCircle, Sparkles, Table2, Code2, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { CandidateCard } from '@/components/candidates/CandidateCard';
import { EntityCard } from '@/components/entities/EntityCard';
import { CandidateGridSkeleton } from '@/components/ui/LoadingSkeleton';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { buildSchemaMap, mapTableColumns } from '@/lib/schema-mapping';
import type { TableMap, EntityType } from '@/lib/agents/types';
import { getField, getDisplayName, getPrimaryId } from '@/lib/field-resolver';

interface SearchResultsProps {
  className?: string;
}

// Infer a TableMap from the first row's column names (fallback when schema map is unavailable)
function inferTableMap(row: Record<string, any>, resultType: string): TableMap {
  const columns = Object.keys(row).map(name => ({ name, type: 'varchar' }));
  const entityHint = resultType === 'candidates' ? 'Candidates'
    : resultType === 'jobs' ? 'JobRequisitions'
    : resultType === 'placements' ? 'Placements'
    : resultType === 'clients' ? 'Clients'
    : resultType === 'activities' ? 'Activities'
    : 'Results';
  return mapTableColumns(entityHint, columns, 'generic_hr', `[Dynamic].[dbo].[${entityHint}]`);
}

type SortField = 'name' | 'experience' | 'rate' | 'rating' | 'none';
type SortDir = 'asc' | 'desc';

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'name', label: 'Name' },
  { field: 'experience', label: 'Experience' },
  { field: 'rate', label: 'Rate' },
  { field: 'rating', label: 'Rating' },
];

function getSortValue(item: any, field: SortField): number | string {
  switch (field) {
    case 'name':
      return getDisplayName(item).toLowerCase();
    case 'experience':
      return Number(getField(item, 'yearsExperience') || 0);
    case 'rate':
      return Number(getField(item, 'hourlyRate') || 0);
    case 'rating':
      return Number(getField(item, 'clientRating') || 0);
    default:
      return 0;
  }
}

export function SearchResults({ className }: SearchResultsProps) {
  const router = useRouter();
  const {
    searchResults,
    resultType,
    isLoading,
    isAnalyzing,
    hasSearched,
    setSelectedCandidateId,
    currentSQL,
    messages,
  } = useAppStore();

  const [showSQL, setShowSQL] = useState(false);
  const [sortField, setSortField] = useState<SortField>('experience');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Derive the last assistant message (hook-safe: at top, before any returns)
  // Include messages with empty content when analyzing (they have results but no AI text yet)
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant' && (m.content || isAnalyzing));

  // Client-side sort
  const sortedResults = useMemo(() => {
    if (sortField === 'none' || resultType !== 'candidates') return searchResults;
    return [...searchResults].sort((a, b) => {
      const va = getSortValue(a, sortField);
      const vb = getSortValue(b, sortField);
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [searchResults, sortField, sortDir, resultType]);

  // Build a TableMap for entity-aware rendering (must be before early returns)
  const entityTableMap = useMemo(() => {
    if (sortedResults.length === 0) return null;
    return inferTableMap(sortedResults[0], resultType);
  }, [sortedResults, resultType]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction, or reset if already descending
      if (sortDir === 'desc') setSortDir('asc');
      else { setSortField('none'); setSortDir('desc'); }
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('animate-in', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4 text-cdata-yellow animate-pulse" />
          <span className="text-sm text-gray-600">Searching your data...</span>
        </div>
        <CandidateGridSkeleton count={4} />
      </div>
    );
  }

  // No search yet
  if (!hasSearched) {
    return null;
  }

  // No results
  if (searchResults.length === 0 && !lastAssistantMsg?.content) {
    return (
      <div className={cn('animate-in', className)}>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-cdata-black mb-2">No results found</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Try adjusting your search criteria or using different keywords.
          </p>
          {currentSQL && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left">
              <p className="text-xs text-gray-500 mb-1">Generated SQL:</p>
              <code className="text-xs text-gray-600 break-all">{currentSQL}</code>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Handle candidate click
  const handleCandidateClick = (candidate: any) => {
    const candidateId = getPrimaryId(candidate);
    console.log('[SearchResults] Candidate click:', { candidateId, raw: candidate });
    if (candidateId) {
      setSelectedCandidateId(String(candidateId));
      router.push(`/candidate/${encodeURIComponent(String(candidateId))}`);
    }
  };

  const hasAIResponse = !!lastAssistantMsg?.content || isAnalyzing;
  const hasData = sortedResults.length > 0;

  // Render data results based on type
  const renderResults = () => {
    switch (resultType) {
      case 'candidates':
        return (
          <div className="space-y-3">
            {sortedResults.map((candidate, index) => (
              <CandidateCard
                key={getPrimaryId(candidate) || index}
                candidate={candidate}
                onClick={() => handleCandidateClick(candidate)}
              />
            ))}
          </div>
        );

      case 'placements':
      case 'jobs':
      case 'clients':
      case 'activities':
        // Use EntityCard for structured entity types
        if (entityTableMap) {
          return (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              {sortedResults.map((row, index) => (
                <EntityCard
                  key={index}
                  row={row}
                  tableMap={entityTableMap}
                  onClick={resultType === 'placements' || resultType === 'jobs'
                    ? () => handleCandidateClick(row)
                    : undefined
                  }
                />
              ))}
            </div>
          );
        }
        return <GenericResultsTable results={sortedResults} />;

      default:
        // Generic: try EntityCard if we can infer a table map, else fall back to table
        if (entityTableMap && entityTableMap.columns.length >= 2) {
          return (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              {sortedResults.slice(0, 50).map((row, index) => (
                <EntityCard key={index} row={row} tableMap={entityTableMap} />
              ))}
            </div>
          );
        }
        return <GenericResultsTable results={sortedResults} />;
    }
  };

  return (
    <div className={cn('animate-in', className)}>
      {/* Toolbar: Results count + Sort bar + SQL toggle */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2 bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cdata-yellow" />
            <span className="text-sm font-semibold text-cdata-black">
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Sort controls - only for candidates */}
          {resultType === 'candidates' && hasData && (
            <div className="flex items-center gap-1.5 border-l border-gray-200 pl-4">
              <span className="text-xs text-gray-500 font-medium mr-1">Sort:</span>
              {SORT_OPTIONS.map((opt) => {
                const isActive = sortField === opt.field;
                return (
                  <button
                    key={opt.field}
                    onClick={() => toggleSort(opt.field)}
                    className={cn(
                      'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                      isActive
                        ? 'bg-cdata-yellow text-cdata-black border-cdata-yellow shadow-sm'
                        : 'text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    )}
                  >
                    {opt.label}
                    {isActive && (
                      sortDir === 'desc'
                        ? <ArrowDown className="w-3.5 h-3.5" />
                        : <ArrowUp className="w-3.5 h-3.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {currentSQL && (
          <button
            onClick={() => setShowSQL(!showSQL)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
              showSQL
                ? 'bg-gray-900 text-green-400 border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
            )}
          >
            <Code2 className="w-3.5 h-3.5" />
            View SQL
          </button>
        )}
      </div>

      {/* SQL preview */}
      {showSQL && currentSQL && (
        <div className="mb-4 bg-gray-900 rounded-xl p-4 animate-in">
          <code className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all leading-relaxed">
            {currentSQL}
          </code>
        </div>
      )}

      {/* Layout: Data Results (left 65%) + AI Analysis (right 35%) */}
      <div className={cn(
        'gap-5',
        hasAIResponse && hasData ? 'grid grid-cols-[65fr_35fr]' : ''
      )}>
        {/* Data Results Panel - LEFT (65%) */}
        {hasData && (
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Table2 className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Data Results</span>
            </div>
            {renderResults()}
          </div>
        )}

        {/* AI Analysis Panel - RIGHT (35%, sticky) */}
        {hasAIResponse && hasData && (
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">AI Insights</span>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-36">
              <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-cdata-yellow/10 to-transparent border-b border-gray-100">
                <div className="w-6 h-6 bg-cdata-yellow rounded-lg flex items-center justify-center">
                  {isAnalyzing ? (
                    <Loader2 className="w-3.5 h-3.5 text-cdata-black animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-cdata-black" />
                  )}
                </div>
                <span className="text-xs font-semibold text-cdata-black">
                  {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
                </span>
              </div>
              <div className="p-4 max-h-[calc(100vh-280px)] overflow-y-auto">
                {isAnalyzing && !lastAssistantMsg?.content ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-5/6" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <p className="text-xs text-gray-400 mt-4">Generating AI insights from your data...</p>
                  </div>
                ) : lastAssistantMsg?.content ? (
                  <MarkdownRenderer content={lastAssistantMsg.content} />
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* AI-only response (no data results) */}
        {hasAIResponse && !hasData && (
          <div className="w-full">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-cdata-yellow/10 to-transparent border-b border-gray-100">
                <div className="w-6 h-6 bg-cdata-yellow rounded-lg flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-cdata-black" />
                </div>
                <span className="text-xs font-semibold text-cdata-black">AI Response</span>
              </div>
              <div className="p-5">
                <MarkdownRenderer content={lastAssistantMsg!.content} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Placement result card
function PlacementResultCard({ placement }: { placement: any }) {
  const jobTitle = getField(placement, 'jobTitle') || getDisplayName(placement);
  const clientName = getField(placement, 'companyName') || '';
  const startDate = getField(placement, 'startDate') || '';
  const endDate = getField(placement, 'endDate') || 'Present';
  const billRate = getField(placement, 'billRate') || 0;
  const status = getField(placement, 'status') || '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-cdata-black">{jobTitle}</h3>
          <p className="text-sm text-gray-600">{clientName}</p>
          <p className="text-xs text-gray-500 mt-1">
            {startDate} - {endDate}
          </p>
        </div>
        <div className="text-right">
          {billRate > 0 && (
            <p className="text-lg font-bold text-cdata-black">${billRate}/hr</p>
          )}
          {status && (
            <span className={cn(
              'inline-block px-2 py-0.5 rounded text-xs font-medium mt-1',
              status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            )}>
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Job result card
function JobResultCard({ job }: { job: any }) {
  const jobTitle = getField(job, 'jobTitle') || getDisplayName(job);
  const clientName = getField(job, 'companyName') || '';
  const city = getField(job, 'city') || '';
  const state = getField(job, 'state') || '';
  const minRate = getField(job, 'minRate') || 0;
  const maxRate = getField(job, 'maxRate') || 0;
  const status = getField(job, 'status') || '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-cdata-black">{jobTitle}</h3>
          <p className="text-sm text-gray-600">{clientName}</p>
          <p className="text-xs text-gray-500 mt-1">{city}{city && state ? ', ' : ''}{state}</p>
        </div>
        <div className="text-right">
          {(minRate > 0 || maxRate > 0) && (
            <p className="text-sm font-semibold text-cdata-black">
              ${minRate} - ${maxRate}/hr
            </p>
          )}
          {status && (
            <span className={cn(
              'inline-block px-2 py-0.5 rounded text-xs font-medium mt-1',
              status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            )}>
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Generic results table
function GenericResultsTable({ results }: { results: any[] }) {
  if (!results || results.length === 0) return null;

  const columns = Object.keys(results[0]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.slice(0, 8).map((col) => (
                <th key={col} className="px-4 py-3 text-left font-semibold text-cdata-black">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.slice(0, 20).map((row, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-cdata-yellow/5">
                {columns.slice(0, 8).map((col) => (
                  <td key={col} className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {results.length > 20 && (
        <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 text-center">
          Showing 20 of {results.length} results
        </div>
      )}
    </div>
  );
}
