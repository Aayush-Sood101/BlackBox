'use client';

import { Loader2, CheckCircle2, XCircle, Sparkles, Play, Brain } from 'lucide-react';

interface ProgressIndicatorProps {
  isLoading: boolean;
  stage?: 'generating' | 'executing' | 'inferring' | 'complete' | 'error';
  progress?: number;
  message?: string;
}

export function ProgressIndicator({ 
  isLoading, 
  stage = 'generating', 
  progress = 0, 
  message 
}: ProgressIndicatorProps) {
  if (!isLoading) return null;

  const stages = [
    { id: 'generating', label: 'Generating Test Cases', icon: Sparkles },
    { id: 'executing', label: 'Executing Tests', icon: Play },
    { id: 'inferring', label: 'Analyzing Patterns', icon: Brain },
  ];

  const getStageIndex = (s: string) => stages.findIndex(st => st.id === s);
  const currentIndex = getStageIndex(stage);

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-center mb-6">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>

      {/* Stage indicators */}
      <div className="flex justify-between mb-6">
        {stages.map((s, index) => {
          const Icon = s.icon;
          const isActive = s.id === stage;
          const isComplete = currentIndex > index;
          const isError = stage === 'error';

          return (
            <div key={s.id} className="flex flex-col items-center flex-1">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full mb-2 transition-colors
                ${isComplete ? 'bg-green-100 dark:bg-green-900/30' : ''}
                ${isActive && !isError ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500' : ''}
                ${isError && isActive ? 'bg-red-100 dark:bg-red-900/30 ring-2 ring-red-500' : ''}
                ${!isComplete && !isActive ? 'bg-gray-100 dark:bg-gray-700' : ''}
              `}>
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : isError && isActive ? (
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                ) : (
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                )}
              </div>
              <span className={`text-xs font-medium text-center ${
                isActive ? 'text-blue-600 dark:text-blue-400' : 
                isComplete ? 'text-green-600 dark:text-green-400' : 
                'text-gray-400'
              }`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
        <div 
          className={`h-2 rounded-full transition-all duration-500 ${
            stage === 'error' ? 'bg-red-500' : 
            stage === 'complete' ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Message */}
      <p className={`text-center text-sm ${
        stage === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'
      }`}>
        {message || 'Processing...'}
      </p>
    </div>
  );
}
