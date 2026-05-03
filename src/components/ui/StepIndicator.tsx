'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={index} className="flex items-center">
            {/* Step circle */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                  isCompleted && 'bg-green-500 text-white',
                  isCurrent && 'bg-cdata-yellow text-cdata-black ring-2 ring-cdata-yellow/30',
                  !isCompleted && !isCurrent && 'bg-gray-200 text-gray-500'
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:block',
                  isCurrent ? 'text-cdata-black' : 'text-gray-400'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-2',
                  index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
