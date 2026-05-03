'use client';

import { MapPin, DollarSign, Star, Mail, Phone, ExternalLink, ChevronRight, Check } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { SkillBadgeList } from '@/components/ui/SkillBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { getField, getDisplayName, getPrimaryId } from '@/lib/field-resolver';

interface CandidateCardProps {
  candidate: any;
  onClick?: () => void;
  className?: string;
  showSelection?: boolean;
}

export function CandidateCard({ candidate, onClick, className, showSelection = true }: CandidateCardProps) {
  const { selectedCandidates, toggleCandidateSelection } = useAppStore();

  const candidateId = getPrimaryId(candidate) || '';
  const name = getDisplayName(candidate);
  const title = getField(candidate, 'title') || '';
  const city = getField(candidate, 'city') || '';
  const state = getField(candidate, 'state') || '';
  const location = city && state ? `${city}, ${state}` : city || state || '';
  const skills = getField(candidate, 'skills') || '';
  const hourlyRate = getField(candidate, 'hourlyRate') || 0;
  const yearsExperience = getField(candidate, 'yearsExperience') || 0;
  const status = getField(candidate, 'status') || '';
  const avgRating = getField(candidate, 'clientRating') || 0;
  const email = getField(candidate, 'email') || '';
  const phone = getField(candidate, 'phone') || '';
  const linkedInUrl = getField(candidate, 'linkedinUrl') || '';

  const isSelected = selectedCandidates.some((c) => c.id === candidateId);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleCandidateSelection({ id: candidateId, name });
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'group bg-white rounded-xl border p-5 transition-all duration-200 cursor-pointer relative',
        'hover:shadow-lg hover:-translate-y-0.5',
        isSelected
          ? 'border-cdata-yellow bg-cdata-yellow/5'
          : 'border-gray-200 hover:border-cdata-yellow/50',
        className
      )}
    >
      {/* Selection checkbox */}
      {showSelection && (
        <button
          onClick={handleSelect}
          className={cn(
            'absolute top-3 left-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
            isSelected
              ? 'bg-cdata-yellow border-cdata-yellow'
              : 'border-gray-300 hover:border-cdata-yellow bg-white'
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-cdata-black" />}
        </button>
      )}

      <div className={cn('flex gap-4', showSelection && 'ml-6')}>
        {/* Avatar */}
        <Avatar candidateId={candidateId} name={name} size="md" />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-cdata-black truncate group-hover:text-cdata-navy transition-colors">
              {name}
            </h3>
            {status && <StatusBadge status={status} />}
          </div>

          {/* Title */}
          <p className="text-sm text-gray-600 mb-1">{title}</p>

          {/* Location & Experience */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {location}
              </span>
            )}
            {yearsExperience > 0 && (
              <span>{yearsExperience} years exp</span>
            )}
            {hourlyRate > 0 && (
              <span className="flex items-center">
                <DollarSign className="w-3 h-3" />
                {hourlyRate}/hr
              </span>
            )}
          </div>

          {/* Skills */}
          <SkillBadgeList skills={skills} maxVisible={5} />

          {/* Contact row - visible on hover */}
          <div className="mt-3 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
            {email && (
              <a
                href={`mailto:${email}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-cdata-navy"
              >
                <Mail className="w-3.5 h-3.5" />
                {email}
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-cdata-navy"
              >
                <Phone className="w-3.5 h-3.5" />
                {phone}
              </a>
            )}
            {linkedInUrl && (
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-cdata-navy"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                LinkedIn
              </a>
            )}
          </div>
        </div>

        {/* Right side - Rate & Rating */}
        <div className="text-right flex-shrink-0 flex flex-col justify-between">
          <div>
            {hourlyRate > 0 && (
              <p className="text-lg font-bold text-cdata-black flex items-center justify-end">
                <DollarSign className="w-4 h-4" />
                {hourlyRate}
                <span className="text-sm font-normal text-gray-500">/hr</span>
              </p>
            )}
            {avgRating > 0 && (
              <p className="text-sm text-gray-500 flex items-center justify-end gap-1 mt-1">
                <Star className="w-3.5 h-3.5 text-cdata-yellow fill-cdata-yellow" />
                {Number(avgRating).toFixed(1)}
              </p>
            )}
          </div>

          {/* View button */}
          <div className="mt-auto pt-4">
            <span className="inline-flex items-center text-sm font-medium text-cdata-navy opacity-0 group-hover:opacity-100 transition-opacity">
              View
              <ChevronRight className="w-4 h-4 ml-1" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact variant for lists
export function CandidateCardCompact({ candidate, onClick, className }: CandidateCardProps) {
  const candidateId = getPrimaryId(candidate) || '';
  const name = getDisplayName(candidate);
  const title = getField(candidate, 'title') || '';
  const skills = getField(candidate, 'skills') || '';
  const hourlyRate = getField(candidate, 'hourlyRate') || 0;
  const status = getField(candidate, 'status') || '';

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer',
        'hover:bg-cdata-yellow/5 hover:border-cdata-yellow/30 transition-all',
        className
      )}
    >
      <Avatar candidateId={candidateId} name={name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-cdata-black truncate">{name}</span>
          {status && <StatusBadge status={status} size="sm" />}
        </div>
        <p className="text-xs text-gray-500 truncate">{title}</p>
      </div>
      {hourlyRate > 0 && (
        <span className="text-sm font-semibold text-cdata-black">${hourlyRate}/hr</span>
      )}
      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-cdata-yellow transition-colors" />
    </div>
  );
}
