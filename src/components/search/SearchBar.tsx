'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Loader2, X, Code, Copy, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  centered?: boolean;
  onSearch?: (query: string) => void;
  className?: string;
}

export function SearchBar({ centered = false, onSearch, className }: SearchBarProps) {
  const [input, setInput] = useState('');
  const [showSQL, setShowSQL] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isLoading,
    pendingQuery,
    setPendingQuery,
    currentSQL,
    searchQuery,
    setSearchQuery,
  } = useAppStore();

  // Sync input with store's searchQuery (keeps query visible after search)
  useEffect(() => {
    if (searchQuery && !input) {
      setInput(searchQuery);
    }
  }, [searchQuery]);

  // Handle pending queries from Quick Query templates
  useEffect(() => {
    if (pendingQuery && !isLoading) {
      setInput(pendingQuery);
      handleSearch(pendingQuery);
      setPendingQuery(null);
    }
  }, [pendingQuery, isLoading]);

  // Focus input on mount when centered
  useEffect(() => {
    if (centered && inputRef.current) {
      inputRef.current.focus();
    }
  }, [centered]);

  const handleSearch = async (query: string) => {
    if (!query.trim() || isLoading) return;
    setSearchQuery(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(input);
  };

  const handleClear = () => {
    setInput('');
    inputRef.current?.focus();
  };

  const handleCopySQL = async () => {
    if (currentSQL) {
      await navigator.clipboard.writeText(currentSQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={cn('w-full', centered ? 'max-w-2xl mx-auto' : '', className)}>
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            'relative flex items-center gap-3 bg-white rounded-2xl border-2 transition-all duration-300',
            centered
              ? 'border-gray-200 shadow-lg hover:shadow-xl focus-within:border-cdata-yellow focus-within:shadow-xl'
              : 'border-gray-200 focus-within:border-cdata-yellow'
          )}
        >
          <div className="absolute left-5 flex items-center pointer-events-none">
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-cdata-yellow animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5 text-cdata-yellow" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your talent data... e.g., 'Find Java developers in Austin'"
            className={cn(
              'flex-1 bg-transparent outline-none text-cdata-black placeholder:text-gray-400',
              centered ? 'pl-14 pr-4 py-5 text-lg' : 'pl-14 pr-4 py-3.5'
            )}
            disabled={isLoading}
          />

          {input && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              'flex items-center gap-2 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
              centered
                ? 'bg-cdata-yellow text-cdata-black px-6 py-3 mr-2 hover:bg-cdata-yellow-hover'
                : 'bg-cdata-yellow text-cdata-black px-4 py-2 mr-2 text-sm hover:bg-cdata-yellow-hover'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Search</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* SQL Preview Toggle */}
      {currentSQL && (
        <div className="mt-3">
          <button
            onClick={() => setShowSQL(!showSQL)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-cdata-navy transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
            {showSQL ? 'Hide SQL Query' : 'View Generated SQL'}
          </button>

          {showSQL && (
            <div className="mt-2 relative animate-in">
              <div className="bg-cdata-black text-green-400 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <button
                  onClick={handleCopySQL}
                  className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                  title="Copy SQL"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <pre className="pr-10 whitespace-pre-wrap">{currentSQL}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
