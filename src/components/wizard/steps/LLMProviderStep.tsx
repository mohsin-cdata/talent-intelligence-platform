'use client';

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { LLMProvider, LLM_MODELS, LLM_PROVIDERS, ConnectionStatus } from '@/types';
import { cn } from '@/lib/utils';

interface LLMProviderStepProps {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  onChange: (data: { provider: LLMProvider; apiKey: string; model: string }) => void;
}

export function LLMProviderStep({ provider, apiKey, model, onChange }: LLMProviderStepProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const providerModels = LLM_MODELS[provider];

  const handleProviderChange = (p: LLMProvider) => {
    const models = LLM_MODELS[p];
    const defaultModel = models?.[0]?.id || 'gpt-4o';
    onChange({ provider: p, apiKey, model: defaultModel });
    setStatus('disconnected');
    setStatusMessage('');
  };

  const testConnection = async () => {
    if (!apiKey) return;
    setIsTesting(true);
    setStatus('testing');

    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'llm',
          credentials: { provider, apiKey, model },
        }),
      });

      const data = await response.json();
      setStatus(data.connected ? 'connected' : 'error');
      setStatusMessage(data.message);
    } catch {
      setStatus('error');
      setStatusMessage('Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-cdata-black font-grafier">LLM Provider</h3>
        <p className="text-sm text-gray-500 mt-1">
          Choose your AI provider for natural language queries and analysis.
        </p>
      </div>

      {/* Provider selection */}
      <div className="grid grid-cols-3 gap-2">
        {LLM_PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => handleProviderChange(p.id)}
            className={cn(
              'p-3 rounded-lg border text-center transition-all',
              provider === p.id
                ? 'border-cdata-yellow bg-cdata-yellow/5 shadow-sm'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <p className="font-medium text-sm">{p.name}</p>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-medium mt-1 inline-block', p.badgeColor)}>
              {p.badge}
            </span>
            <p className="text-[10px] text-gray-400 mt-1">{p.description}</p>
          </button>
        ))}
      </div>

      {/* API Key */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
        <PasswordInput
          value={apiKey}
          onChange={(v) => onChange({ provider, apiKey: v, model })}
          placeholder={`Enter your ${LLM_PROVIDERS.find((p) => p.id === provider)?.name || provider} API key`}
        />
      </div>

      {/* Model selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
        <div className="max-h-36 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
          {providerModels.map((m) => (
            <button
              key={m.id}
              onClick={() => onChange({ provider, apiKey, model: m.id })}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors text-sm',
                model === m.id
                  ? 'bg-cdata-yellow/20 text-cdata-black'
                  : 'hover:bg-gray-50 text-gray-700'
              )}
            >
              <div>
                <p className="font-medium text-xs">{m.name}</p>
                <p className="text-[10px] text-gray-500">{m.description}</p>
              </div>
              {model === m.id && <Check className="w-4 h-4 text-cdata-black flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Test */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <StatusIndicator status={status} label={statusMessage || undefined} />
        <button
          onClick={testConnection}
          disabled={isTesting || !apiKey}
          className="px-4 py-1.5 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Test Connection
        </button>
      </div>
    </div>
  );
}
