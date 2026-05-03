'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { CDataStep } from './steps/CDataStep';
import { DataSourceStep } from './steps/DataSourceStep';
import { LLMProviderStep } from './steps/LLMProviderStep';
import { ReviewStep } from './steps/ReviewStep';
import { useAuthStore } from '@/lib/auth-store';
import { useAppStore } from '@/lib/store';
import { LLMProvider, UserCredentials } from '@/types';

interface ConnectionWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  { label: 'CData', description: 'Connect AI credentials' },
  { label: 'Sources', description: 'Data source selection' },
  { label: 'LLM', description: 'AI provider setup' },
  { label: 'Review', description: 'Save configuration' },
];

export function ConnectionWizard({ isOpen, onClose }: ConnectionWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const { saveCredentials, decryptedCredentials } = useAuthStore();

  // Pre-populate from saved credentials if available (user re-opening wizard)
  const saved = decryptedCredentials;

  // CData state
  const [cdataEmail, setCdataEmail] = useState(saved?.cdata?.email ?? '');
  const [cdataPat, setCdataPat] = useState(saved?.cdata?.pat ?? '');
  const [cdataEndpoint, setCdataEndpoint] = useState(saved?.cdata?.endpoint ?? '');

  // Data source state
  const [lockedTables, setLockedTables] = useState<string[]>([]);

  // LLM state
  const [llmProvider, setLlmProvider] = useState<LLMProvider>(saved?.llm?.provider ?? 'groq');
  const [llmApiKey, setLlmApiKey] = useState(saved?.llm?.apiKey ?? '');
  const [llmModel, setLlmModel] = useState(saved?.llm?.model ?? 'llama-3.3-70b-versatile');
  const { updateSettings } = useAppStore();

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const credentials: UserCredentials = {
        cdata: cdataEmail && cdataPat
          ? { email: cdataEmail, pat: cdataPat, endpoint: cdataEndpoint || 'https://mcp.cloud.cdata.com/mcp' }
          : null,
        llm: llmApiKey
          ? { provider: llmProvider, apiKey: llmApiKey, model: llmModel }
          : null,
        dataSource: lockedTables.length > 0
          ? { lockedTables }
          : null,
      };

      await saveCredentials(credentials);

      // Also update app settings to reflect chosen LLM
      if (llmApiKey) {
        updateSettings({ llmProvider, selectedModel: llmModel });
      }

      onClose();
    } catch (err) {
      console.error('Failed to save credentials:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 0: return true; // CData is optional
      case 1: return true; // Data source lock is optional
      case 2: return true; // LLM is optional (can use env vars)
      case 3: return true;
      default: return true;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl mx-4 max-h-[90vh] flex flex-col animate-in">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-cdata-black font-grafier">Connection Setup</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {currentStep === 0 && (
            <CDataStep
              email={cdataEmail}
              pat={cdataPat}
              endpoint={cdataEndpoint}
              onChange={({ email, pat, endpoint }) => {
                setCdataEmail(email);
                setCdataPat(pat);
                setCdataEndpoint(endpoint);
              }}
            />
          )}
          {currentStep === 1 && (
            <DataSourceStep
              lockedTables={lockedTables}
              onChange={setLockedTables}
              cdataConfigured={!!(cdataEmail && cdataPat)}
              cdataEmail={cdataEmail}
              cdataPat={cdataPat}
              cdataEndpoint={cdataEndpoint}
            />
          )}
          {currentStep === 2 && (
            <LLMProviderStep
              provider={llmProvider}
              apiKey={llmApiKey}
              model={llmModel}
              onChange={({ provider, apiKey, model }) => {
                setLlmProvider(provider);
                setLlmApiKey(apiKey);
                setLlmModel(model);
              }}
            />
          )}
          {currentStep === 3 && (
            <ReviewStep
              cdata={{ email: cdataEmail, pat: cdataPat, endpoint: cdataEndpoint }}
              llm={{ provider: llmProvider, apiKey: llmApiKey, model: llmModel }}
              lockedTables={lockedTables}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canGoNext()}
              className="flex items-center gap-1.5 btn-cdata-primary px-6 py-2 text-sm"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 btn-cdata-primary px-6 py-2 text-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save & Close
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
