'use client';

import { useState } from 'react';
import { User, MessageSquare, History, Link2, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { PendingMutation } from '@/lib/mutation-manager';
import { getDisplayName, getSubtitle } from '@/lib/field-resolver';

type TabId = 'profile' | 'ai' | 'history' | 'related';

interface ContextPanelProps {
  selectedRow?: Record<string, any> | null;
  onClose?: () => void;
  className?: string;
}

const tabs: { id: TabId; icon: typeof User; label: string }[] = [
  { id: 'profile', icon: User, label: 'Profile' },
  { id: 'ai', icon: MessageSquare, label: 'AI' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'related', icon: Link2, label: 'Related' },
];

export function ContextPanel({ selectedRow, onClose, className }: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const { pendingMutations, messages } = useAppStore();

  if (!selectedRow) {
    return (
      <div className={cn('flex flex-col h-full bg-surface-raised', className)}>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <User className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Select a record to view details</p>
          </div>
        </div>
      </div>
    );
  }

  // Get display name from row
  const name = getDisplayName(selectedRow);
  const subtitleText = getSubtitle(selectedRow);

  return (
    <div className={cn('flex flex-col h-full bg-surface-raised', className)}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border-subtle flex items-center justify-between">
        <div className="min-w-0">
          <h3 className="text-heading-sm text-cdata-black truncate">{name}</h3>
          <p className="text-[10px] text-gray-400">
            {subtitleText}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded flex-shrink-0">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-cdata-black border-b-2 border-cdata-yellow'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'profile' && (
          <ProfileTab row={selectedRow} />
        )}
        {activeTab === 'ai' && (
          <AITab name={name} />
        )}
        {activeTab === 'history' && (
          <HistoryTab mutations={pendingMutations} recordName={name} />
        )}
        {activeTab === 'related' && (
          <RelatedTab row={selectedRow} />
        )}
      </div>
    </div>
  );
}

// ── Profile Tab ──

function ProfileTab({ row }: { row: Record<string, any> }) {
  const entries = Object.entries(row).filter(([k, v]) => v != null && v !== '');

  // Group fields
  const identity = entries.filter(([k]) => /name|title|summary|description/i.test(k));
  const contact = entries.filter(([k]) => /email|phone|url|linkedin/i.test(k));
  const location = entries.filter(([k]) => /city|state|zip|country|timezone/i.test(k));
  const rest = entries.filter(([k]) =>
    !identity.some(([ik]) => ik === k) &&
    !contact.some(([ck]) => ck === k) &&
    !location.some(([lk]) => lk === k)
  );

  return (
    <div className="space-y-4">
      {identity.length > 0 && <FieldGroup label="Identity" fields={identity} />}
      {contact.length > 0 && <FieldGroup label="Contact" fields={contact} />}
      {location.length > 0 && <FieldGroup label="Location" fields={location} />}
      {rest.length > 0 && <FieldGroup label="Details" fields={rest} />}
    </div>
  );
}

function FieldGroup({ label, fields }: { label: string; fields: [string, any][] }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</h4>
      <div className="space-y-1">
        {fields.map(([key, value]) => (
          <div key={key} className="flex items-start gap-2">
            <span className="text-[10px] text-gray-500 w-24 flex-shrink-0 truncate">{formatFieldName(key)}</span>
            <span className="text-xs text-gray-800 break-words min-w-0">{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatFieldName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

// ── AI Tab ──

function AITab({ name }: { name: string }) {
  const { messages } = useAppStore();
  const recentAI = messages.filter(m => m.role === 'assistant' && m.content).slice(-3);

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-gray-400">AI insights about {name}</p>
      {recentAI.length > 0 ? (
        recentAI.map((msg, i) => (
          <div key={i} className="bg-surface-sunken rounded-lg p-2">
            <p className="text-xs text-gray-700 line-clamp-4">{msg.content}</p>
          </div>
        ))
      ) : (
        <p className="text-xs text-gray-400">Run a search to get AI insights.</p>
      )}
    </div>
  );
}

// ── History Tab ──

function HistoryTab({ mutations, recordName }: { mutations: PendingMutation[]; recordName: string }) {
  const recent = mutations.slice(0, 10);

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-400">Recent mutations</p>
      {recent.length > 0 ? (
        recent.map(m => (
          <div key={m.id} className="flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0">
            <div className={cn(
              'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
              m.status === 'success' ? 'bg-green-500' :
              m.status === 'failed' ? 'bg-red-500' :
              'bg-yellow-500'
            )} />
            <div className="min-w-0">
              <p className="text-xs text-gray-800 truncate">{m.description}</p>
              <p className="text-[10px] text-gray-400">
                {m.status} {m.resolvedAt ? `-- ${new Date(m.resolvedAt).toLocaleTimeString()}` : ''}
              </p>
            </div>
          </div>
        ))
      ) : (
        <p className="text-xs text-gray-400">No mutations recorded yet.</p>
      )}
    </div>
  );
}

// ── Related Tab ──

function RelatedTab({ row }: { row: Record<string, any> }) {
  // Find foreign key-like fields
  const fkFields = Object.entries(row).filter(([k, v]) =>
    v && /Id$|_id$/i.test(k) && !/^(id|_id)$/i.test(k)
  );

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-400">Cross-source relationships</p>
      {fkFields.length > 0 ? (
        fkFields.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 p-2 bg-surface-sunken rounded-lg">
            <Link2 className="w-3.5 h-3.5 text-gray-400" />
            <div className="min-w-0">
              <p className="text-xs text-gray-800">{formatFieldName(key)}</p>
              <p className="text-[10px] text-gray-400 truncate">{String(value)}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
          </div>
        ))
      ) : (
        <p className="text-xs text-gray-400">No related records found.</p>
      )}
    </div>
  );
}
