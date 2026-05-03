'use client';

import { LayoutGrid, Table2, Columns3, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'cards' | 'table' | 'kanban' | 'timeline';

interface ViewSwitcherProps {
  current: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
  availableModes?: ViewMode[];
}

const viewModes: { id: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { id: 'cards', icon: LayoutGrid, label: 'Card Grid' },
  { id: 'table', icon: Table2, label: 'Data Table' },
  { id: 'kanban', icon: Columns3, label: 'Kanban Board' },
  { id: 'timeline', icon: Clock, label: 'Timeline' },
];

export function ViewSwitcher({
  current,
  onChange,
  className,
  availableModes,
}: ViewSwitcherProps) {
  const modes = availableModes
    ? viewModes.filter(m => availableModes.includes(m.id))
    : viewModes;

  return (
    <div className={cn('flex items-center bg-surface-sunken rounded-lg p-0.5', className)}>
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = current === mode.id;
        return (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              isActive
                ? 'bg-white text-cdata-black shadow-soft-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
            title={mode.label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
