// StatusBadge - Renders status with canonical stage coloring
// Works with any status value, resolves to canonical stage for color coding

'use client';

import { CanonicalStage } from '@/lib/agents/types';

const STAGE_COLORS: Record<CanonicalStage, string> = {
  sourced: 'bg-gray-100 text-gray-700',
  screening: 'bg-blue-100 text-blue-700',
  submitted: 'bg-indigo-100 text-indigo-700',
  interview: 'bg-purple-100 text-purple-700',
  offer: 'bg-amber-100 text-amber-700',
  placed: 'bg-green-100 text-green-700',
};

interface StatusBadgeProps {
  status: string;
  stage?: CanonicalStage | null;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, stage, size = 'sm' }: StatusBadgeProps) {
  const colorClass = stage ? STAGE_COLORS[stage] : 'bg-gray-100 text-gray-600';
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`${colorClass} ${sizeClass} rounded-full font-medium whitespace-nowrap`}>
      {status}
    </span>
  );
}
