'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  Key,
  Globe,
  Shield,
  ExternalLink,
  Database,
  Zap,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Theme, LLM_MODELS, LLM_PROVIDERS, LLMProvider } from '@/types';

// Connection Test Status
interface ConnectionStatus {
  connected: boolean;
  message: string;
}

// Theme Option Button
function ThemeOption({
  theme,
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  theme: Theme;
  icon: typeof Sun;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
        selected
          ? 'border-cdata-yellow bg-cdata-yellow/10'
          : 'border-gray-200 hover:border-gray-300'
      )}
    >
      <Icon className={cn('w-5 h-5', selected ? 'text-cdata-black' : 'text-gray-500')} />
      <span className={cn('text-sm font-medium', selected ? 'text-cdata-black' : 'text-gray-600')}>
        {label}
      </span>
    </button>
  );
}

// Settings Section Component
function SettingsSection({
  title,
  description,
  icon: Icon,
  iconBg,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Database;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-cdata-black">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// Data Sources Settings - Live catalog discovery
function DataSourcesSettings() {
  const [catalogData, setCatalogData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCatalogs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await apiClient('/api/catalogs?refresh=true');
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.catalogs) {
        setCatalogData(data);
      }
    } catch (err) {
      setError('Failed to connect. Check your CData credentials.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogs();
  }, [fetchCatalogs]);

  const catalogs = catalogData?.catalogs || [];
  const totalTables = catalogData?.totalTables || 0;
  const isLive = catalogs.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              {catalogs.length} catalogs / {totalTables} tables discovered
            </span>
          ) : isLoading ? (
            <span className="flex items-center gap-1.5 text-sm text-yellow-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Discovering catalogs...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <span className="w-2 h-2 bg-gray-400 rounded-full" />
              Not connected
            </span>
          )}
        </div>
        <button
          onClick={fetchCatalogs}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:border-gray-300 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {isLive && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {catalogs.map((cat: any) => (
            <div key={cat.catalog} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cdata-yellow" />
                <span className="text-sm font-medium text-gray-800">{cat.catalog}</span>
              </div>
              <span className="text-xs text-gray-500">{cat.tableCount} tables</span>
            </div>
          ))}
        </div>
      )}

      {!isLive && !isLoading && !error && (
        <p className="text-sm text-gray-500">
          Configure your CData credentials in the Connection Setup wizard to discover available data sources.
        </p>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSettings } = useAppStore();
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showCDataPAT, setShowCDataPAT] = useState(false);
  const [testing, setTesting] = useState<'openai' | 'cdata' | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    openai?: ConnectionStatus;
    cdata?: ConnectionStatus;
  }>({});

  const testConnection = async (type: 'openai' | 'cdata' | 'all') => {
    setTesting(type === 'all' ? 'cdata' : type);
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: type }),
      });
      const data = await response.json();
      setConnectionStatus(data);
    } catch (error) {
      setConnectionStatus({
        openai: { connected: false, message: 'Test failed' },
        cdata: { connected: false, message: 'Test failed' },
      });
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-cdata-black">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your API connections and preferences</p>
      </div>

      {/* CData Connect AI Configuration */}
      <SettingsSection
        title="CData Connect AI"
        description="Configure your CData Connect AI MCP connection"
        icon={Database}
        iconBg="bg-cdata-yellow/20 text-cdata-black"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MCP Endpoint</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                defaultValue="https://mcp.cloud.cdata.com/mcp"
                className="w-full pl-10 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 font-mono text-sm"
                readOnly
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="your-email@company.com"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">
              Set via <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">CDATA_EMAIL</code> in .env.local
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personal Access Token (PAT)
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showCDataPAT ? 'text' : 'password'}
                placeholder="Your CData PAT"
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm"
                readOnly
              />
              <button
                onClick={() => setShowCDataPAT(!showCDataPAT)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCDataPAT ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Set via <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">CDATA_PAT</code> in .env.local
              <a
                href="https://cloud.cdata.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-cdata-navy hover:underline inline-flex items-center gap-1"
              >
                Get your PAT <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              {connectionStatus.cdata && (
                <span
                  className={cn(
                    'flex items-center gap-1 text-sm',
                    connectionStatus.cdata.connected ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {connectionStatus.cdata.connected ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {connectionStatus.cdata.message}
                </span>
              )}
            </div>
            <button
              onClick={() => testConnection('cdata')}
              disabled={testing === 'cdata'}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:border-gray-300 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {testing === 'cdata' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Test Connection
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* LLM Configuration */}
      <SettingsSection
        title="LLM Configuration"
        description="Configure your AI model provider"
        icon={Zap}
        iconBg="bg-green-100 text-green-700"
      >
        <div className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {LLM_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    const models = LLM_MODELS[p.id];
                    const defaultModel = models?.[0]?.id || 'gpt-4o';
                    updateSettings({ llmProvider: p.id, selectedModel: defaultModel });
                  }}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    settings.llmProvider === p.id
                      ? 'border-cdata-yellow bg-cdata-yellow/10'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-cdata-black">{p.name}</span>
                    <span className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded-full', p.badgeColor)}>
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* API Key - dynamic per provider */}
          {(() => {
            const currentProvider = LLM_PROVIDERS.find(p => p.id === settings.llmProvider);
            return (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {currentProvider?.name || settings.llmProvider} API Key
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showOpenAIKey ? 'text' : 'password'}
                    placeholder={`${currentProvider?.keyPrefix || ''}...`}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm"
                    readOnly
                  />
                  <button
                    onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showOpenAIKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Configured via Connection Setup wizard or .env.local
                  {currentProvider?.keyUrl && (
                    <a
                      href={currentProvider.keyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-cdata-navy hover:underline inline-flex items-center gap-1"
                    >
                      Get {currentProvider.badge === 'Free' ? 'free ' : ''}key <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </p>
              </div>
            );
          })()}

          {/* Model Selection - dynamic per provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            {(() => {
              const models = LLM_MODELS[settings.llmProvider] || [];
              const categories = [...new Set(models.map(m => m.category))];
              return (
                <select
                  value={settings.selectedModel}
                  onChange={(e) => updateSettings({ selectedModel: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:border-cdata-yellow focus:ring-2 focus:ring-cdata-yellow/20 outline-none text-sm"
                >
                  {categories.map((category) => (
                    <optgroup key={category} label={category}>
                      {models
                        .filter((m) => m.category === category)
                        .map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name} - {model.description}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              );
            })()}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              {connectionStatus.openai && (
                <span
                  className={cn(
                    'flex items-center gap-1 text-sm',
                    connectionStatus.openai.connected ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {connectionStatus.openai.connected ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {connectionStatus.openai.message}
                </span>
              )}
            </div>
            <button
              onClick={() => testConnection('openai')}
              disabled={testing === 'openai'}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:border-gray-300 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {testing === 'openai' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Test Connection
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* Data Sources - Live Catalog Discovery */}
      <SettingsSection
        title="Data Sources"
        description="Connected data catalogs from CData Connect AI"
        icon={Database}
        iconBg="bg-blue-100 text-blue-700"
      >
        <DataSourcesSettings />
      </SettingsSection>

      {/* Display Preferences */}
      <SettingsSection
        title="Display Preferences"
        description="Customize your experience"
        icon={Monitor}
        iconBg="bg-purple-100 text-purple-700"
      >
        <div className="space-y-6">
          {/* Theme Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Theme</label>
            <div className="flex gap-3">
              <ThemeOption
                theme="light"
                icon={Sun}
                label="Light"
                selected={settings.theme === 'light'}
                onClick={() => updateSettings({ theme: 'light' })}
              />
              <ThemeOption
                theme="dark"
                icon={Moon}
                label="Dark"
                selected={settings.theme === 'dark'}
                onClick={() => updateSettings({ theme: 'dark' })}
              />
              <ThemeOption
                theme="system"
                icon={Monitor}
                label="System"
                selected={settings.theme === 'system'}
                onClick={() => updateSettings({ theme: 'system' })}
              />
            </div>
          </div>

          {/* Results per page */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Results per page</label>
            <select
              value={settings.resultsPerPage}
              onChange={(e) => updateSettings({ resultsPerPage: Number(e.target.value) })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:border-cdata-yellow outline-none text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Show SQL queries toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Show SQL queries</p>
              <p className="text-xs text-gray-500">Display generated SQL for each search</p>
            </div>
            <button
              onClick={() => updateSettings({ showSQLQueries: !settings.showSQLQueries })}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                settings.showSQLQueries ? 'bg-cdata-yellow' : 'bg-gray-200'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow',
                  settings.showSQLQueries ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* Quick Setup Guide */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-cdata-black mb-3">Quick Setup Guide</h3>
        <ol className="space-y-2 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="font-bold text-cdata-navy">1.</span>
            Use the <strong>Connection Setup</strong> wizard (recommended) or configure via .env.local
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-cdata-navy">2.</span>
            <span><strong className="text-green-600">Free:</strong> Groq or Google Gemini &mdash; <strong className="text-blue-600">Paid:</strong> OpenAI, DeepSeek, Mistral</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-cdata-navy">3.</span>
            Add your CData Connect AI email and PAT from{' '}
            <a href="https://cloud.cdata.com/settings/tokens" target="_blank" className="text-cdata-navy underline">
              cloud.cdata.com
            </a>
          </li>
        </ol>

        <div className="mt-4 p-4 bg-white rounded-lg border font-mono text-xs overflow-x-auto">
          <pre className="text-gray-600">{`# .env.local
LLM_PROVIDER=groq          # groq | gemini | deepseek | mistral | openai
GROQ_API_KEY=gsk_...       # Free
# GEMINI_API_KEY=AI...     # Free (Google AI Studio)
# DEEPSEEK_API_KEY=sk-...  # Paid (low cost)
# MISTRAL_API_KEY=...      # Paid
# OPENAI_API_KEY=sk-...    # Paid

# CData Connect AI (required)
CDATA_EMAIL=your-email@company.com
CDATA_PAT=your-personal-access-token`}</pre>
        </div>
      </div>
    </div>
  );
}
