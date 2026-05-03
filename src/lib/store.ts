import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessage, TokenUsage, QueryLog, ResultType, Theme, AppSettings, MCPToolCall } from '@/types';
import type { SchemaMap, TableMap, HRSubDomain, SchemaTier } from '@/lib/agents/types';
import type { PendingMutation } from '@/lib/mutation-manager';

// Navigation views
export type ViewType = 'search' | 'analytics' | 'logs' | 'settings';

// Source info (Phase 13 - multi-source federation)
export interface SourceInfo {
  catalog: string;
  tableCount: number;
  isWritable: boolean;       // false for federated read-only sources
  connectedAt?: number;
}

// Log entry for live terminal
export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning' | 'api' | 'sql';
  message: string;
  details?: string;
}

// Selected candidate type for sidebar/export
export interface SelectedCandidate {
  id: string;
  name: string;
}

interface AppState {
  // Sidebar
  sidebarPinned: boolean;
  setSidebarPinned: (pinned: boolean) => void;
  toggleSidebarPinned: () => void;
  sidebarExpanded: boolean; // true when pinned OR hovered
  setSidebarExpanded: (expanded: boolean) => void;

  // Live logs terminal
  liveLogs: LogEntry[];
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  logsTerminalOpen: boolean;
  setLogsTerminalOpen: (open: boolean) => void;
  toggleLogsTerminal: () => void;

  // Navigation
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any[];
  setSearchResults: (results: any[]) => void;
  resultType: ResultType;
  setResultType: (type: ResultType) => void;
  hasSearched: boolean;
  setHasSearched: (searched: boolean) => void;

  // Selected candidates for export
  selectedCandidates: SelectedCandidate[];
  toggleCandidateSelection: (candidate: SelectedCandidate) => void;
  clearSelectedCandidates: () => void;
  isCandiateSelected: (id: string) => boolean;

  // Chat/Messages state
  messages: ChatMessage[];
  isLoading: boolean;
  isAnalyzing: boolean;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateLastAssistantMessage: (updates: Partial<Omit<ChatMessage, 'id' | 'timestamp' | 'role'>>) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setAnalyzing: (analyzing: boolean) => void;

  // Pending query (from templates)
  pendingQuery: string | null;
  setPendingQuery: (query: string | null) => void;

  // Token tracking
  tokenUsage: {
    today: TokenUsage;
    week: TokenUsage;
    month: TokenUsage;
    total: TokenUsage;
  };
  addTokenUsage: (usage: TokenUsage) => void;
  resetDailyTokens: () => void;

  // Query logs
  queryLogs: QueryLog[];
  addQueryLog: (log: Omit<QueryLog, 'id'>) => void;
  clearQueryLogs: () => void;

  // MCP tool calls log
  mcpCalls: MCPToolCall[];
  addMCPCall: (call: MCPToolCall) => void;

  // SQL preview
  currentSQL: string | null;
  setCurrentSQL: (sql: string | null) => void;
  showSQLPreview: boolean;
  toggleSQLPreview: () => void;

  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Selected candidate for profile view
  selectedCandidateId: string | null;
  setSelectedCandidateId: (id: string | null) => void;

  // Cached candidates list for quick sidebar access
  cachedCandidates: Array<{ id: string; name: string; title: string; status: string }>;
  setCachedCandidates: (candidates: Array<{ id: string; name: string; title: string; status: string }>) => void;
  candidatesLoading: boolean;
  setCandidatesLoading: (loading: boolean) => void;

  // Wizard dismissed flag (persisted so it doesn't re-open on refresh)
  wizardDismissed: boolean;
  setWizardDismissed: (dismissed: boolean) => void;

  // Source registry (Phase 13 - discovered catalogs with metadata)
  sourceRegistry: SourceInfo[];
  setSourceRegistry: (sources: SourceInfo[]) => void;

  // Locked data sources (catalogs selected for scoped queries, now persisted)
  lockedDataSources: string[];
  setLockedDataSources: (sources: string[]) => void;
  toggleLockedDataSource: (catalog: string) => void;

  // Pending mutations (Phase 12 - optimistic updates, NOT persisted)
  pendingMutations: PendingMutation[];
  addPendingMutation: (mutation: PendingMutation) => void;
  updatePendingMutation: (id: string, updates: Partial<PendingMutation>) => void;
  removePendingMutation: (id: string) => void;
  clearPendingMutations: () => void;

  // Schema map (Phase 10 - dynamic schema awareness, Phase 11 - progressive tiers)
  schemaMap: SchemaMap | null;
  setSchemaMap: (map: SchemaMap | null) => void;
  schemaSubDomain: HRSubDomain | null;
  schemaTier: SchemaTier | null;
  setSchemaTier: (tier: SchemaTier | null) => void;
  schemaTimestamp: number | null;
  schemaResolving: boolean;
  setSchemaResolving: (resolving: boolean) => void;
  primaryTableMap: TableMap | null;
  setPrimaryTableMap: (map: TableMap | null) => void;
  lastIntent: string | null;
  setLastIntent: (intent: string | null) => void;
}

const defaultTokenUsage: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  estimatedCost: 0,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarPinned: false,
      setSidebarPinned: (pinned) => set({ sidebarPinned: pinned }),
      toggleSidebarPinned: () => set((state) => ({ sidebarPinned: !state.sidebarPinned })),
      sidebarExpanded: false,
      setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),

      // Live logs terminal
      liveLogs: [],
      addLog: (log) =>
        set((state) => ({
          liveLogs: [
            {
              ...log,
              id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date(),
            },
            ...state.liveLogs,
          ].slice(0, 500), // Keep last 500 logs
        })),
      clearLogs: () => set({ liveLogs: [] }),
      logsTerminalOpen: false,
      setLogsTerminalOpen: (open) => set({ logsTerminalOpen: open }),
      toggleLogsTerminal: () => set((state) => ({ logsTerminalOpen: !state.logsTerminalOpen })),

      // Navigation
      activeView: 'search',
      setActiveView: (view) => set({ activeView: view }),

      // Search state
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
      searchResults: [],
      setSearchResults: (results) => set({ searchResults: results }),
      resultType: 'candidates',
      setResultType: (type) => set({ resultType: type }),
      hasSearched: false,
      setHasSearched: (searched) => set({ hasSearched: searched }),

      // Selected candidates
      selectedCandidates: [],
      toggleCandidateSelection: (candidate) =>
        set((state) => {
          const isSelected = state.selectedCandidates.some((c) => c.id === candidate.id);
          if (isSelected) {
            return {
              selectedCandidates: state.selectedCandidates.filter((c) => c.id !== candidate.id),
            };
          }
          return {
            selectedCandidates: [...state.selectedCandidates, candidate],
          };
        }),
      clearSelectedCandidates: () => set({ selectedCandidates: [] }),
      isCandiateSelected: (id) => {
        // This is a derived value - we'll handle it differently
        return false;
      },

      // Chat/Messages state
      messages: [],
      isLoading: false,
      isAnalyzing: false,
      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date(),
            },
          ],
        })),
      updateLastAssistantMessage: (updates) =>
        set((state) => {
          const msgs = [...state.messages];
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'assistant') {
              msgs[i] = { ...msgs[i], ...updates };
              break;
            }
          }
          return { messages: msgs };
        }),
      clearMessages: () => set({ messages: [] }),
      setLoading: (loading) => set({ isLoading: loading }),
      setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

      // Pending query
      pendingQuery: null,
      setPendingQuery: (query) => set({ pendingQuery: query }),

      // Token tracking
      tokenUsage: {
        today: { ...defaultTokenUsage },
        week: { ...defaultTokenUsage },
        month: { ...defaultTokenUsage },
        total: { ...defaultTokenUsage },
      },
      addTokenUsage: (usage) =>
        set((state) => ({
          tokenUsage: {
            today: {
              promptTokens: state.tokenUsage.today.promptTokens + usage.promptTokens,
              completionTokens: state.tokenUsage.today.completionTokens + usage.completionTokens,
              totalTokens: state.tokenUsage.today.totalTokens + usage.totalTokens,
              estimatedCost: state.tokenUsage.today.estimatedCost + usage.estimatedCost,
            },
            week: {
              promptTokens: state.tokenUsage.week.promptTokens + usage.promptTokens,
              completionTokens: state.tokenUsage.week.completionTokens + usage.completionTokens,
              totalTokens: state.tokenUsage.week.totalTokens + usage.totalTokens,
              estimatedCost: state.tokenUsage.week.estimatedCost + usage.estimatedCost,
            },
            month: {
              promptTokens: state.tokenUsage.month.promptTokens + usage.promptTokens,
              completionTokens: state.tokenUsage.month.completionTokens + usage.completionTokens,
              totalTokens: state.tokenUsage.month.totalTokens + usage.totalTokens,
              estimatedCost: state.tokenUsage.month.estimatedCost + usage.estimatedCost,
            },
            total: {
              promptTokens: state.tokenUsage.total.promptTokens + usage.promptTokens,
              completionTokens: state.tokenUsage.total.completionTokens + usage.completionTokens,
              totalTokens: state.tokenUsage.total.totalTokens + usage.totalTokens,
              estimatedCost: state.tokenUsage.total.estimatedCost + usage.estimatedCost,
            },
          },
        })),
      resetDailyTokens: () =>
        set((state) => ({
          tokenUsage: {
            ...state.tokenUsage,
            today: { ...defaultTokenUsage },
          },
        })),

      // Query logs
      queryLogs: [],
      addQueryLog: (log) =>
        set((state) => ({
          queryLogs: [
            {
              ...log,
              id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            },
            ...state.queryLogs,
          ].slice(0, 200), // Keep last 200 logs
        })),
      clearQueryLogs: () => set({ queryLogs: [] }),

      // MCP tool calls
      mcpCalls: [],
      addMCPCall: (call) =>
        set((state) => ({
          mcpCalls: [call, ...state.mcpCalls].slice(0, 100),
        })),

      // SQL preview
      currentSQL: null,
      setCurrentSQL: (sql) => set({ currentSQL: sql }),
      showSQLPreview: false,
      toggleSQLPreview: () => set((state) => ({ showSQLPreview: !state.showSQLPreview })),

      // Settings
      settings: {
        theme: 'light',
        resultsPerPage: 25,
        showSQLQueries: true,
        llmProvider: 'groq',
        selectedModel: 'llama-3.3-70b-versatile',
        enableRouting: false,
      },
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Selected candidate
      selectedCandidateId: null,
      setSelectedCandidateId: (id) => set({ selectedCandidateId: id }),

      // Cached candidates
      cachedCandidates: [],
      setCachedCandidates: (candidates) => set({ cachedCandidates: candidates }),
      candidatesLoading: false,
      setCandidatesLoading: (loading) => set({ candidatesLoading: loading }),

      // Wizard dismissed
      wizardDismissed: false,
      setWizardDismissed: (dismissed) => set({ wizardDismissed: dismissed }),

      // Source registry
      sourceRegistry: [],
      setSourceRegistry: (sources) => set({ sourceRegistry: sources }),

      // Locked data sources (persisted for session continuity)
      lockedDataSources: [],
      setLockedDataSources: (sources) => set({ lockedDataSources: sources }),
      toggleLockedDataSource: (catalog) => set((state) => {
        const sources = state.lockedDataSources.includes(catalog)
          ? state.lockedDataSources.filter((s) => s !== catalog)
          : [...state.lockedDataSources, catalog];
        return { lockedDataSources: sources };
      }),

      // Pending mutations (not persisted — in-memory only)
      pendingMutations: [],
      addPendingMutation: (mutation) => set((state) => ({
        pendingMutations: [mutation, ...state.pendingMutations].slice(0, 50),
      })),
      updatePendingMutation: (id, updates) => set((state) => ({
        pendingMutations: state.pendingMutations.map(m =>
          m.id === id ? { ...m, ...updates } : m
        ),
      })),
      removePendingMutation: (id) => set((state) => ({
        pendingMutations: state.pendingMutations.filter(m => m.id !== id),
      })),
      clearPendingMutations: () => set({ pendingMutations: [] }),

      // Schema map + progressive tiers
      schemaMap: null,
      setSchemaMap: (map) => set({
        schemaMap: map,
        schemaSubDomain: map?.subDomain || null,
        schemaTimestamp: map?.timestamp || null,
      }),
      schemaSubDomain: null,
      schemaTier: null,
      setSchemaTier: (tier) => set({ schemaTier: tier }),
      schemaTimestamp: null,
      schemaResolving: false,
      setSchemaResolving: (resolving) => set({ schemaResolving: resolving }),
      primaryTableMap: null,
      setPrimaryTableMap: (map) => set({ primaryTableMap: map }),
      lastIntent: null,
      setLastIntent: (intent) => set({ lastIntent: intent }),
    }),
    {
      name: 'talent-intel-storage',
      partialize: (state) => ({
        tokenUsage: state.tokenUsage,
        queryLogs: state.queryLogs,
        settings: state.settings,
        wizardDismissed: state.wizardDismissed,
        cachedCandidates: state.cachedCandidates, // persisted so sidebar survives refresh without re-fetching
        lockedDataSources: state.lockedDataSources, // Phase 13: persist selected sources across refresh
      }),
    }
  )
);

// Utility function to get usage by period
export function getUsageSummary(logs: QueryLog[], period: 'day' | 'week' | 'month') {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      const dayOfWeek = now.getDay();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const filteredLogs = logs.filter((log) => new Date(log.timestamp) >= startDate);

  return filteredLogs.reduce(
    (acc, log) => ({
      promptTokens: acc.promptTokens + log.tokenUsage.promptTokens,
      completionTokens: acc.completionTokens + log.tokenUsage.completionTokens,
      totalTokens: acc.totalTokens + log.tokenUsage.totalTokens,
      estimatedCost: acc.estimatedCost + log.tokenUsage.estimatedCost,
      queryCount: acc.queryCount + 1,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0, queryCount: 0 }
  );
}
