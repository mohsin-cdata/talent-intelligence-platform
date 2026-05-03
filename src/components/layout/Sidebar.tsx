'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  LayoutDashboard,
  TrendingUp,
  ScrollText,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Users,
  CheckCircle,
  Loader2,
  RefreshCw,
  PinOff,
  Pin,
  Compass,
} from 'lucide-react';
import { useAppStore, ViewType } from '@/lib/store';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { getField, getDisplayName, getPrimaryId, getSubtitle } from '@/lib/field-resolver';
import type { HRSubDomain } from '@/lib/agents/types';

const navItems: { id: ViewType | 'home'; icon: typeof Search; label: string; path: string }[] = [
  { id: 'home', icon: LayoutDashboard, label: 'Home', path: '/' },
  { id: 'search', icon: Compass, label: 'Search', path: '/' },
  { id: 'analytics', icon: TrendingUp, label: 'Analytics', path: '/?view=analytics' },
  { id: 'logs', icon: ScrollText, label: 'Logs', path: '/?view=logs' },
  { id: 'settings', icon: SlidersHorizontal, label: 'Settings', path: '/?view=settings' },
];

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const fetchAttempted = useRef(false);
  const {
    activeView,
    setActiveView,
    selectedCandidates,
    tokenUsage,
    cachedCandidates,
    setCachedCandidates,
    candidatesLoading,
    setCandidatesLoading,
    sidebarPinned,
    toggleSidebarPinned,
    setSidebarExpanded,
    hasSearched,
    setHasSearched,
    setSearchResults,
    clearMessages,
    setSearchQuery,
    schemaSubDomain,
  } = useAppStore();

  // Sidebar is expanded if pinned OR hovered
  const isExpanded = sidebarPinned || isHovered;

  // Sync expansion state into store so content areas can shift accordingly
  useEffect(() => {
    setSidebarExpanded(isExpanded);
  }, [isExpanded, setSidebarExpanded]);

  // Determine if we're on the main page or a sub-page
  const isOnMainPage = pathname === '/';

  // Fetch candidates once on mount (or when cache is explicitly cleared)
  // IMPORTANT: do NOT include candidatesLoading in deps — that caused an infinite loop
  // where each completed fetch (loading: true→false) re-triggered another fetch.
  useEffect(() => {
    if (cachedCandidates.length > 0) return; // already populated
    if (fetchAttempted.current) return;       // already tried this mount cycle
    fetchAttempted.current = true;

    const fetchCandidates = async () => {
      setCandidatesLoading(true);
      try {
        const response = await apiClient('/api/candidates', { method: 'GET' });
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const candidates = data.results.map((c: any) => ({
            id: getPrimaryId(c) || '',
            name: getDisplayName(c),
            title: getSubtitle(c),
            status: getField(c, 'status') || '',
          }));
          setCachedCandidates(candidates);
        }
      } catch (err) {
        console.error('Failed to fetch candidates:', err);
      } finally {
        setCandidatesLoading(false);
      }
    };

    fetchCandidates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedCandidates.length]); // re-run only when cache is cleared (length → 0)

  const goHome = () => {
    setActiveView('search');
    setHasSearched(false);
    setSearchResults([]);
    setSearchQuery('');
    clearMessages();
    if (!isOnMainPage) {
      router.push('/');
    }
  };

  const handleNavClick = (item: (typeof navItems)[0]) => {
    if (item.id === 'home') {
      goHome();
      return;
    }
    if (item.id === 'search') {
      // If already on search view, focus the search bar by going to search mode
      setActiveView('search');
      setHasSearched(true); // show the search results view with search bar
      if (!isOnMainPage) router.push('/');
      return;
    }
    setActiveView(item.id as ViewType);
    if (!isOnMainPage) {
      router.push('/');
    }
  };

  const refreshCandidates = async () => {
    fetchAttempted.current = false; // allow the useEffect to re-run after cache clear
    setCandidatesLoading(true);
    setCachedCandidates([]);
    try {
      const response = await apiClient('/api/candidates', { method: 'GET' });

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const candidates = data.results.map((c: any) => ({
          id: getPrimaryId(c) || '',
          name: getDisplayName(c),
          title: getSubtitle(c),
          status: getField(c, 'status') || '',
        }));
        setCachedCandidates(candidates);
      }
    } catch (err) {
      console.error('Failed to refresh candidates:', err);
    } finally {
      setCandidatesLoading(false);
    }
  };

  // Get status color - supports canonical stage mapping
  const getStatusColor = (status: string) => {
    const lower = (status || '').toLowerCase();
    // Canonical stages + platform-specific values
    if (['active', 'screening', 'qualified'].includes(lower)) return 'bg-green-500';
    if (['bench', 'sourced', 'new'].includes(lower)) return 'bg-blue-500';
    if (['placed', 'hired', 'onboarded'].includes(lower)) return 'bg-purple-500';
    if (['passive', 'inactive'].includes(lower)) return 'bg-gray-400';
    if (['submitted', 'shortlisted'].includes(lower)) return 'bg-indigo-500';
    if (['interview', 'interviewed'].includes(lower)) return 'bg-amber-500';
    if (['offer', 'offered'].includes(lower)) return 'bg-orange-500';
    return 'bg-gray-300';
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-40 flex flex-col transition-all duration-300 ease-in-out',
        isExpanded ? 'w-64' : 'w-16'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo & Pin Button */}
      <div className="h-16 flex items-center border-b border-gray-200 px-3">
        <button
          onClick={goHome}
          className="w-10 h-10 bg-cdata-yellow rounded-xl flex items-center justify-center flex-shrink-0 hover:scale-110 hover:shadow-md transition-all duration-200 cursor-pointer"
          title="Go to Home"
        >
          <span className="font-bold text-cdata-black text-xl">T</span>
        </button>
        <div
          className={cn(
            'ml-3 flex-1 overflow-hidden transition-all duration-300',
            isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
          )}
        >
          <h1 className="font-bold text-cdata-black whitespace-nowrap">Talent Intel</h1>
          <p className="text-xs text-gray-500 whitespace-nowrap">AI Platform</p>
        </div>
        {/* Pin/Unpin button - only visible when expanded */}
        {isExpanded && (
          <button
            onClick={toggleSidebarPinned}
            className={cn(
              'p-1.5 rounded-lg transition-colors flex-shrink-0',
              sidebarPinned
                ? 'bg-cdata-yellow text-cdata-black'
                : 'hover:bg-gray-100 text-gray-400'
            )}
            title={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
          >
            {sidebarPinned ? (
              <PinOff className="w-4 h-4" />
            ) : (
              <Pin className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col py-4 px-2 gap-1">
        {navItems.map((item) => {
          // Home is active when on main page with search view and no search yet
          // Search is active when on main page with search view and has searched
          const isActive = item.id === 'home'
            ? isOnMainPage && activeView === 'search' && !hasSearched
            : item.id === 'search'
            ? isOnMainPage && activeView === 'search' && hasSearched
            : isOnMainPage && activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={cn(
                'h-11 rounded-xl flex items-center transition-all duration-200 group relative px-3',
                isActive
                  ? 'bg-cdata-yellow text-cdata-black'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-cdata-black'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span
                className={cn(
                  'ml-3 font-medium whitespace-nowrap transition-all duration-300 overflow-hidden',
                  isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
                )}
              >
                {item.label}
              </span>
              {!isExpanded && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-cdata-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Candidates Section - Scrollable */}
      <div className="flex-1 border-t border-gray-200 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <div
          className={cn(
            'flex items-center px-3 py-3',
            isExpanded ? 'justify-between' : 'justify-center'
          )}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {isExpanded && (
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                People
                {schemaSubDomain && schemaSubDomain !== 'generic' && (
                  <span className="text-gray-400 font-normal ml-1">({schemaSubDomain})</span>
                )}
              </span>
            )}
          </div>
          {isExpanded && (
            <button
              onClick={refreshCandidates}
              disabled={candidatesLoading}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Refresh candidates"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 text-gray-400', candidatesLoading && 'animate-spin')} />
            </button>
          )}
        </div>

        {/* Candidates List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {candidatesLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : cachedCandidates.length > 0 ? (
            <div className="space-y-1">
              {cachedCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => router.push(`/candidate/${candidate.id}`)}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg transition-all text-left',
                    isExpanded ? 'px-2 py-2 hover:bg-gray-100' : 'p-1.5 justify-center hover:bg-gray-100',
                    pathname === `/candidate/${candidate.id}` && 'bg-cdata-yellow/20'
                  )}
                  title={!isExpanded ? candidate.name : undefined}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-7 h-7 rounded-full bg-cdata-yellow/30 flex items-center justify-center text-xs font-medium text-cdata-black">
                      {candidate.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white',
                        getStatusColor(candidate.status)
                      )}
                    />
                  </div>
                  {isExpanded && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{candidate.name}</p>
                      <p className="text-xs text-gray-500 truncate">{candidate.title}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            isExpanded && (
              <p className="text-xs text-gray-400 text-center py-4">
                No candidates loaded
              </p>
            )
          )}
        </div>

        {/* Selected count badge */}
        {selectedCandidates.length > 0 && (
          <div
            className={cn(
              'mx-2 mb-2 py-2 px-3 bg-cdata-yellow/20 rounded-lg',
              isExpanded ? 'text-left' : 'text-center'
            )}
          >
            {isExpanded ? (
              <p className="text-xs font-medium text-cdata-black">
                {selectedCandidates.length} selected for export
              </p>
            ) : (
              <span className="text-xs font-bold text-cdata-black">{selectedCandidates.length}</span>
            )}
          </div>
        )}
      </div>

      {/* Bottom section - Status */}
      <div className="p-3 border-t border-gray-200">
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-2',
            isExpanded ? 'bg-green-50' : 'justify-center'
          )}
        >
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          {isExpanded && (
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-green-700 whitespace-nowrap">Connected</p>
              <p className="text-xs text-green-600 whitespace-nowrap">
                {(tokenUsage.today.totalTokens / 1000).toFixed(1)}K tokens today
                {schemaSubDomain && schemaSubDomain !== 'generic' && (
                  <span className="text-green-500"> &middot; {schemaSubDomain}</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
