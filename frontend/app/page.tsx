'use client';

import { useState } from 'react';
import { Cpu, AlertCircle, Play, TestTube } from 'lucide-react';
import { FileUpload, FormatSpecifier, ProgressIndicator, ResultDisplay } from './components';
import { analyzeExecutable, runDemo } from './services/api';
import { AnalysisResponse } from './types';

export default function Home() {
  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [inputFormat, setInputFormat] = useState('');
  const [constraints, setConstraints] = useState('');
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<'generating' | 'executing' | 'inferring' | 'complete' | 'error'>('generating');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const canSubmit = inputFormat.trim().length > 0 && !isLoading;

  const simulateProgress = () => {
    // Stage 1: Generating (0-25%)
    setStage('generating');
    setProgress(0);
    setMessage('Generating intelligent test cases...');
    
    setTimeout(() => {
      setProgress(15);
      setMessage('Creating diverse input patterns...');
    }, 500);
    
    setTimeout(() => {
      setProgress(25);
      // Stage 2: Executing (25-75%)
      setStage('executing');
      setMessage('Executing test cases in sandbox...');
    }, 1500);
    
    setTimeout(() => {
      setProgress(50);
      setMessage('Running behavioral analysis...');
    }, 3000);
    
    setTimeout(() => {
      setProgress(75);
      // Stage 3: Inferring (75-100%)
      setStage('inferring');
      setMessage('Analyzing patterns with AI...');
    }, 4500);
  };

  const handleAnalyze = async (useMock: boolean = false) => {
    setError(null);
    setResult(null);
    setIsLoading(true);
    
    simulateProgress();

    try {
      let response: AnalysisResponse;
      
      if (useMock || !file) {
        response = await runDemo(inputFormat, constraints);
      } else {
        response = await analyzeExecutable(file, inputFormat, constraints, useMock);
      }

      if (response.success && response.inference) {
        setStage('complete');
        setProgress(100);
        setMessage('Analysis complete!');
        setResult(response);
      } else {
        throw new Error(response.error || 'Analysis failed');
      }
    } catch (err) {
      setStage('error');
      setError(err instanceof Error ? err.message : 'An error occurred');
      setMessage('Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setInputFormat('');
    setConstraints('');
    setResult(null);
    setError(null);
    setProgress(0);
    setStage('generating');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Cpu className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                exeRunner
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI-Powered Black-Box Problem Reconstruction
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {result ? (
          /* Results View */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Analysis Results
              </h2>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                Analyze Another
              </button>
            </div>
            <ResultDisplay result={result.inference!} stats={result.stats} />
          </div>
        ) : (
          /* Input Form */
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
              <h2 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                How it works
              </h2>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                <li>Upload a compiled executable (.exe) or use demo mode</li>
                <li>Describe the input format the program expects</li>
                <li>Our AI generates test cases, executes them, and analyzes patterns</li>
                <li>Get the reconstructed problem statement and solution code</li>
              </ol>
            </div>

            {/* Form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
              <FileUpload
                onFileSelect={setFile}
                selectedFile={file}
                disabled={isLoading}
              />

              <FormatSpecifier
                inputFormat={inputFormat}
                constraints={constraints}
                onInputFormatChange={setInputFormat}
                onConstraintsChange={setConstraints}
                disabled={isLoading}
              />

              {/* Error Display */}
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800 dark:text-red-200">Analysis Failed</p>
                    <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Progress */}
              {isLoading && (
                <ProgressIndicator
                  isLoading={isLoading}
                  stage={stage}
                  progress={progress}
                  message={message}
                />
              )}

              {/* Action Buttons */}
              {!isLoading && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAnalyze(false)}
                    disabled={!canSubmit || !file}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    Analyze Executable
                  </button>
                  <button
                    onClick={() => handleAnalyze(true)}
                    disabled={!canSubmit}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <TestTube className="w-4 h-4" />
                    Demo Mode
                  </button>
                </div>
              )}
            </div>

            {/* Demo Presets */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Quick Start - Try these presets:
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'Array Sum', format: 'First line: integer n\nSecond line: n space-separated integers', constraints: '1 ≤ n ≤ 100000' },
                  { name: 'Fibonacci', format: 'Single integer n', constraints: '1 ≤ n ≤ 30' },
                  { name: 'Max Element', format: 'First line: integer n\nSecond line: n integers', constraints: '1 ≤ n ≤ 1000' },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setInputFormat(preset.format);
                      setConstraints(preset.constraints);
                    }}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            exeRunner - Behavioral Program Synthesis through Observational Inference
          </p>
        </div>
      </footer>
    </div>
  );
}
