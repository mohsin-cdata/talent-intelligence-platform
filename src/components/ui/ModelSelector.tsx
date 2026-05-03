'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { LLM_MODELS, LLM_PROVIDERS, LLMProvider } from '@/types';
import { cn } from '@/lib/utils';

export function ModelSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { settings, updateSettings } = useAppStore();

  // Get current provider's models
  const providerModels = LLM_MODELS[settings.llmProvider] || LLM_MODELS.groq;
  const currentModel = providerModels.find((m) => m.id === settings.selectedModel) || providerModels[0];
  const currentProvider = LLM_PROVIDERS.find((p) => p.id === settings.llmProvider);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProviderChange = (provider: LLMProvider) => {
    const models = LLM_MODELS[provider];
    const defaultModel = models?.[0]?.id || '';
    updateSettings({ llmProvider: provider, selectedModel: defaultModel });
  };

  const handleModelChange = (modelId: string) => {
    updateSettings({ selectedModel: modelId });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-sm"
      >
        <Zap className="w-3.5 h-3.5 text-cdata-yellow" />
        <span className="font-medium text-gray-700">{currentModel.name}</span>
        {currentProvider && (
          <span className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded', currentProvider.badgeColor)}>
            {currentProvider.badge}
          </span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Provider tabs - wrapping grid */}
          <div className="flex flex-wrap border-b border-gray-200">
            {LLM_PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleProviderChange(provider.id)}
                className={cn(
                  'px-2.5 py-2 text-[11px] font-medium transition-colors whitespace-nowrap',
                  settings.llmProvider === provider.id
                    ? 'bg-cdata-yellow/10 text-cdata-black border-b-2 border-cdata-yellow'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                {provider.name}
                <span className={cn('ml-1 px-1 py-0.5 text-[8px] font-medium rounded', provider.badgeColor)}>
                  {provider.badge}
                </span>
              </button>
            ))}
          </div>

          {/* Models list - dynamic for selected provider */}
          <div className="max-h-64 overflow-y-auto p-2">
            {(() => {
              const models = LLM_MODELS[settings.llmProvider] || [];
              const categories = [...new Set(models.map((m) => m.category))];

              return categories.map((category) => {
                const categoryModels = models.filter((m) => m.category === category);
                if (categoryModels.length === 0) return null;
                return (
                  <div key={category} className="mb-2">
                    <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {category}
                    </p>
                    {categoryModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => handleModelChange(model.id)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors',
                          settings.selectedModel === model.id
                            ? 'bg-cdata-yellow/20 text-cdata-black'
                            : 'hover:bg-gray-100 text-gray-700'
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium">{model.name}</p>
                          <p className="text-xs text-gray-500">{model.description}</p>
                        </div>
                        {settings.selectedModel === model.id && (
                          <Check className="w-4 h-4 text-cdata-black flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
