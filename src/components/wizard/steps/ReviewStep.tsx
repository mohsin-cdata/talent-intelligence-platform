'use client';

import { Check, X, AlertCircle } from 'lucide-react';
import { LLMProvider } from '@/types';
import { cn } from '@/lib/utils';

interface ReviewStepProps {
  cdata: { email: string; pat: string; endpoint: string };
  llm: { provider: LLMProvider; apiKey: string; model: string };
  lockedTables: string[];
}

export function ReviewStep({ cdata, llm, lockedTables }: ReviewStepProps) {
  const sections = [
    {
      title: 'CData Connect AI',
      configured: !!(cdata.email && cdata.pat),
      items: [
        { label: 'Email', value: cdata.email || 'Not set', ok: !!cdata.email },
        { label: 'PAT', value: cdata.pat ? '****' + cdata.pat.slice(-4) : 'Not set', ok: !!cdata.pat },
        { label: 'Endpoint', value: cdata.endpoint || 'Default (mcp.cloud.cdata.com)', ok: true },
      ],
    },
    {
      title: 'Data Sources',
      configured: true,
      items: [
        {
          label: 'Tables',
          value: lockedTables.length > 0
            ? `${lockedTables.length} table(s) selected`
            : 'All tables (no lock)',
          ok: true,
        },
      ],
    },
    {
      title: 'LLM Provider',
      configured: !!(llm.apiKey),
      items: [
        { label: 'Provider', value: llm.provider.charAt(0).toUpperCase() + llm.provider.slice(1), ok: true },
        { label: 'API Key', value: llm.apiKey ? '****' + llm.apiKey.slice(-4) : 'Not set', ok: !!llm.apiKey },
        { label: 'Model', value: llm.model, ok: !!llm.model },
      ],
    },
  ];

  const allConfigured = sections.every((s) => s.configured);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-cdata-black font-grafier">Review & Save</h3>
        <p className="text-sm text-gray-500 mt-1">
          Review your configuration before saving. All credentials will be encrypted.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className={cn(
              'p-4 rounded-lg border',
              section.configured ? 'border-green-200 bg-green-50/50' : 'border-yellow-200 bg-yellow-50/50'
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              {section.configured ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-500" />
              )}
              <h4 className="font-medium text-sm">{section.title}</h4>
            </div>
            <div className="space-y-1.5 ml-6">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{item.label}</span>
                  <span className={cn('font-mono', item.ok ? 'text-gray-700' : 'text-red-500')}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!allConfigured && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-xs text-yellow-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Some connections are not configured. You can still save and configure them later.
          </p>
        </div>
      )}

      <div className="p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500 flex items-center gap-2">
          <span className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Check className="w-2.5 h-2.5 text-white" />
          </span>
          Credentials encrypted with AES-256-GCM before storage
        </p>
      </div>
    </div>
  );
}
