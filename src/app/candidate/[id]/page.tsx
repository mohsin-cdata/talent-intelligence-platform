'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  DollarSign,
  Calendar,
  Briefcase,
  Star,
  Clock,
  Shield,
  Globe,
  Building,
  FileText,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { SkillBadgeList } from '@/components/ui/SkillBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProfileSkeleton } from '@/components/ui/LoadingSkeleton';
import { TokenUsageBar } from '@/components/ui/TokenUsageBar';
import { CandidateJourney } from '@/components/candidates/CandidateJourney';
import { Sidebar } from '@/components/layout/Sidebar';
import { LiveTerminal } from '@/components/ui/LiveTerminal';
import { useAppStore } from '@/lib/store';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { getField as resolveField, getDisplayName, getPrimaryId } from '@/lib/field-resolver';

// Info Card Component
function InfoCard({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-cdata-yellow/10 rounded-lg">
          <Icon className="w-4 h-4 text-cdata-black" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-semibold text-cdata-black truncate">{value || '-'}</p>
          {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
        </div>
      </div>
    </div>
  );
}

// Timeline Component for Placements
function PlacementTimeline({ placements }: { placements: any[] }) {
  if (!placements || placements.length === 0) {
    return (
      <div className="text-center py-8">
        <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No placement history available</p>
      </div>
    );
  }

  // Sort by start date descending
  const sortedPlacements = [...placements].sort((a, b) => {
    const dateA = new Date(resolveField(a, 'startDate') || 0);
    const dateB = new Date(resolveField(b, 'startDate') || 0);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-3 top-6 bottom-6 w-0.5 bg-gray-200" />

      <div className="space-y-6">
        {sortedPlacements.map((placement, index) => {
          const startDate = resolveField(placement, 'startDate');
          const endDate = resolveField(placement, 'endDate');
          const status = resolveField(placement, 'status');
          const isActive = status === 'Active' || !endDate;
          const clientName = resolveField(placement, 'companyName');
          const jobTitle = resolveField(placement, 'jobTitle');
          const billRate = resolveField(placement, 'billRate');
          const clientRating = resolveField(placement, 'clientRating');

          // Format dates
          const formatDate = (dateStr: string) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          };

          return (
            <div key={resolveField(placement, 'placementId') || index} className="relative pl-10">
              {/* Timeline dot */}
              <div
                className={cn(
                  'absolute left-0 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow',
                  isActive ? 'bg-green-500' : 'bg-gray-400'
                )}
              >
                <Briefcase className="w-3 h-3 text-white" />
              </div>

              {/* Content card */}
              <div
                className={cn(
                  'bg-white rounded-xl border p-4 transition-all hover:shadow-md',
                  isActive ? 'border-green-200' : 'border-gray-200'
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-cdata-black">{jobTitle}</h4>
                      {isActive && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" />
                      {clientName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(startDate)} - {endDate ? formatDate(endDate) : 'Present'}
                    </p>
                  </div>
                  <div className="text-right">
                    {billRate && (
                      <p className="text-lg font-bold text-cdata-black flex items-center justify-end">
                        <DollarSign className="w-4 h-4" />
                        {billRate}/hr
                      </p>
                    )}
                    {clientRating && (
                      <p className="text-sm text-gray-500 flex items-center justify-end gap-1 mt-1">
                        <Star className="w-3.5 h-3.5 text-cdata-yellow fill-cdata-yellow" />
                        {Number(clientRating).toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>

                {placement.Notes && (
                  <p className="text-sm text-gray-500 mt-3 pt-3 border-t border-gray-100">
                    {placement.Notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Activity Log Component
function ActivityLog({ activities }: { activities: any[] }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-6">
        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No recent activity</p>
      </div>
    );
  }

  const activityIcons: Record<string, typeof Phone> = {
    Call: Phone,
    Email: Mail,
    Submittal: FileText,
    Interview: Briefcase,
    Offer: Star,
  };

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {activities.slice(0, 10).map((activity, index) => {
        const type = resolveField(activity, 'activityType');
        const date = resolveField(activity, 'activityDate');
        const notes = resolveField(activity, 'notes');
        const Icon = activityIcons[type] || FileText;

        const formatDate = (dateStr: string) => {
          if (!dateStr) return '';
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };

        return (
          <div
            key={resolveField(activity, 'activityId') || index}
            className="flex gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <div className="p-1.5 bg-white rounded-lg shadow-sm">
              <Icon className="w-4 h-4 text-gray-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-cdata-black">{type}</span>
                <span className="text-xs text-gray-500">{formatDate(date)}</span>
              </div>
              {notes && (
                <p className="text-xs text-gray-600 mt-1 truncate">{notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CandidateProfilePage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.id as string;

  const [candidate, setCandidate] = useState<any>(null);
  const [placements, setPlacements] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { addMessage, addTokenUsage, addQueryLog, sidebarExpanded, addLog } = useAppStore();

  // Fetch candidate data using DIRECT query endpoint (bypasses LLM for speed)
  useEffect(() => {
    const fetchCandidateData = async () => {
      setLoading(true);
      setError(null);

      addLog({ type: 'info', message: `Loading profile for ${candidateId}` });

      try {
        // Fetch all data in parallel using DIRECT query endpoint (no LLM)
        // Use apiClient to include per-user credential headers
        const decodedId = decodeURIComponent(candidateId);
        console.log('[Profile] Fetching data for candidateId:', decodedId);

        const profileResponse = await apiClient(`/api/candidates/${encodeURIComponent(decodedId)}`, { method: 'GET' });

        // Check for HTTP errors
        if (!profileResponse.ok) {
          throw new Error(`Failed to fetch candidate: ${profileResponse.status}`);
        }

        const profileData = await profileResponse.json();
        console.log('[Profile] API response:', profileData);

        // Handle API-level errors
        if (profileData.error) {
          throw new Error(profileData.error);
        }

        const { candidate: candidateData, placements: placementsData, activities: activitiesData } = profileData;

        // Set candidate data
        if (candidateData) {
          console.log('[Profile] Setting candidate:', candidateData);
          setCandidate(candidateData);
          addLog({ type: 'success', message: `Loaded candidate profile` });
        } else {
          console.warn('[Profile] No candidate found in results');
          setError(`Candidate ${candidateId} not found`);
        }

        if (placementsData) {
          setPlacements(placementsData);
          addLog({ type: 'success', message: `Loaded ${placementsData.length} placements` });
        }

        if (activitiesData) {
          setActivities(activitiesData);
          addLog({ type: 'success', message: `Loaded ${activitiesData.length} activities` });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load candidate data';
        setError(errorMessage);
        addLog({ type: 'error', message: errorMessage });
        console.error('[Profile] Error fetching candidate:', err);
      } finally {
        setLoading(false);
      }
    };

    if (candidateId) {
      fetchCandidateData();
    }
  }, [candidateId, addLog]);

  // Field accessors using shared resolver (handles PascalCase, camelCase, snake_case, SCREAMING_SNAKE)
  const getName = () => candidate ? getDisplayName(candidate) : 'Loading...';
  const f = (canonicalName: string) => resolveField(candidate, canonicalName) || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className={cn(
        'min-h-screen pb-12 transition-all duration-300',
        sidebarExpanded ? 'ml-64' : 'ml-16'
      )}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-30">
          <div className="px-6 py-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-cdata-black transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Search</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <ProfileSkeleton />
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500">{error}</p>
              <button
                onClick={() => router.back()}
                className="mt-4 text-cdata-navy hover:underline"
              >
                Go back
              </button>
            </div>
          ) : candidate ? (
            <div className="max-w-5xl mx-auto space-y-6 animate-in">
              {/* Profile Header */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start gap-6">
                  <Avatar candidateId={candidateId} name={getName()} size="xl" />

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-2xl font-bold text-cdata-black">{getName()}</h1>
                      {f('status') && (
                        <StatusBadge status={f('status')} size="md" />
                      )}
                    </div>

                    <p className="text-lg text-gray-600 mb-2">{f('title')}</p>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {(f('city') || f('state')) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {[f('city'), f('state')].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {f('yearsExperience') && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {f('yearsExperience')} years experience
                        </span>
                      )}
                      {f('hourlyRate') && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${f('hourlyRate')}/hr
                        </span>
                      )}
                    </div>

                    {/* Skills */}
                    {f('skills') && (
                      <div className="mt-4">
                        <SkillBadgeList skills={f('skills')} maxVisible={8} size="md" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Candidate Journey */}
              <CandidateJourney
                status={f('status')}
                activities={activities}
                placements={placements}
              />

              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoCard icon={Mail} label="Email" value={f('email')} />
                <InfoCard icon={Phone} label="Phone" value={f('phone')} />
                <InfoCard
                  icon={Briefcase}
                  label="Employment Type"
                  value={f('employmentType')}
                />
                <InfoCard
                  icon={Globe}
                  label="Remote Preference"
                  value={f('remotePreference')}
                />
                <InfoCard
                  icon={Shield}
                  label="Clearance"
                  value={f('clearance') || 'None'}
                />
                <InfoCard
                  icon={Star}
                  label="Avg Rating"
                  value={f('avgRating') ? `${Number(f('avgRating')).toFixed(1)} / 5.0` : '-'}
                />
                <InfoCard
                  icon={Calendar}
                  label="Available Date"
                  value={f('availableDate') || 'Immediately'}
                />
                <InfoCard
                  icon={Building}
                  label="Placements"
                  value={String(f('placementCount') || placements.length)}
                />
              </div>

              {/* Two column layout for timeline and activity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Placement Timeline - larger */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-cdata-black mb-4 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-cdata-yellow" />
                    Placement History
                  </h2>
                  <PlacementTimeline placements={placements} />
                </div>

                {/* Activity Log - smaller */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-cdata-black mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cdata-yellow" />
                    Recent Activity
                  </h2>
                  <ActivityLog activities={activities} />
                </div>
              </div>

              {/* Summary/Notes if available */}
              {f('summary') && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-cdata-black mb-3">Summary</h2>
                  <p className="text-gray-600 whitespace-pre-wrap">{f('summary')}</p>
                </div>
              )}

              {/* LinkedIn Link */}
              {f('linkedinUrl') && (
                <div className="flex justify-center">
                  <a
                    href={f('linkedinUrl')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-[#0077B5] text-white rounded-lg hover:bg-[#006097] transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                    View LinkedIn Profile
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Candidate not found</p>
            </div>
          )}
        </div>
      </main>

      {/* Live logging terminal */}
      <LiveTerminal />

      {/* Persistent token usage bar */}
      <TokenUsageBar />
    </div>
  );
}
