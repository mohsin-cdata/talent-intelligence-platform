'use client';

import {
  UserPlus,
  Search,
  FileText,
  Users,
  CheckCircle2,
  Briefcase,
  Clock,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveStage } from '@/lib/schema-mapping';
import type { CanonicalStage } from '@/lib/agents/types';

// 6 canonical journey stages (matches CanonicalStage type)
const journeyStages: { id: CanonicalStage; label: string; icon: typeof UserPlus; description: string }[] = [
  { id: 'sourced', label: 'Sourced', icon: UserPlus, description: 'Added to talent pool' },
  { id: 'screening', label: 'Screening', icon: Search, description: 'Under review' },
  { id: 'submitted', label: 'Submitted', icon: FileText, description: 'Sent to client' },
  { id: 'interview', label: 'Interview', icon: Users, description: 'Interview process' },
  { id: 'offer', label: 'Offer', icon: CheckCircle2, description: 'Offer extended' },
  { id: 'placed', label: 'Placed', icon: Briefcase, description: 'Active placement' },
];

interface CandidateJourneyProps {
  status: string;
  activities?: any[];
  placements?: any[];
  className?: string;
}

// Determine current journey stage using canonical stage resolution.
// Uses resolveStage() from schema-mapping for platform-agnostic status mapping,
// then falls back to activity-based inference.
function determineCurrentStage(
  status: string,
  activities: any[],
  placements: any[]
): CanonicalStage {
  // If currently placed
  if (placements.some((p) => {
    const s = (p.Status || p.status || '').toLowerCase();
    return s === 'active' || resolveStage(s) === 'placed';
  })) {
    return 'placed';
  }

  // Try canonical stage resolution first (handles all platform aliases)
  const resolved = resolveStage(status || '');
  if (resolved) return resolved;

  // Fall back to activity-based inference
  const hasOffer = activities.some(
    (a) => (a.ActivityType || a.activityType)?.toLowerCase().includes('offer')
  );
  if (hasOffer) return 'offer';

  const hasInterview = activities.some(
    (a) => (a.ActivityType || a.activityType)?.toLowerCase().includes('interview')
  );
  if (hasInterview) return 'interview';

  const hasSubmittal = activities.some(
    (a) => (a.ActivityType || a.activityType)?.toLowerCase().includes('submittal')
  );
  if (hasSubmittal) return 'submitted';

  return 'sourced';
}

// Canonical stage -> color classes
const stageColors: Record<CanonicalStage, string> = {
  sourced: 'bg-gray-100 text-gray-700',
  screening: 'bg-green-100 text-green-700',
  submitted: 'bg-indigo-100 text-indigo-700',
  interview: 'bg-purple-100 text-purple-700',
  offer: 'bg-amber-100 text-amber-700',
  placed: 'bg-blue-100 text-blue-700',
};

function getStageColor(stage: CanonicalStage): string {
  return stageColors[stage] || 'bg-gray-100 text-gray-700';
}

export function CandidateJourney({
  status,
  activities = [],
  placements = [],
  className,
}: CandidateJourneyProps) {
  const currentStage = determineCurrentStage(status, activities, placements);
  const currentStageIndex = journeyStages.findIndex((s) => s.id === currentStage);

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 p-6', className)}>
      <h2 className="text-lg font-semibold text-cdata-black mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-cdata-yellow" />
        Candidate Journey
      </h2>

      {/* Journey Timeline */}
      <div className="relative">
        {/* Progress bar background */}
        <div className="absolute top-5 left-5 right-5 h-1 bg-gray-200 rounded-full" />

        {/* Progress bar fill */}
        <div
          className="absolute top-5 left-5 h-1 bg-cdata-yellow rounded-full transition-all duration-500"
          style={{
            width: `calc(${(currentStageIndex / (journeyStages.length - 1)) * 100}% - 20px)`,
          }}
        />

        {/* Stages */}
        <div className="relative flex justify-between">
          {journeyStages.map((stage, index) => {
            const isCompleted = index <= currentStageIndex;
            const isCurrent = index === currentStageIndex;
            const Icon = stage.icon;

            return (
              <div key={stage.id} className="flex flex-col items-center">
                {/* Icon circle */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 z-10',
                    isCompleted
                      ? isCurrent
                        ? 'bg-cdata-yellow text-cdata-black ring-4 ring-cdata-yellow/30'
                        : 'bg-cdata-yellow text-cdata-black'
                      : 'bg-gray-100 text-gray-400'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Label */}
                <div className="mt-3 text-center">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isCompleted ? 'text-cdata-black' : 'text-gray-400'
                    )}
                  >
                    {stage.label}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-gray-500 mt-0.5">{stage.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Status Badge */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Current Status:</span>
          <span
            className={cn(
              'px-3 py-1 rounded-full text-sm font-medium',
              getStageColor(currentStage)
            )}
          >
            {status || 'Unknown'}
          </span>
        </div>

        {/* Stage info */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Stage {currentStageIndex + 1} of {journeyStages.length}</span>
        </div>
      </div>
    </div>
  );
}

// Compact version for inline display
export function CandidateJourneyCompact({
  status,
  activities = [],
  placements = [],
  className,
}: CandidateJourneyProps) {
  const currentStage = determineCurrentStage(status, activities, placements);
  const currentStageIndex = journeyStages.findIndex((s) => s.id === currentStage);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {journeyStages.map((stage, index) => {
        const isCompleted = index <= currentStageIndex;
        const isCurrent = index === currentStageIndex;
        const Icon = stage.icon;

        return (
          <div key={stage.id} className="flex items-center">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                isCompleted
                  ? isCurrent
                    ? 'bg-cdata-yellow text-cdata-black'
                    : 'bg-cdata-yellow/50 text-cdata-black'
                  : 'bg-gray-100 text-gray-400'
              )}
              title={stage.label}
            >
              <Icon className="w-3 h-3" />
            </div>
            {index < journeyStages.length - 1 && (
              <div
                className={cn(
                  'w-4 h-0.5',
                  isCompleted ? 'bg-cdata-yellow' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
