'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { SearchBar } from '@/components/search/SearchBar';
import { QuickQueries } from '@/components/search/QuickQueries';
import { SearchResults } from '@/components/search/SearchResults';
import { TokenUsageBar } from '@/components/ui/TokenUsageBar';
import { ExportBar } from '@/components/ui/ExportBar';
import { ModelSelector } from '@/components/ui/ModelSelector';
import { LiveTerminal } from '@/components/ui/LiveTerminal';
import { MutationToastContainer } from '@/components/ui/MutationToast';
import { ProfileMenu } from '@/components/auth/ProfileMenu';
import { ConnectionWizard } from '@/components/wizard/ConnectionWizard';
import { SourceSelector } from '@/components/sources/SourceSelector';
import { EntityNavigator } from '@/components/navigation/EntityNavigator';
import { ContextPanel } from '@/components/detail/ContextPanel';
import { ViewSwitcher, ViewMode } from '@/components/views/ViewSwitcher';
import { useAppStore, ViewType } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ResultType, TokenUsage, LLM_MODELS } from '@/types';
import {
  Settings,
  Database,
  Zap,
  Clock,
  Users,
  Briefcase,
  ArrowLeft,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Server,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

// Analytics Page Component
import { AnalyticsPage } from './views/AnalyticsPage';
// Logs Page Component
import { LogsPage } from './views/LogsPage';
// Settings Page Component
import { SettingsPage } from './views/SettingsPage';

// Detect result type from SQL (enhanced: handles any table naming pattern)
function detectResultType(sql: string): ResultType {
  if (!sql) return 'generic';
  const sqlLower = sql.toLowerCase();

  // Check for table name patterns (case-insensitive, any catalog/schema prefix)
  if (/\bcandidates?\b/i.test(sqlLower)) return 'candidates';
  if (/\bplacements?\b/i.test(sqlLower)) return 'placements';
  if (/\b(jobrequisitions?|job_requisitions?|jobs?)\b/i.test(sqlLower)) return 'jobs';
  if (/\bclients?\b/i.test(sqlLower)) return 'clients';
  if (/\bactivit(y|ies)\b/i.test(sqlLower)) return 'activities';

  return 'generic';
}

// Search View Component
function SearchView() {
  const {
    searchResults,
    hasSearched,
    isLoading,
    setSearchResults,
    setResultType,
    setHasSearched,
    setCurrentSQL,
    addTokenUsage,
    addQueryLog,
    messages,
    addMessage,
    setLoading,
    settings,
    addLog,
    queryLogs,
  } = useAppStore();

  const { isAuthenticated, hasCredentials } = useAuthStore();
  const { wizardDismissed, setWizardDismissed } = useAppStore();
  const [wizardOpen, setWizardOpen] = useState(false);

  // Auto-open wizard ONLY on first login if no credentials AND not previously dismissed
  useEffect(() => {
    if (isAuthenticated && !hasCredentials() && !wizardDismissed) {
      const timer = setTimeout(() => setWizardOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, hasCredentials, wizardDismissed]);

  const handleWizardClose = () => {
    setWizardOpen(false);
    setWizardDismissed(true);
  };

  const {
    setAnalyzing,
    updateLastAssistantMessage,
    isAnalyzing,
    lockedDataSources,
    setLastIntent,
    setSchemaMap,
  } = useAppStore();

  const handleSearch = async (query: string) => {
    if (!query.trim() || isLoading) return;

    setLoading(true);
    setHasSearched(true);
    const startTime = Date.now();

    addLog({ type: 'info', message: `Query: "${query}"` });
    addLog({ type: 'api', message: `Calling /api/chat with ${settings.llmProvider}/${settings.selectedModel}` });

    try {
      addMessage({ role: 'user', content: query });

      // ── Phase 1: Get data fast (skip AI analysis) ──
      const dataResponse = await apiClient('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: query,
          conversationHistory: messages.slice(-10),
          skipAnalysis: true,
          lockedDataSources: lockedDataSources.length > 0 ? lockedDataSources : undefined,
        }),
      });

      const dataPayload = await dataResponse.json();
      const dataDuration = Date.now() - startTime;

      if (dataPayload.error) {
        addLog({ type: 'error', message: dataPayload.error });
        addMessage({ role: 'assistant', content: `Error: ${dataPayload.error}` });
        setSearchResults([]);
        setLoading(false);
        return;
      }

      const resultType = detectResultType(dataPayload.sql || '');

      // Capture intent and schema map from LangGraph response
      if (dataPayload.intent) setLastIntent(dataPayload.intent);
      if (dataPayload.schemaMap) setSchemaMap(dataPayload.schemaMap);

      if (dataPayload.sql) {
        addLog({ type: 'sql', message: 'Generated SQL', details: dataPayload.sql.substring(0, 100) + '...' });
      }
      addLog({ type: 'success', message: `Data loaded in ${dataDuration}ms`, details: `${dataPayload.results?.length || 0} rows returned` });

      // Show data immediately with a placeholder for AI analysis
      addMessage({
        role: 'assistant',
        content: '', // empty until analysis completes
        sql: dataPayload.sql,
        results: dataPayload.results,
        resultType,
        tokenUsage: dataPayload.tokenUsage,
      });

      setSearchResults(dataPayload.results || []);
      setResultType(resultType);
      if (dataPayload.sql) setCurrentSQL(dataPayload.sql);
      if (dataPayload.tokenUsage) addTokenUsage(dataPayload.tokenUsage);

      // Stop the main loading spinner — data is visible now
      setLoading(false);

      // ── Phase 2: Get AI analysis asynchronously ──
      const hasDataResults = dataPayload.results && dataPayload.results.length > 0;
      if (hasDataResults && dataPayload.sql) {
        setAnalyzing(true);
        addLog({ type: 'api', message: 'Running AI analysis on results...' });

        try {
          const analysisResponse = await apiClient('/api/chat', {
            method: 'POST',
            body: JSON.stringify({
              message: query,
              conversationHistory: messages.slice(-10),
              analyzeOnly: true,
              providedSQL: dataPayload.sql,
              providedResults: dataPayload.results.slice(0, 50), // cap for token limits
            }),
          });

          const analysisPayload = await analysisResponse.json();
          const totalDuration = Date.now() - startTime;

          if (analysisPayload.response) {
            // Update the last assistant message with the AI analysis
            updateLastAssistantMessage({ content: analysisPayload.response });
            addLog({ type: 'success', message: `AI analysis complete (${totalDuration}ms total)` });
          }

          if (analysisPayload.tokenUsage) {
            addTokenUsage(analysisPayload.tokenUsage);
            addLog({
              type: 'info',
              message: `Analysis tokens: ${analysisPayload.tokenUsage.totalTokens}`,
              details: `$${analysisPayload.tokenUsage.estimatedCost.toFixed(4)}`,
            });
          }

          // Log the full query
          const combinedTokens = {
            promptTokens: (dataPayload.tokenUsage?.promptTokens || 0) + (analysisPayload.tokenUsage?.promptTokens || 0),
            completionTokens: (dataPayload.tokenUsage?.completionTokens || 0) + (analysisPayload.tokenUsage?.completionTokens || 0),
            totalTokens: (dataPayload.tokenUsage?.totalTokens || 0) + (analysisPayload.tokenUsage?.totalTokens || 0),
            estimatedCost: (dataPayload.tokenUsage?.estimatedCost || 0) + (analysisPayload.tokenUsage?.estimatedCost || 0),
          };

          addQueryLog({
            timestamp: new Date(),
            query,
            sql: dataPayload.sql || '',
            success: true,
            tokenUsage: combinedTokens,
            duration: totalDuration,
            rowCount: dataPayload.results?.length || 0,
            resultType,
          });
        } catch (analysisErr) {
          addLog({ type: 'warning', message: 'AI analysis failed, data still available' });
          // Still log the query even if analysis fails
          addQueryLog({
            timestamp: new Date(),
            query,
            sql: dataPayload.sql || '',
            success: true,
            tokenUsage: dataPayload.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
            duration: dataDuration,
            rowCount: dataPayload.results?.length || 0,
            resultType,
          });
        } finally {
          setAnalyzing(false);
        }
      } else {
        // No data results or no SQL — log the query as-is
        addQueryLog({
          timestamp: new Date(),
          query,
          sql: dataPayload.sql || '',
          success: !dataPayload.error,
          error: dataPayload.error,
          tokenUsage: dataPayload.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
          duration: dataDuration,
          rowCount: 0,
          resultType,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog({ type: 'error', message: `Request failed: ${errorMsg}` });
      addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please check your API configuration.',
      });
      setSearchResults([]);
      setLoading(false);
      setAnalyzing(false);
    }
  };

  // Get recent queries for homepage
  const recentQueries = queryLogs
    .slice(0, 5)
    .map((log) => ({ query: log.query, time: log.timestamp, success: log.success }));

  return (
    <div className="min-h-screen flex flex-col">
      {/* Connection Wizard Modal */}
      <ConnectionWizard isOpen={wizardOpen} onClose={handleWizardClose} />

      {/* Centered state - before any search */}
      {!hasSearched && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 animate-in">
          {/* Top right controls */}
          <div className="absolute top-4 right-6 flex items-center gap-3">
            <button
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-cdata-black bg-cdata-yellow hover:bg-cdata-yellow/90 rounded-lg shadow-sm transition-all"
            >
              <Settings className="w-4 h-4" />
              Connection Setup
            </button>
            <ProfileMenu onOpenWizard={() => setWizardOpen(true)} />
          </div>

          {/* Logo/Title */}
          <div className="text-center mb-5">
            <div className="w-14 h-14 bg-cdata-yellow rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <span className="font-bold text-cdata-black text-2xl">T</span>
            </div>
            <h1 className="text-2xl font-bold text-cdata-black mb-1 font-grafier">Talent Intelligence</h1>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Query candidates, jobs, and placements using natural language.
              Search across multiple data sources in one unified view.
            </p>
          </div>

          {/* Centered search bar */}
          <SearchBar centered onSearch={handleSearch} className="mb-6" />

          {/* Quick queries */}
          <div className="w-full max-w-2xl">
            <p className="text-xs text-gray-500 text-center mb-3">Try a quick search:</p>
            <QuickQueries variant="horizontal" />
          </div>

          {/* Homepage panels */}
          <div className="w-full max-w-3xl mt-6 grid grid-cols-3 gap-4">
            {/* Data Sources - Interactive */}
            <DataSourcesCard onOpenWizard={() => setWizardOpen(true)} />

            {/* LLM Status */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-cdata-yellow" />
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LLM Engine</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Provider</span>
                  <span className="text-xs font-medium capitalize">{settings.llmProvider}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Model</span>
                  <span className="text-xs font-medium truncate ml-2">
                    {LLM_MODELS[settings.llmProvider]?.find((m) => m.id === settings.selectedModel)?.name || settings.selectedModel}
                  </span>
                </div>
                <ModelSelector />
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-cdata-yellow" />
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent Queries</h3>
              </div>
              {recentQueries.length > 0 ? (
                <div className="space-y-1.5">
                  {recentQueries.map((rq, i) => (
                    <button
                      key={i}
                      onClick={() => handleSearch(rq.query)}
                      className="w-full text-left text-xs text-gray-600 hover:text-cdata-black truncate py-0.5 transition-colors"
                    >
                      <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1.5', rq.success ? 'bg-green-400' : 'bg-red-400')} />
                      {rq.query}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No queries yet. Try one above!</p>
              )}
            </div>
          </div>

          {/* Footer with connection status + branding */}
          <div className="mt-5 flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-cdata-black bg-white border border-gray-200 rounded-lg hover:border-cdata-yellow hover:shadow-sm transition-all"
              >
                <Settings className="w-4 h-4" />
                Connection Setup
              </button>
              <ConnectionStatusIndicator />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Powered by <span className="font-semibold text-cdata-black">CData Connect AI</span>
            </p>
          </div>
        </div>
      )}

      {/* Results state - 3-panel layout (Phase 14a) */}
      {hasSearched && (
        <ResultsLayout
          onSearch={handleSearch}
          onOpenWizard={() => setWizardOpen(true)}
        />
      )}
    </div>
  );
}

// 3-Panel Results Layout (Phase 14a)
function ResultsLayout({
  onSearch,
  onOpenWizard,
}: {
  onSearch: (q: string) => void;
  onOpenWizard: () => void;
}) {
  const {
    searchResults,
    resultType,
    setHasSearched,
    setSearchResults,
    lockedDataSources,
  } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);

  const handleSelectEntity = (id: string) => {
    const row = searchResults.find((r: any) => {
      const rowId = r.CandidateId || r.candidateId || r.ReqId || r.reqId ||
        r.PlacementId || r.placementId || r.ClientId || r.clientId ||
        r.ActivityId || r.activityId;
      return String(rowId) === id;
    });
    if (row) {
      setSelectedRow(row);
      setRightPanelOpen(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col animate-in h-screen">
      {/* Top Bar: Source Chips + Search Bar + Controls */}
      <div className="sticky top-0 bg-surface-DEFAULT/95 backdrop-blur-sm z-30 border-b border-border-subtle">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Back to home */}
          <button
            onClick={() => {
              setHasSearched(false);
              setSearchResults([]);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-cdata-black border border-border-subtle"
            title="Back to home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Search bar */}
          <SearchBar onSearch={onSearch} className="flex-1 max-w-2xl" />

          {/* View switcher */}
          <ViewSwitcher
            current={viewMode}
            onChange={setViewMode}
            availableModes={['cards', 'table']}
          />

          {/* Panel toggles */}
          <div className="flex items-center gap-1 border-l border-border-subtle pl-2">
            <button
              onClick={() => setLeftPanelOpen(!leftPanelOpen)}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                leftPanelOpen ? 'bg-cdata-yellow/20 text-cdata-black' : 'text-gray-400 hover:bg-gray-100'
              )}
              title={leftPanelOpen ? 'Hide navigator' : 'Show navigator'}
            >
              {leftPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                rightPanelOpen ? 'bg-cdata-yellow/20 text-cdata-black' : 'text-gray-400 hover:bg-gray-100'
              )}
              title={rightPanelOpen ? 'Hide details' : 'Show details'}
            >
              {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
          </div>

          {/* Setup + Profile */}
          <button
            onClick={onOpenWizard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-cdata-black bg-white border border-border-subtle rounded-lg hover:border-cdata-yellow transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <ProfileMenu onOpenWizard={onOpenWizard} />
        </div>

        {/* Source selector chips */}
        <div className="px-4 pb-2">
          <SourceSelector />
        </div>
      </div>

      {/* 3-Panel Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Entity Navigator */}
        {leftPanelOpen && (
          <div className="w-56 flex-shrink-0 border-r border-border-subtle bg-surface-raised overflow-hidden">
            <EntityNavigator
              results={searchResults}
              resultType={resultType}
              onSelectEntity={handleSelectEntity}
            />
          </div>
        )}

        {/* Center Panel: Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-16">
          <div className="max-w-7xl mx-auto">
            {/* Quick queries below search on results page */}
            <QuickQueries className="mb-4" />
            <SearchResults />
          </div>
        </div>

        {/* Right Panel: Context / Detail */}
        {rightPanelOpen && (
          <div className="w-72 flex-shrink-0 border-l border-border-subtle overflow-hidden">
            <ContextPanel
              selectedRow={selectedRow}
              onClose={() => {
                setRightPanelOpen(false);
                setSelectedRow(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Live connection status indicator
function ConnectionStatusIndicator() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [catalogCount, setCatalogCount] = useState(0);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await apiClient('/api/catalogs');
        const data = await res.json();
        if (data.catalogs && data.catalogs.length > 0) {
          setStatus('connected');
          setCatalogCount(data.totalCatalogs || data.catalogs.length);
        } else {
          setStatus('disconnected');
        }
      } catch {
        setStatus('disconnected');
      }
    };
    check();
  }, []);

  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={cn(
        'w-2 h-2 rounded-full',
        status === 'connected' ? 'bg-green-500' :
        status === 'checking' ? 'bg-yellow-400 animate-pulse' :
        'bg-gray-300'
      )} />
      <span className={cn(
        status === 'connected' ? 'text-green-600' :
        status === 'checking' ? 'text-yellow-600' :
        'text-gray-400'
      )}>
        CData Connect AI
        {status === 'connected' && catalogCount > 0 && ` (${catalogCount} sources)`}
      </span>
    </span>
  );
}

// Interactive Data Sources Card for Homepage
function DataSourcesCard({ onOpenWizard }: { onOpenWizard: () => void }) {
  const [catalogData, setCatalogData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { lockedDataSources, toggleLockedDataSource } = useAppStore();

  const fetchCatalogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient('/api/catalogs');
      const data = await res.json();
      if (data.catalogs) {
        setCatalogData(data);
      }
    } catch {
      // Ignore - will show default state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogs();
  }, [fetchCatalogs]);

  const totalCatalogs = catalogData?.totalCatalogs || 0;
  const totalTables = catalogData?.totalTables || 0;
  const isLive = catalogData && totalCatalogs > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cdata-yellow" />
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Data Sources</h3>
        </div>
        <button
          onClick={fetchCatalogs}
          disabled={isLoading}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn('w-3 h-3 text-gray-400', isLoading && 'animate-spin')} />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Catalogs</span>
          <span className="text-xs font-medium">{isLive ? totalCatalogs : '...'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Tables</span>
          <span className="text-xs font-medium">{isLive ? totalTables : '...'}</span>
        </div>
        {lockedDataSources.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Active</span>
            <span className="text-xs font-medium text-cdata-black">{lockedDataSources.length} locked</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <div className={cn('w-2 h-2 rounded-full', isLive ? 'bg-green-500' : isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-gray-300')} />
          <span className={cn('text-[10px]', isLive ? 'text-green-600' : isLoading ? 'text-yellow-600' : 'text-gray-400')}>
            {isLive ? 'Live' : isLoading ? 'Discovering...' : 'Not connected'}
          </span>
        </div>
      </div>

      {/* Expandable + selectable catalog list */}
      {isLive && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-700 w-full"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {expanded ? 'Hide sources' : 'Select sources'}
          </button>
          {expanded && (
            <div className="mt-1.5 space-y-0.5 max-h-36 overflow-y-auto">
              {catalogData.catalogs.map((cat: any) => {
                const isLocked = lockedDataSources.includes(cat.catalog);
                return (
                  <button
                    key={cat.catalog}
                    onClick={() => toggleLockedDataSource(cat.catalog)}
                    className={cn(
                      'w-full flex items-center gap-1.5 text-[10px] px-1.5 py-1 rounded transition-colors text-left',
                      isLocked ? 'bg-cdata-yellow/10' : 'hover:bg-gray-50'
                    )}
                  >
                    <div className={cn(
                      'w-3 h-3 rounded border flex items-center justify-center flex-shrink-0',
                      isLocked ? 'bg-cdata-yellow border-cdata-yellow' : 'border-gray-300'
                    )}>
                      {isLocked && <span className="text-[8px] text-cdata-black font-bold">&#10003;</span>}
                    </div>
                    <Server className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                    <span className={cn('truncate', isLocked ? 'text-cdata-black font-medium' : 'text-gray-600')}>{cat.catalog}</span>
                    <span className="text-gray-400 ml-auto flex-shrink-0">{cat.tableCount}</span>
                  </button>
                );
              })}
              {lockedDataSources.length === 0 && (
                <p className="text-[9px] text-gray-400 mt-1">Click to lock sources. Queries will only search locked sources.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Setup link if not connected */}
      {!isLive && !isLoading && (
        <button
          onClick={onOpenWizard}
          className="mt-2 text-[10px] text-blue-500 hover:text-blue-600"
        >
          Configure connection
        </button>
      )}
    </div>
  );
}

// Main App Component
export default function TalentIntelligencePlatform() {
  const { activeView, sidebarExpanded } = useAppStore();
  const [wizardOpen, setWizardOpen] = useState(false);

  const renderView = () => {
    switch (activeView) {
      case 'search':
        return <SearchView />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'logs':
        return <LogsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <SearchView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content area - dynamic margin based on sidebar state */}
      <main
        className={cn(
          'min-h-screen pb-16 transition-all duration-300',
          sidebarExpanded ? 'ml-64' : 'ml-16'
        )}
      >
        {renderView()}
      </main>

      {/* Export bar for selected candidates */}
      <ExportBar />

      {/* Live logging terminal */}
      <LiveTerminal />

      {/* Persistent token usage bar */}
      <TokenUsageBar />

      {/* Mutation toasts (Phase 12d) */}
      <MutationToastContainer />
    </div>
  );
}
