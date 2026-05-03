'use client';

import { cn } from '@/lib/utils';

type StatusType = 'Active' | 'Bench' | 'Passive' | 'Placed' | 'Open' | 'Filled' | 'Closed' | 'Completed' | 'Terminated' | string;

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
  className?: string;
}

const statusColors: Record<string, string> = {
  // Candidate statuses
  active: 'bg-green-100 text-green-700 border-green-200',
  bench: 'bg-blue-100 text-blue-700 border-blue-200',
  passive: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  placed: 'bg-purple-100 text-purple-700 border-purple-200',
  // Job statuses
  open: 'bg-green-100 text-green-700 border-green-200',
  filled: 'bg-blue-100 text-blue-700 border-blue-200',
  closed: 'bg-gray-100 text-gray-700 border-gray-200',
  'on hold': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  // Placement statuses
  completed: 'bg-green-100 text-green-700 border-green-200',
  terminated: 'bg-red-100 text-red-700 border-red-200',
  // Canonical pipeline stages (Phase 10)
  sourced: 'bg-gray-100 text-gray-700 border-gray-200',
  screening: 'bg-blue-100 text-blue-700 border-blue-200',
  screened: 'bg-blue-100 text-blue-700 border-blue-200',
  submitted: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  interview: 'bg-purple-100 text-purple-700 border-purple-200',
  interviewed: 'bg-purple-100 text-purple-700 border-purple-200',
  offer: 'bg-amber-100 text-amber-700 border-amber-200',
  offered: 'bg-amber-100 text-amber-700 border-amber-200',
  hired: 'bg-green-100 text-green-700 border-green-200',
  onboarded: 'bg-green-100 text-green-700 border-green-200',
  shortlisted: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  withdrawn: 'bg-gray-100 text-gray-500 border-gray-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
  // Default
  default: 'bg-gray-100 text-gray-700 border-gray-200',
};

export function StatusBadge({ status, size = 'sm', className }: StatusBadgeProps) {
  const normalizedStatus = status?.toLowerCase() || 'default';
  const colorClass = statusColors[normalizedStatus] || statusColors.default;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'rounded-full font-medium border inline-flex items-center',
        colorClass,
        sizeClasses[size],
        className
      )}
    >
      {status}
    </span>
  );
}
