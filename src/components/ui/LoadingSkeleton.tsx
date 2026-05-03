'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className
      )}
      style={style}
    />
  );
}

export function CandidateCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-in">
      <div className="flex gap-4">
        {/* Avatar skeleton */}
        <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />

        {/* Content skeleton */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-3 w-36 mb-3" />

          {/* Skills skeleton */}
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>

        {/* Right side skeleton */}
        <div className="text-right flex-shrink-0">
          <Skeleton className="h-6 w-20 mb-2" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

export function CandidateGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <CandidateCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-6">
        <Skeleton className="w-24 h-24 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-36 mb-1" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      {/* Info cards skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-6 w-32" />
          </div>
        ))}
      </div>

      {/* Timeline skeleton */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="w-3 h-3 rounded-full mt-1.5" />
              <div className="flex-1">
                <Skeleton className="h-5 w-48 mb-1" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <Skeleton className="h-6 w-40 mb-4" />
      <div className="h-64 flex items-end gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${Math.random() * 60 + 30}%` }}
          />
        ))}
      </div>
    </div>
  );
}
