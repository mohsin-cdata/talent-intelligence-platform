// EntityCard - Role-driven card that renders any entity based on its TableMap
// Accepts a data row + TableMap and renders fields by semantic role
// Missing roles are hidden gracefully

'use client';

import { TableMap, SemanticRole, EntityType } from '@/lib/agents/types';
import { getColumnByRole, getDisplayName, resolveStage } from '@/lib/schema-mapping';
import { StatusBadge } from './StatusBadge';
import { User, Briefcase, Building2, Activity, FileText, MapPin, Mail, Phone, DollarSign, Star, Clock } from 'lucide-react';

interface EntityCardProps {
  row: Record<string, any>;
  tableMap: TableMap;
  onClick?: () => void;
  selected?: boolean;
}

const ENTITY_ICONS: Record<EntityType, React.ElementType> = {
  person: User,
  job: Briefcase,
  placement: FileText,
  activity: Activity,
  organization: Building2,
  generic: FileText,
};

const ENTITY_COLORS: Record<EntityType, string> = {
  person: 'border-l-blue-500',
  job: 'border-l-green-500',
  placement: 'border-l-purple-500',
  activity: 'border-l-orange-500',
  organization: 'border-l-teal-500',
  generic: 'border-l-gray-500',
};

function getField(row: Record<string, any>, tableMap: TableMap, role: SemanticRole): string | null {
  const col = getColumnByRole(tableMap, role);
  if (!col || row[col] == null || row[col] === '') return null;
  return String(row[col]);
}

export function EntityCard({ row, tableMap, onClick, selected }: EntityCardProps) {
  const Icon = ENTITY_ICONS[tableMap.entityType];
  const borderColor = ENTITY_COLORS[tableMap.entityType];
  const displayName = getDisplayName(row, tableMap);

  const title = getField(row, tableMap, 'title');
  const email = getField(row, tableMap, 'email');
  const phone = getField(row, tableMap, 'phone');
  const city = getField(row, tableMap, 'city');
  const state = getField(row, tableMap, 'state');
  const status = getField(row, tableMap, 'status');
  const rate = getField(row, tableMap, 'rate');
  const rating = getField(row, tableMap, 'rating');
  const experience = getField(row, tableMap, 'experience');
  const tags = getField(row, tableMap, 'tags');

  const location = [city, state].filter(Boolean).join(', ');
  const stage = status ? resolveStage(status) : null;

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-lg border-l-4 ${borderColor} shadow-sm hover:shadow-md
        transition-all duration-200 cursor-pointer p-4
        ${selected ? 'ring-2 ring-yellow-400 bg-yellow-50/30' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className="p-2 bg-gray-100 rounded-lg shrink-0">
          <Icon className="w-5 h-5 text-gray-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{displayName}</h3>
          {title && displayName !== title && (
            <p className="text-sm text-gray-500 truncate">{title}</p>
          )}
        </div>
        {status && <StatusBadge status={status} stage={stage} />}
      </div>

      {/* Details */}
      <div className="space-y-1 text-sm text-gray-600">
        {location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="truncate">{email}</span>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{phone}</span>
          </div>
        )}
        {rate && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{rate}/hr</span>
          </div>
        )}
        {rating && (
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{rating}</span>
          </div>
        )}
        {experience && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{experience} years</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.split(',').slice(0, 4).map((tag, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
            >
              {tag.trim()}
            </span>
          ))}
          {tags.split(',').length > 4 && (
            <span className="px-2 py-0.5 text-gray-400 text-xs">
              +{tags.split(',').length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
