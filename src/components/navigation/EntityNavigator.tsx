'use client';

import { useState } from 'react';
import {
  Users,
  Briefcase,
  FileCheck,
  Activity,
  Building2,
  ChevronRight,
  ChevronDown,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { EntityType } from '@/lib/agents/types';
import { getDisplayName, getPrimaryId, getSubtitle } from '@/lib/field-resolver';

interface EntityGroup {
  type: EntityType;
  icon: typeof Users;
  label: string;
  count: number;
  items?: { id: string; name: string; subtitle?: string }[];
  source?: string; // catalog name for multi-source grouping
}

interface EntityNavigatorProps {
  results: any[];
  resultType: string;
  onSelectEntity?: (id: string, type: EntityType) => void;
  className?: string;
}

const entityIcons: Record<string, typeof Users> = {
  person: Users,
  job: Briefcase,
  placement: FileCheck,
  activity: Activity,
  organization: Building2,
  generic: Database,
};

// Infer entity groups from search results
function buildEntityGroups(results: any[], resultType: string): EntityGroup[] {
  if (!results?.length) return [];

  const type = mapResultTypeToEntity(resultType);
  const icon = entityIcons[type] || Database;
  const label = getEntityLabel(type);

  // Try to extract items with IDs and names
  const items = results.slice(0, 50).map((row, idx) => {
    const id = getPrimaryId(row) || String(idx);
    const name = getDisplayName(row);
    const subtitle = getSubtitle(row);
    return { id, name, subtitle };
  });

  return [{
    type,
    icon,
    label,
    count: results.length,
    items,
  }];
}

function mapResultTypeToEntity(resultType: string): EntityType {
  switch (resultType) {
    case 'candidates': return 'person';
    case 'jobs': return 'job';
    case 'placements': return 'placement';
    case 'activities': return 'activity';
    case 'clients': return 'organization';
    default: return 'generic';
  }
}

function getEntityLabel(type: EntityType): string {
  switch (type) {
    case 'person': return 'People';
    case 'job': return 'Jobs';
    case 'placement': return 'Placements';
    case 'activity': return 'Activities';
    case 'organization': return 'Organizations';
    default: return 'Results';
  }
}

export function EntityNavigator({
  results,
  resultType,
  onSelectEntity,
  className,
}: EntityNavigatorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['0']));
  const { lockedDataSources } = useAppStore();

  const groups = buildEntityGroups(results, resultType);

  const toggleGroup = (idx: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <div className={cn('p-4', className)}>
        <p className="text-xs text-gray-400 text-center">No results to navigate</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border-subtle">
        <h3 className="text-heading-sm text-cdata-black">Navigator</h3>
        {lockedDataSources.length > 1 && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {lockedDataSources.length} sources
          </p>
        )}
      </div>

      {/* Entity groups */}
      <div className="flex-1 overflow-y-auto">
        {groups.map((group, idx) => {
          const Icon = group.icon;
          const isExpanded = expandedGroups.has(String(idx));
          return (
            <div key={idx}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(String(idx))}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-sunken transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                )}
                <Icon className="w-4 h-4 text-cdata-yellow" />
                <span className="text-xs font-medium text-cdata-black flex-1 text-left">
                  {group.label}
                </span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {group.count}
                </span>
              </button>

              {/* Items list */}
              {isExpanded && group.items && (
                <div className="pb-1">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onSelectEntity?.(item.id, group.type)}
                      className="w-full flex items-center gap-2 px-3 pl-9 py-1.5 text-left hover:bg-cdata-yellow/5 transition-colors group"
                    >
                      <div className="w-6 h-6 rounded-full bg-cdata-yellow/20 flex items-center justify-center text-[10px] font-medium text-cdata-black flex-shrink-0">
                        {item.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-800 truncate group-hover:text-cdata-black">
                          {item.name}
                        </p>
                        {item.subtitle && (
                          <p className="text-[10px] text-gray-400 truncate">{item.subtitle}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
