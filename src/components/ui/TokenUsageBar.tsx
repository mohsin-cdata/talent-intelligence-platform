'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Zap, DollarSign, Activity } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function TokenUsageBar() {
  const { tokenUsage, sidebarExpanded } = useAppStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevTokens, setPrevTokens] = useState(tokenUsage.total.totalTokens);

  // Animate when tokens change
  useEffect(() => {
    if (tokenUsage.total.totalTokens !== prevTokens) {
      setIsAnimating(true);
      setPrevTokens(tokenUsage.total.totalTokens);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [tokenUsage.total.totalTokens, prevTokens]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCost = (cost: number) => {
    return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`;
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-2.5',
        'flex items-center justify-between text-xs',
        'transition-all duration-300 shadow-[0_-2px_10px_rgba(0,0,0,0.08)]',
        sidebarExpanded ? 'left-64' : 'left-16',
        isAnimating && 'bg-cdata-yellow/10'
      )}
    >
      {/* Left side - Real-time indicators */}
      <div className="flex items-center gap-6">
        {/* Activity indicator */}
        <div className="flex items-center gap-1.5">
          <Activity
            className={cn(
              'w-3.5 h-3.5',
              isAnimating ? 'text-green-500 animate-pulse' : 'text-gray-400'
            )}
          />
          <span className="text-gray-500 font-medium">
            {isAnimating ? 'Processing...' : 'Ready'}
          </span>
        </div>

        {/* Tokens sent (prompt) */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 text-blue-600">
            <ArrowUp className="w-3.5 h-3.5" />
          </div>
          <span className="text-gray-600">
            <span className="font-semibold text-cdata-black">
              {formatNumber(tokenUsage.total.promptTokens)}
            </span>
            {' '}tokens sent
          </span>
        </div>

        {/* Tokens received (completion) */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 text-green-600">
            <ArrowDown className="w-3.5 h-3.5" />
          </div>
          <span className="text-gray-600">
            <span className="font-semibold text-cdata-black">
              {formatNumber(tokenUsage.total.completionTokens)}
            </span>
            {' '}tokens received
          </span>
        </div>
      </div>

      {/* Right side - Totals */}
      <div className="flex items-center gap-6">
        {/* Today's usage */}
        <div className="flex items-center gap-1.5 text-gray-500">
          <span>Today:</span>
          <span className="font-semibold text-cdata-black">
            {formatNumber(tokenUsage.today.totalTokens)}
          </span>
          <span>tokens</span>
        </div>

        {/* Total tokens */}
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-cdata-yellow" />
          <span className="text-gray-600">
            Total:{' '}
            <span className="font-semibold text-cdata-black">
              {formatNumber(tokenUsage.total.totalTokens)}
            </span>
          </span>
        </div>

        {/* Estimated cost */}
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-green-600" />
          <span className="text-gray-600">
            Cost:{' '}
            <span className="font-semibold text-cdata-black">
              {formatCost(tokenUsage.total.estimatedCost)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// Compact version for smaller screens or less intrusive display
export function TokenUsageBarCompact() {
  const { tokenUsage } = useAppStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevTokens, setPrevTokens] = useState(tokenUsage.total.totalTokens);

  useEffect(() => {
    if (tokenUsage.total.totalTokens !== prevTokens) {
      setIsAnimating(true);
      setPrevTokens(tokenUsage.total.totalTokens);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
  }, [tokenUsage.total.totalTokens, prevTokens]);

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-40 bg-white rounded-full shadow-lg border border-gray-200',
        'px-4 py-2 flex items-center gap-3 text-xs',
        'transition-all duration-300',
        isAnimating && 'ring-2 ring-cdata-yellow ring-opacity-50'
      )}
    >
      <div className="flex items-center gap-1">
        <ArrowUp className="w-3 h-3 text-blue-500" />
        <span className="font-medium">{formatNumber(tokenUsage.total.promptTokens)}</span>
      </div>
      <div className="w-px h-4 bg-gray-200" />
      <div className="flex items-center gap-1">
        <ArrowDown className="w-3 h-3 text-green-500" />
        <span className="font-medium">{formatNumber(tokenUsage.total.completionTokens)}</span>
      </div>
      <div className="w-px h-4 bg-gray-200" />
      <div className="flex items-center gap-1">
        <Zap className={cn('w-3 h-3', isAnimating ? 'text-cdata-yellow animate-pulse' : 'text-gray-400')} />
        <span className="font-medium">{formatNumber(tokenUsage.total.totalTokens)}</span>
      </div>
    </div>
  );
}
