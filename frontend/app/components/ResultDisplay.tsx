'use client';

import { useState } from 'react';
import { 
  CheckCircle, 
  Copy, 
  Check, 
  Code, 
  FileText, 
  Clock, 
  Cpu, 
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { InferenceResult, ExecutionStats } from '../types';

interface ResultDisplayProps {
  result: InferenceResult;
  stats?: ExecutionStats;
}

export function ResultDisplay({ result, stats }: ResultDisplayProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [showFullCode, setShowFullCode] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(result.solutionCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const confidenceColor = result.confidence >= 0.8 
    ? 'text-green-600 dark:text-green-400' 
    : result.confidence >= 0.5 
      ? 'text-yellow-600 dark:text-yellow-400' 
      : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-6">
      {/* Problem Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-100 dark:border-blue-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                Problem Identified
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {result.problemTitle}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Confidence</p>
            <p className={`text-2xl font-bold ${confidenceColor}`}>
              {(result.confidence * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      {/* Execution Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <BarChart3 className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalTests}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Tests</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <CheckCircle className="w-5 h-5 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.successfulTests}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Passed</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <Clock className="w-5 h-5 text-orange-500 mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.averageExecutionTime.toFixed(0)}ms
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Time</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <Cpu className="w-5 h-5 text-purple-500 mb-2" />
            <p className="text-lg font-bold text-gray-900 dark:text-white">{result.timeComplexity}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Time Complexity</p>
          </div>
        </div>
      )}

      {/* Problem Statement */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
          <FileText className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-900 dark:text-white">Problem Statement</h3>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">{result.problemStatement}</p>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Input Format</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {result.inputFormat}
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Output Format</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {result.outputFormat}
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Constraints</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {result.constraints}
            </p>
          </div>
        </div>
      </div>

      {/* Sample Test Cases */}
      {result.sampleTestCases.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
            <h3 className="font-medium text-gray-900 dark:text-white">Sample Test Cases</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {result.sampleTestCases.map((tc, idx) => (
              <div key={idx} className="p-4">
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Input</p>
                    <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-sm overflow-x-auto">
                      {tc.input.replace(/\\n/g, '\n')}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Output</p>
                    <pre className="bg-gray-50 dark:bg-gray-900 p-2 rounded text-sm">
                      {tc.output}
                    </pre>
                  </div>
                </div>
                {tc.explanation && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    {tc.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solution Code */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium text-gray-900 dark:text-white">Solution Code (C++)</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFullCode(!showFullCode)}
              className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              {showFullCode ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showFullCode ? 'Collapse' : 'Expand'}
            </button>
            <button
              onClick={copyCode}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedCode ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        <div className={`overflow-hidden transition-all duration-300 ${showFullCode ? '' : 'max-h-64'}`}>
          <pre className="p-4 bg-gray-900 text-gray-100 text-sm overflow-x-auto">
            <code>{result.solutionCode}</code>
          </pre>
        </div>
        {!showFullCode && result.solutionCode.split('\n').length > 12 && (
          <div className="h-8 bg-gradient-to-t from-gray-900 to-transparent -mt-8 relative pointer-events-none" />
        )}
      </div>

      {/* Algorithm Explanation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
          <h3 className="font-medium text-gray-900 dark:text-white">Algorithm Explanation</h3>
        </div>
        <div className="p-4">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {result.algorithmExplanation}
          </p>
          <div className="flex gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Time Complexity: </span>
              <span className="font-mono font-medium text-gray-900 dark:text-white">{result.timeComplexity}</span>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Space Complexity: </span>
              <span className="font-mono font-medium text-gray-900 dark:text-white">{result.spaceComplexity}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
