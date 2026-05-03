'use client';

import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface QuickQuery {
  id: string;
  label: string;
  query: string;
  icon?: string;
}

const quickQueries: QuickQuery[] = [
  // People queries
  {
    id: 'java-developers',
    label: 'Java Developers',
    query: 'Find Java developers with at least 5 years of experience',
  },
  {
    id: 'react-available',
    label: 'Available React Devs',
    query: 'Find available React developers ready for placement',
  },
  {
    id: 'senior-devs',
    label: 'Senior Engineers',
    query: 'Find senior software engineers with 8+ years experience',
  },
  {
    id: 'python-aws',
    label: 'Python + AWS',
    query: 'Find candidates with Python and AWS skills',
  },
  // Cross-entity queries
  {
    id: 'open-jobs',
    label: 'Open Jobs',
    query: 'Show all open job requisitions sorted by urgency',
  },
  {
    id: 'active-placements',
    label: 'Active Placements',
    query: 'List all active placements with bill rates and client names',
  },
  {
    id: 'recent-activity',
    label: 'Recent Activity',
    query: 'Show the most recent activities across all candidates',
  },
  {
    id: 'top-clients',
    label: 'Top Clients',
    query: 'List clients with the most active requisitions',
  },
];

interface QuickQueriesProps {
  className?: string;
  variant?: 'horizontal' | 'grid';
}

export function QuickQueries({ className, variant = 'horizontal' }: QuickQueriesProps) {
  const { setPendingQuery, isLoading } = useAppStore();

  const handleClick = (query: QuickQuery) => {
    if (!isLoading) {
      setPendingQuery(query.query);
    }
  };

  if (variant === 'grid') {
    return (
      <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-2', className)}>
        {quickQueries.map((query) => (
          <button
            key={query.id}
            onClick={() => handleClick(query)}
            disabled={isLoading}
            className={cn(
              'px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700',
              'hover:border-cdata-yellow hover:bg-cdata-yellow/5 hover:text-cdata-black',
              'transition-all duration-200 text-left',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {query.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto scrollbar-hide -mx-4 px-4', className)}>
      <div className="flex gap-2 pb-2">
        {quickQueries.map((query) => (
          <button
            key={query.id}
            onClick={() => handleClick(query)}
            disabled={isLoading}
            className={cn(
              'flex-shrink-0 px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700',
              'hover:border-cdata-yellow hover:bg-cdata-yellow/10 hover:text-cdata-black',
              'transition-all duration-200 whitespace-nowrap',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {query.label}
          </button>
        ))}
      </div>
    </div>
  );
}
