'use client';

import { useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { ConnectionStatus } from '@/types';

interface CDataStepProps {
  email: string;
  pat: string;
  endpoint: string;
  onChange: (data: { email: string; pat: string; endpoint: string }) => void;
}

export function CDataStep({ email, pat, endpoint, onChange }: CDataStepProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [statusMessage, setStatusMessage] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const testConnection = async () => {
    if (!email || !pat) return;
    setIsTesting(true);
    setStatus('testing');

    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'cdata',
          credentials: { email, pat, endpoint },
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
        <h3 className="text-lg font-semibold text-cdata-black font-grafier">CData Connect AI</h3>
        <p className="text-sm text-gray-500 mt-1">
          Connect to your data sources through CData Connect AI MCP endpoint.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => onChange({ email: e.target.value, pat, endpoint })}
            placeholder="your@email.com"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-cdata-yellow focus:ring-2 focus:ring-cdata-yellow/20 focus:outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Personal Access Token (PAT)
          </label>
          <PasswordInput
            value={pat}
            onChange={(v) => onChange({ email, pat: v, endpoint })}
            placeholder="Your CData PAT"
          />
          <a
            href="https://cloud.cdata.com/docs/personal-access-tokens.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-1"
          >
            How to get a PAT <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            MCP Endpoint
            <span className="text-gray-400 font-normal ml-1">(optional)</span>
          </label>
          <input
            type="url"
            value={endpoint}
            onChange={(e) => onChange({ email, pat, endpoint: e.target.value })}
            placeholder="https://mcp.cloud.cdata.com/mcp"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-cdata-yellow focus:ring-2 focus:ring-cdata-yellow/20 focus:outline-none text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">Leave blank for default endpoint</p>
        </div>
      </div>

      {/* Test connection */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <StatusIndicator status={status} label={statusMessage || undefined} />
        <button
          onClick={testConnection}
          disabled={isTesting || !email || !pat}
          className="px-4 py-1.5 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Test Connection
        </button>
      </div>
    </div>
  );
}
