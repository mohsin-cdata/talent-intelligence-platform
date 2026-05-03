// EntityProfile - Full profile view for any entity based on TableMap
// Groups fields by semantic role category, renders all available data

'use client';

import { TableMap, SemanticRole, ColumnMapping } from '@/lib/agents/types';
import { getColumnByRole, getDisplayName, resolveStage } from '@/lib/schema-mapping';
import { StatusBadge } from './StatusBadge';
import { User, Briefcase, Building2, Activity, FileText } from 'lucide-react';

interface EntityProfileProps {
  row: Record<string, any>;
  tableMap: TableMap;
}

// Group roles into display categories
const ROLE_GROUPS: Record<string, SemanticRole[]> = {
  'Identity': ['primary_id', 'primary_name', 'secondary_name', 'title', 'description'],
  'Contact': ['email', 'phone', 'url'],
  'Location': ['city', 'state', 'zip'],
  'Status': ['status', 'category'],
  'Metrics': ['rate', 'rating', 'experience', 'amount'],
  'Dates': ['date_created', 'date_modified', 'date_start', 'date_end'],
  'Relationships': ['tags', 'parent_id', 'owner'],
};

const ROLE_LABELS: Record<SemanticRole, string> = {
  primary_id: 'ID',
  primary_name: 'Name',
  secondary_name: 'Last Name',
  title: 'Title',
  description: 'Description',
  email: 'Email',
  phone: 'Phone',
  url: 'URL/Profile',
  city: 'City',
  state: 'State',
  zip: 'ZIP Code',
  status: 'Status',
  category: 'Category',
  rate: 'Rate',
  rating: 'Rating',
  experience: 'Experience',
  amount: 'Amount',
  date_created: 'Created',
  date_modified: 'Modified',
  date_start: 'Start Date',
  date_end: 'End Date',
  tags: 'Tags/Skills',
  parent_id: 'Related ID',
  owner: 'Owner/Assignee',
};

export function EntityProfile({ row, tableMap }: EntityProfileProps) {
  const displayName = getDisplayName(row, tableMap);
  const status = getColumnByRole(tableMap, 'status');
  const statusValue = status ? row[status] : null;
  const stage = statusValue ? resolveStage(statusValue) : null;

  // Build mapped roles lookup
  const mappedRoles = new Map<SemanticRole, string>();
  for (const mapping of tableMap.columns) {
    mappedRoles.set(mapping.role, mapping.columnName);
  }

  // Collect unmapped columns (columns not assigned to any role)
  const mappedColumnNames = new Set(tableMap.columns.map(c => c.columnName));
  const allColumns = Object.keys(row);
  const unmappedColumns = allColumns.filter(c => !mappedColumnNames.has(c) && row[c] != null && row[c] !== '');

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {tableMap.entityType.charAt(0).toUpperCase() + tableMap.entityType.slice(1)} &middot; {tableMap.subDomain}
            </p>
          </div>
          {statusValue && <StatusBadge status={statusValue} stage={stage} size="md" />}
        </div>
      </div>

      {/* Grouped Fields */}
      <div className="px-6 py-4 space-y-6">
        {Object.entries(ROLE_GROUPS).map(([groupName, roles]) => {
          const groupFields = roles
            .filter(role => mappedRoles.has(role))
            .map(role => ({
              role,
              label: ROLE_LABELS[role],
              columnName: mappedRoles.get(role)!,
              value: row[mappedRoles.get(role)!],
            }))
            .filter(f => f.value != null && f.value !== '');

          if (groupFields.length === 0) return null;

          return (
            <div key={groupName}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {groupName}
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {groupFields.map(field => (
                  <div key={field.role}>
                    <dt className="text-xs text-gray-500">{field.label}</dt>
                    <dd className="text-sm text-gray-900 break-words">
                      {field.role === 'url' ? (
                        <a
                          href={String(field.value)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {String(field.value).replace(/^https?:\/\//, '').slice(0, 50)}
                        </a>
                      ) : field.role === 'tags' ? (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {String(field.value).split(',').map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        String(field.value)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}

        {/* Unmapped columns */}
        {unmappedColumns.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Additional Fields
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {unmappedColumns.map(col => (
                <div key={col}>
                  <dt className="text-xs text-gray-500">{col}</dt>
                  <dd className="text-sm text-gray-900 break-words truncate">
                    {String(row[col]).slice(0, 200)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
