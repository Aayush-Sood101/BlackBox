# PHASE 1: Foundation & MVP Development

## Overview

**Duration**: Week 1-2  
**Objective**: Build the foundational infrastructure including project setup, basic frontend with file upload, backend server with Docker sandbox execution, and initial LLM integration for simple test case generation and pattern inference.

---

## Table of Contents

1. [Project Structure Setup](#1-project-structure-setup)
2. [Environment Configuration](#2-environment-configuration)
3. [Frontend Development (Next.js)](#3-frontend-development-nextjs)
4. [Backend Development (Node.js + Express)](#4-backend-development-nodejs--express)
5. [Docker Sandbox Setup](#5-docker-sandbox-setup)
6. [Basic LLM Integration](#6-basic-llm-integration)
7. [Simple Pipeline Implementation](#7-simple-pipeline-implementation)
8. [Testing Phase 1](#8-testing-phase-1)

---

## 1. Project Structure Setup

### 1.1 Initialize Project Directory

```bash
# Create main project directory
mkdir exeRunner
cd exeRunner

# Initialize git repository
git init

# Create directory structure
mkdir -p frontend backend docker sandbox logs
```

### 1.2 Complete Project Structure

```
exeRunner/
├── frontend/                   # Next.js frontend application
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Main upload page
│   │   └── api/
│   │       └── upload/
│   │           └── route.ts    # API route for file upload
│   ├── components/
│   │   ├── FileUpload.tsx      # File upload component
│   │   ├── FormatSpecifier.tsx # Input format specification form
│   │   ├── ResultDisplay.tsx   # Results display component
│   │   └── ProgressIndicator.tsx
│   ├── lib/
│   │   └── api.ts              # API client helpers
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
│
├── backend/                    # Node.js + Express backend
│   ├── src/
│   │   ├── index.ts            # Entry point
│   │   ├── config/
│   │   │   ├── index.ts        # Configuration management
│   │   │   └── docker.ts       # Docker configuration
│   │   ├── controllers/
│   │   │   ├── uploadController.ts
│   │   │   └── executeController.ts
│   │   ├── services/
│   │   │   ├── dockerService.ts    # Docker container management
│   │   │   ├── executionService.ts # Test execution logic
│   │   │   └── llmService.ts       # Gemini API integration
│   │   ├── middleware/
│   │   │   ├── upload.ts           # Multer middleware
│   │   │   ├── validation.ts       # Input validation
│   │   │   └── errorHandler.ts
│   │   ├── routes/
│   │   │   └── api.ts
│   │   └── utils/
│   │       ├── sanitizer.ts
│   │       └── logger.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── docker/                     # Docker configuration
│   ├── Dockerfile.sandbox      # Sandbox container image
│   ├── docker-compose.yml      # Development setup
│   └── seccomp-profile.json    # Syscall filtering
│
├── sandbox/                    # Temporary execution directory
│   └── .gitkeep
│
├── logs/                       # Application logs
│   └── .gitkeep
│
├── .gitignore
├── README.md
└── package.json               # Root package.json for workspace
```

### 1.3 Initialize Package Files

Create root `package.json`:

```json
{
  "name": "exe-runner",
  "version": "1.0.0",
  "description": "AI-Based Black-Box Problem Reconstruction System",
  "private": true,
  "workspaces": [
    "frontend",
    "backend"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\"",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "cd backend && npm run dev",
    "build": "npm run build:frontend && npm run build:backend",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd backend && npm run build",
    "docker:build": "docker build -t sandbox:latest -f docker/Dockerfile.sandbox ."
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

---

## 2. Environment Configuration

### 2.1 Environment Variables

Create `backend/.env.example`:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-preview-05-20

# Docker Configuration
DOCKER_TIMEOUT=5000
DOCKER_MEMORY_LIMIT=256MB
DOCKER_CPU_QUOTA=50000
SANDBOX_IMAGE=sandbox:latest

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Security
ALLOWED_ORIGINS=http://localhost:3000

# Logging
LOG_LEVEL=debug
```

### 2.2 Frontend Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 2.3 TypeScript Configuration

Create `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 3. Frontend Development (Next.js)

### 3.1 Initialize Next.js Project

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false
```

### 3.2 Install Dependencies

```bash
npm install axios react-dropzone @radix-ui/react-progress lucide-react
npm install -D @types/node
```

### 3.3 Frontend Package.json

```json
{
  "name": "exe-runner-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "axios": "^1.6.8",
    "react-dropzone": "^14.2.3",
    "@radix-ui/react-progress": "^1.0.3",
    "lucide-react": "^0.370.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0"
  }
}
```

### 3.4 Main Layout (`app/layout.tsx`)

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EXE Runner - Problem Reconstruction',
  description: 'AI-Based Black-Box Problem Reconstruction System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

### 3.5 Main Page (`app/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import FormatSpecifier from '@/components/FormatSpecifier';
import ResultDisplay from '@/components/ResultDisplay';
import ProgressIndicator from '@/components/ProgressIndicator';
import { analyzeExecutable } from '@/lib/api';

interface AnalysisResult {
  problemStatement: string;
  solution: string;
  algorithm: string;
  observations: { input: string; output: string }[];
}

type AnalysisStage = 'idle' | 'uploading' | 'generating' | 'executing' | 'inferring' | 'complete' | 'error';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [inputFormat, setInputFormat] = useState('');
  const [constraints, setConstraints] = useState('');
  const [stage, setStage] = useState<AnalysisStage>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!file || !inputFormat) {
      setError('Please upload a file and specify the input format');
      return;
    }

    setError(null);
    setStage('uploading');

    try {
      const response = await analyzeExecutable(
        file,
        inputFormat,
        constraints,
        (newStage) => setStage(newStage as AnalysisStage)
      );
      setResult(response);
      setStage('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStage('error');
    }
  };

  const handleReset = () => {
    setFile(null);
    setInputFormat('');
    setConstraints('');
    setStage('idle');
    setResult(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            EXE Runner
          </h1>
          <p className="text-gray-400 text-lg">
            AI-Based Black-Box Problem Reconstruction System
          </p>
        </header>

        {stage === 'complete' && result ? (
          <ResultDisplay result={result} onReset={handleReset} />
        ) : (
          <div className="space-y-8">
            {/* File Upload Section */}
            <section className="bg-gray-800 rounded-lg p-6 shadow-xl">
              <h2 className="text-xl font-semibold mb-4">1. Upload Executable</h2>
              <FileUpload
                file={file}
                onFileSelect={setFile}
                disabled={stage !== 'idle'}
              />
            </section>

            {/* Format Specification Section */}
            <section className="bg-gray-800 rounded-lg p-6 shadow-xl">
              <h2 className="text-xl font-semibold mb-4">2. Specify Input Format</h2>
              <FormatSpecifier
                inputFormat={inputFormat}
                constraints={constraints}
                onInputFormatChange={setInputFormat}
                onConstraintsChange={setConstraints}
                disabled={stage !== 'idle'}
              />
            </section>

            {/* Progress / Submit Section */}
            <section className="bg-gray-800 rounded-lg p-6 shadow-xl">
              {stage !== 'idle' && stage !== 'error' ? (
                <ProgressIndicator stage={stage} />
              ) : (
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={!file || !inputFormat}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 
                             disabled:cursor-not-allowed text-white font-semibold py-3 px-6 
                             rounded-lg transition-colors duration-200"
                  >
                    Analyze Executable
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
```

### 3.6 File Upload Component (`components/FileUpload.tsx`)

```tsx
'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';

interface FileUploadProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export default function FileUpload({ file, onFileSelect, disabled }: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/x-executable': ['.exe'],
      'application/x-msdos-program': ['.exe'],
      'application/octet-stream': ['.exe'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled,
  });

  const removeFile = () => {
    onFileSelect(null);
  };

  if (file) {
    return (
      <div className="flex items-center justify-between bg-gray-700 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <File className="w-8 h-8 text-blue-400" />
          <div>
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-gray-400">
              {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
        </div>
        {!disabled && (
          <button
            onClick={removeFile}
            className="p-2 hover:bg-gray-600 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-colors duration-200
        ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
      {isDragActive ? (
        <p className="text-blue-400">Drop the file here...</p>
      ) : (
        <div>
          <p className="text-gray-300 mb-2">
            Drag & drop an executable file here, or click to select
          </p>
          <p className="text-sm text-gray-500">
            Only .exe files up to 10MB are accepted
          </p>
        </div>
      )}
    </div>
  );
}
```

### 3.7 Format Specifier Component (`components/FormatSpecifier.tsx`)

```tsx
'use client';

interface FormatSpecifierProps {
  inputFormat: string;
  constraints: string;
  onInputFormatChange: (value: string) => void;
  onConstraintsChange: (value: string) => void;
  disabled?: boolean;
}

export default function FormatSpecifier({
  inputFormat,
  constraints,
  onInputFormatChange,
  onConstraintsChange,
  disabled,
}: FormatSpecifierProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Input Format Description *
        </label>
        <textarea
          value={inputFormat}
          onChange={(e) => onInputFormatChange(e.target.value)}
          disabled={disabled}
          placeholder="Example:&#10;First line: integer n (number of elements)&#10;Second line: n space-separated integers"
          className="w-full h-32 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 
                   text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 
                   focus:ring-blue-500 outline-none resize-none disabled:opacity-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Constraints (optional)
        </label>
        <textarea
          value={constraints}
          onChange={(e) => onConstraintsChange(e.target.value)}
          disabled={disabled}
          placeholder="Example:&#10;1 ≤ n ≤ 100000&#10;-10^9 ≤ a[i] ≤ 10^9"
          className="w-full h-24 bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 
                   text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 
                   focus:ring-blue-500 outline-none resize-none disabled:opacity-50"
        />
      </div>

      <div className="bg-gray-700/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Format Tips:</h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Describe each line of input clearly</li>
          <li>• Specify data types (integer, string, float)</li>
          <li>• Include any relationships between variables</li>
          <li>• Mention any structural patterns (sorted, unique, etc.)</li>
        </ul>
      </div>
    </div>
  );
}
```

### 3.8 Progress Indicator Component (`components/ProgressIndicator.tsx`)

```tsx
'use client';

import { Loader2, CheckCircle2 } from 'lucide-react';

interface ProgressIndicatorProps {
  stage: 'uploading' | 'generating' | 'executing' | 'inferring' | 'complete' | 'idle' | 'error';
}

const stages = [
  { key: 'uploading', label: 'Uploading executable...' },
  { key: 'generating', label: 'Generating test cases...' },
  { key: 'executing', label: 'Executing tests in sandbox...' },
  { key: 'inferring', label: 'Analyzing patterns & inferring problem...' },
];

export default function ProgressIndicator({ stage }: ProgressIndicatorProps) {
  const currentIndex = stages.findIndex((s) => s.key === stage);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-center mb-6">Analysis in Progress</h3>
      
      <div className="space-y-3">
        {stages.map((s, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div
              key={s.key}
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors
                ${isCurrent ? 'bg-blue-500/20 border border-blue-500/50' : ''}
                ${isComplete ? 'bg-green-500/10' : ''}
              `}
            >
              {isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : isCurrent ? (
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
              )}
              <span
                className={`
                  ${isComplete ? 'text-green-400' : ''}
                  ${isCurrent ? 'text-blue-400 font-medium' : ''}
                  ${!isComplete && !isCurrent ? 'text-gray-500' : ''}
                `}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / stages.length) * 100}%` }}
          />
        </div>
        <p className="text-center text-sm text-gray-400 mt-2">
          Step {currentIndex + 1} of {stages.length}
        </p>
      </div>
    </div>
  );
}
```

### 3.9 Result Display Component (`components/ResultDisplay.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';

interface AnalysisResult {
  problemStatement: string;
  solution: string;
  algorithm: string;
  observations: { input: string; output: string }[];
}

interface ResultDisplayProps {
  result: AnalysisResult;
  onReset: () => void;
}

export default function ResultDisplay({ result, onReset }: ResultDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'problem' | 'solution' | 'observations'>('problem');

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analysis Results</h2>
        <button
          onClick={onReset}
          className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 
                   px-4 py-2 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>New Analysis</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-gray-700">
        {[
          { key: 'problem', label: 'Problem Statement' },
          { key: 'solution', label: 'Solution Code' },
          { key: 'observations', label: 'Test Observations' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px
              ${activeTab === tab.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800 rounded-lg p-6">
        {activeTab === 'problem' && (
          <div className="prose prose-invert max-w-none">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => copyToClipboard(result.problemStatement)}
                className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {result.problemStatement}
            </div>
          </div>
        )}

        {activeTab === 'solution' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-400">Algorithm: {result.algorithm}</span>
              <button
                onClick={() => copyToClipboard(result.solution)}
                className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <code className="text-sm text-green-400">{result.solution}</code>
            </pre>
          </div>
        )}

        {activeTab === 'observations' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-400">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">Input</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">Output</th>
                </tr>
              </thead>
              <tbody>
                {result.observations.map((obs, index) => (
                  <tr key={index} className="border-b border-gray-700/50">
                    <td className="py-3 px-4 text-gray-500">{index + 1}</td>
                    <td className="py-3 px-4 font-mono text-blue-300 whitespace-pre">
                      {obs.input.trim()}
                    </td>
                    <td className="py-3 px-4 font-mono text-green-300">
                      {obs.output}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 3.10 API Client (`lib/api.ts`)

```typescript
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AnalysisResult {
  problemStatement: string;
  solution: string;
  algorithm: string;
  observations: { input: string; output: string }[];
}

export async function analyzeExecutable(
  file: File,
  inputFormat: string,
  constraints: string,
  onStageChange: (stage: string) => void
): Promise<AnalysisResult> {
  // Create form data
  const formData = new FormData();
  formData.append('executable', file);
  formData.append('inputFormat', inputFormat);
  formData.append('constraints', constraints);

  onStageChange('uploading');

  // Upload file and start analysis
  const response = await axios.post(`${API_BASE_URL}/api/analyze`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.loaded === progressEvent.total) {
        onStageChange('generating');
      }
    },
  });

  // For MVP, we'll use a simple polling approach
  // In Phase 2, we'll implement WebSocket for real-time updates
  const jobId = response.data.jobId;

  // Poll for results
  let result: AnalysisResult | null = null;
  while (!result) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const statusResponse = await axios.get(`${API_BASE_URL}/api/status/${jobId}`);
    
    if (statusResponse.data.stage) {
      onStageChange(statusResponse.data.stage);
    }

    if (statusResponse.data.status === 'complete') {
      result = statusResponse.data.result;
    } else if (statusResponse.data.status === 'error') {
      throw new Error(statusResponse.data.error || 'Analysis failed');
    }
  }

  return result;
}
```

---

## 4. Backend Development (Node.js + Express)

### 4.1 Initialize Backend Project

```bash
cd backend
npm init -y
```

### 4.2 Install Dependencies

```bash
npm install express cors multer dockerode @google/generative-ai dotenv uuid winston
npm install -D typescript @types/express @types/cors @types/multer @types/node ts-node nodemon
```

### 4.3 Backend Package.json

```json
{
  "name": "exe-runner-backend",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "dockerode": "^4.0.2",
    "@google/generative-ai": "^0.5.0",
    "dotenv": "^16.4.5",
    "uuid": "^9.0.1",
    "winston": "^3.13.0"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.12.7",
    "@types/uuid": "^9.0.8",
    "ts-node": "^10.9.2",
    "nodemon": "^3.1.0"
  }
}
```

### 4.4 Entry Point (`src/index.ts`)

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;
```

### 4.5 API Routes (`src/routes/api.ts`)

```typescript
import { Router } from 'express';
import { uploadMiddleware } from '../middleware/upload';
import { validateAnalysisRequest } from '../middleware/validation';
import { startAnalysis, getAnalysisStatus } from '../controllers/analyzeController';

const router = Router();

// POST /api/analyze - Start new analysis
router.post(
  '/analyze',
  uploadMiddleware.single('executable'),
  validateAnalysisRequest,
  startAnalysis
);

// GET /api/status/:jobId - Get analysis status
router.get('/status/:jobId', getAnalysisStatus);

export default router;
```

### 4.6 Upload Middleware (`src/middleware/upload.ts`)

```typescript
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const jobDir = path.join(UPLOAD_DIR, uuidv4());
    fs.mkdirSync(jobDir, { recursive: true });
    cb(null, jobDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename
    const safeName = 'program.exe';
    cb(null, safeName);
  },
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.exe'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .exe files are allowed'));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
});
```

### 4.7 Validation Middleware (`src/middleware/validation.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';

export function validateAnalysisRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { inputFormat } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Executable file is required' });
  }

  if (!inputFormat || typeof inputFormat !== 'string' || inputFormat.trim().length === 0) {
    return res.status(400).json({ error: 'Input format description is required' });
  }

  // Sanitize inputs
  req.body.inputFormat = inputFormat.trim();
  req.body.constraints = (req.body.constraints || '').trim();

  next();
}
```

### 4.8 Error Handler Middleware (`src/middleware/errorHandler.ts`)

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Error:', err);

  if (err.message === 'Only .exe files are allowed') {
    return res.status(400).json({ error: err.message });
  }

  if (err.message.includes('File too large')) {
    return res.status(400).json({ error: 'File size exceeds 10MB limit' });
  }

  res.status(500).json({ error: 'Internal server error' });
}
```

### 4.9 Logger Utility (`src/utils/logger.ts`)

```typescript
import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}${stack ? '\n' + stack : ''}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});
```

### 4.10 Analyze Controller (`src/controllers/analyzeController.ts`)

```typescript
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { analysisJobs, JobStatus } from '../services/jobService';
import { runAnalysisPipeline } from '../services/pipelineService';
import { logger } from '../utils/logger';

export async function startAnalysis(req: Request, res: Response) {
  try {
    const jobId = path.basename(path.dirname(req.file!.path));
    const executablePath = req.file!.path;
    const { inputFormat, constraints } = req.body;

    // Initialize job
    analysisJobs.set(jobId, {
      status: 'pending',
      stage: 'uploading',
      createdAt: new Date(),
      inputFormat,
      constraints,
      executablePath,
    });

    logger.info(`Started analysis job: ${jobId}`);

    // Start pipeline asynchronously
    runAnalysisPipeline(jobId, executablePath, inputFormat, constraints).catch((err) => {
      logger.error(`Pipeline error for job ${jobId}:`, err);
      const job = analysisJobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = err.message;
      }
    });

    res.json({ jobId, status: 'started' });
  } catch (error) {
    logger.error('Error starting analysis:', error);
    res.status(500).json({ error: 'Failed to start analysis' });
  }
}

export async function getAnalysisStatus(req: Request, res: Response) {
  const { jobId } = req.params;
  const job = analysisJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const response: any = {
    status: job.status,
    stage: job.stage,
  };

  if (job.status === 'complete' && job.result) {
    response.result = job.result;
  }

  if (job.status === 'error') {
    response.error = job.error;
  }

  res.json(response);
}
```

### 4.11 Job Service (`src/services/jobService.ts`)

```typescript
export interface AnalysisResult {
  problemStatement: string;
  solution: string;
  algorithm: string;
  observations: { input: string; output: string }[];
}

export interface JobStatus {
  status: 'pending' | 'running' | 'complete' | 'error';
  stage: 'uploading' | 'generating' | 'executing' | 'inferring' | 'complete';
  createdAt: Date;
  inputFormat: string;
  constraints: string;
  executablePath: string;
  testCases?: { input: string; rationale: string }[];
  observations?: { input: string; output: string }[];
  result?: AnalysisResult;
  error?: string;
}

// In-memory job storage (use Redis in production)
export const analysisJobs = new Map<string, JobStatus>();

// Cleanup old jobs (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  for (const [jobId, job] of analysisJobs.entries()) {
    if (now - job.createdAt.getTime() > maxAge) {
      analysisJobs.delete(jobId);
    }
  }
}, 30 * 60 * 1000);
```

### 4.12 Pipeline Service (`src/services/pipelineService.ts`)

```typescript
import { analysisJobs, AnalysisResult } from './jobService';
import { generateTestCases } from './llmService';
import { executeTestCases } from './executionService';
import { inferProblem } from './llmService';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

export async function runAnalysisPipeline(
  jobId: string,
  executablePath: string,
  inputFormat: string,
  constraints: string
): Promise<void> {
  const job = analysisJobs.get(jobId);
  if (!job) throw new Error('Job not found');

  try {
    job.status = 'running';

    // Stage 1: Generate Test Cases
    logger.info(`[${jobId}] Stage 1: Generating test cases`);
    job.stage = 'generating';
    
    const testCases = await generateTestCases(inputFormat, constraints);
    job.testCases = testCases;
    logger.info(`[${jobId}] Generated ${testCases.length} test cases`);

    // Stage 2: Execute Test Cases
    logger.info(`[${jobId}] Stage 2: Executing test cases`);
    job.stage = 'executing';
    
    const observations = await executeTestCases(executablePath, testCases);
    job.observations = observations;
    logger.info(`[${jobId}] Collected ${observations.length} observations`);

    // Stage 3: Infer Problem
    logger.info(`[${jobId}] Stage 3: Inferring problem`);
    job.stage = 'inferring';
    
    const result = await inferProblem(inputFormat, constraints, observations);
    
    // Complete
    job.status = 'complete';
    job.stage = 'complete';
    job.result = result;
    logger.info(`[${jobId}] Analysis complete`);

    // Cleanup
    await cleanupJob(jobId, executablePath);

  } catch (error) {
    logger.error(`[${jobId}] Pipeline error:`, error);
    job.status = 'error';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    
    // Attempt cleanup on error
    await cleanupJob(jobId, executablePath).catch(() => {});
    
    throw error;
  }
}

async function cleanupJob(jobId: string, executablePath: string) {
  try {
    const jobDir = path.dirname(executablePath);
    await fs.rm(jobDir, { recursive: true, force: true });
    logger.info(`[${jobId}] Cleaned up job directory`);
  } catch (error) {
    logger.warn(`[${jobId}] Failed to cleanup:`, error);
  }
}
```

---

## 5. Docker Sandbox Setup

### 5.1 Sandbox Dockerfile (`docker/Dockerfile.sandbox`)

```dockerfile
FROM alpine:3.19

# Install Wine for running Windows executables
RUN apk add --no-cache \
    wine \
    wine-mono \
    xvfb \
    && rm -rf /var/cache/apk/*

# Create sandbox user (non-root)
RUN adduser -D -s /bin/sh sandbox

# Create working directory
WORKDIR /sandbox
RUN chown sandbox:sandbox /sandbox

# Switch to non-root user
USER sandbox

# Default command (will be overridden)
CMD ["/bin/sh"]
```

### 5.2 Docker Compose for Development (`docker/docker-compose.yml`)

```yaml
version: '3.8'

services:
  sandbox:
    build:
      context: .
      dockerfile: Dockerfile.sandbox
    image: sandbox:latest
    # For development only - don't expose in production
    
  backend:
    build: ../backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
    volumes:
      - ../backend/src:/app/src:ro
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - sandbox

  frontend:
    build: ../frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    depends_on:
      - backend
```

### 5.3 Docker Service (`src/services/dockerService.ts`)

```typescript
import Docker from 'dockerode';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

const docker = new Docker();

interface ExecutionResult {
  output: string;
  exitCode: number;
  timedOut: boolean;
  error?: string;
}

export async function executeInSandbox(
  executablePath: string,
  input: string,
  timeout: number = 5000
): Promise<ExecutionResult> {
  const containerName = `sandbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  let container: Docker.Container | null = null;

  try {
    // Write input to temp file
    const inputPath = path.join(path.dirname(executablePath), 'input.txt');
    await fs.writeFile(inputPath, input);

    // Create container
    container = await docker.createContainer({
      Image: process.env.SANDBOX_IMAGE || 'sandbox:latest',
      name: containerName,
      Cmd: [
        '/bin/sh',
        '-c',
        `timeout ${Math.ceil(timeout / 1000)}s wine /sandbox/program.exe < /sandbox/input.txt 2>/dev/null || true`,
      ],
      HostConfig: {
        Memory: parseInt(process.env.DOCKER_MEMORY_LIMIT || '268435456'), // 256MB
        MemorySwap: parseInt(process.env.DOCKER_MEMORY_LIMIT || '268435456'), // No swap
        CpuQuota: parseInt(process.env.DOCKER_CPU_QUOTA || '50000'), // 50% CPU
        NetworkMode: 'none',
        ReadonlyRootfs: false, // Wine needs some write access
        SecurityOpt: ['no-new-privileges'],
        CapDrop: ['ALL'],
        Binds: [
          `${path.dirname(executablePath)}:/sandbox:ro`,
        ],
      },
      WorkingDir: '/sandbox',
      User: 'sandbox',
    });

    // Start container
    await container.start();

    // Wait for completion with timeout
    const startTime = Date.now();
    let timedOut = false;

    const waitPromise = container.wait();
    const timeoutPromise = new Promise<{ StatusCode: number }>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve({ StatusCode: -1 });
      }, timeout + 1000); // Extra buffer
    });

    const result = await Promise.race([waitPromise, timeoutPromise]);

    // Get logs
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      follow: false,
    });

    // Parse output (remove Docker stream headers)
    const output = parseDockerLogs(logs);

    return {
      output: output.trim(),
      exitCode: result.StatusCode,
      timedOut,
    };

  } catch (error) {
    logger.error('Docker execution error:', error);
    return {
      output: '',
      exitCode: -1,
      timedOut: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    // Cleanup container
    if (container) {
      try {
        await container.stop({ t: 0 }).catch(() => {});
        await container.remove({ force: true, v: true });
      } catch (cleanupError) {
        logger.warn('Container cleanup error:', cleanupError);
      }
    }
  }
}

function parseDockerLogs(logs: Buffer): string {
  // Docker logs have an 8-byte header per chunk
  // First byte indicates stream (1=stdout, 2=stderr)
  // Bytes 4-7 are the size of the chunk
  let output = '';
  let offset = 0;

  while (offset < logs.length - 8) {
    const streamType = logs[offset];
    const size = logs.readUInt32BE(offset + 4);
    
    if (streamType === 1) { // stdout
      output += logs.slice(offset + 8, offset + 8 + size).toString('utf8');
    }
    
    offset += 8 + size;
  }

  return output || logs.toString('utf8'); // Fallback if parsing fails
}

// Health check for Docker
export async function checkDockerHealth(): Promise<boolean> {
  try {
    const info = await docker.info();
    return !!info.ID;
  } catch {
    return false;
  }
}
```

### 5.4 Execution Service (`src/services/executionService.ts`)

```typescript
import { executeInSandbox } from './dockerService';
import { logger } from '../utils/logger';

interface TestCase {
  input: string;
  rationale: string;
}

interface Observation {
  input: string;
  output: string;
}

export async function executeTestCases(
  executablePath: string,
  testCases: TestCase[]
): Promise<Observation[]> {
  const observations: Observation[] = [];
  const timeout = parseInt(process.env.DOCKER_TIMEOUT || '5000');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    logger.debug(`Executing test case ${i + 1}/${testCases.length}`);

    try {
      const result = await executeInSandbox(
        executablePath,
        testCase.input,
        timeout
      );

      if (result.timedOut) {
        logger.warn(`Test case ${i + 1} timed out`);
        observations.push({
          input: testCase.input,
          output: '[TIMEOUT]',
        });
      } else if (result.error) {
        logger.warn(`Test case ${i + 1} error: ${result.error}`);
        observations.push({
          input: testCase.input,
          output: '[ERROR]',
        });
      } else {
        observations.push({
          input: testCase.input,
          output: result.output,
        });
      }
    } catch (error) {
      logger.error(`Test case ${i + 1} execution failed:`, error);
      observations.push({
        input: testCase.input,
        output: '[EXECUTION_FAILED]',
      });
    }

    // Small delay between executions to prevent Docker overload
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Filter out failed executions for inference
  const validObservations = observations.filter(
    (obs) => !obs.output.startsWith('[')
  );

  if (validObservations.length < 5) {
    throw new Error('Insufficient valid test results for inference');
  }

  return validObservations;
}
```

---

## 6. Basic LLM Integration

### 6.1 LLM Service (`src/services/llmService.ts`)

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { AnalysisResult } from './jobService';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ 
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20' 
});

interface TestCase {
  input: string;
  rationale: string;
}

interface Observation {
  input: string;
  output: string;
}

/**
 * Stage 1: Generate test cases based on input format and constraints
 */
export async function generateTestCases(
  inputFormat: string,
  constraints: string
): Promise<TestCase[]> {
  const prompt = buildTestCaseGenerationPrompt(inputFormat, constraints);
  
  logger.debug('Generating test cases with LLM');
  
  const result = await model.generateContent(prompt);
  const response = result.response.text();
  
  // Parse JSON from response
  const testCases = parseTestCasesFromResponse(response);
  
  if (testCases.length < 10) {
    logger.warn(`Only generated ${testCases.length} test cases, expected at least 10`);
  }
  
  return testCases;
}

/**
 * Stage 3: Infer problem from observations
 */
export async function inferProblem(
  inputFormat: string,
  constraints: string,
  observations: Observation[]
): Promise<AnalysisResult> {
  const prompt = buildInferencePrompt(inputFormat, constraints, observations);
  
  logger.debug('Inferring problem with LLM');
  
  const result = await model.generateContent(prompt);
  const response = result.response.text();
  
  // Parse structured result
  const analysisResult = parseInferenceResponse(response, observations);
  
  return analysisResult;
}

function buildTestCaseGenerationPrompt(inputFormat: string, constraints: string): string {
  return `You are an expert competitive programmer designing test cases to analyze a black-box executable.

INPUT FORMAT:
${inputFormat}

CONSTRAINTS:
${constraints || 'Not specified'}

TASK: Generate 15-20 diverse test cases that will help reveal the algorithm's behavior.

Your test cases MUST cover:
1. MINIMAL CASES: Smallest valid inputs (n=1, single element, etc.)
2. BOUNDARY VALUES: Values at constraint limits
3. EDGE CASES: 
   - All zeros
   - All negative numbers
   - All same elements
   - Empty-like inputs (n=0 if valid)
4. SORTED PATTERNS:
   - Ascending order
   - Descending order
5. SPECIAL PATTERNS:
   - Alternating positive/negative
   - Arithmetic sequences
   - Powers of 2
6. RANDOM/CHAOTIC: Unstructured random values
7. LARGE VALUES: Test with maximum constraint values

OUTPUT FORMAT: Return ONLY a JSON array, no other text.
Each element must have:
- "input": The exact input string (with newlines as \\n)
- "rationale": Brief explanation of why this test case is useful

Example format:
[
  {"input": "1\\n42\\n", "rationale": "Minimal case - single element"},
  {"input": "5\\n1 2 3 4 5\\n", "rationale": "Small sorted ascending sequence"}
]

Generate the test cases now:`;
}

function buildInferencePrompt(
  inputFormat: string,
  constraints: string,
  observations: Observation[]
): string {
  const observationsStr = observations
    .slice(0, 25) // Limit to 25 observations to keep prompt manageable
    .map((obs, i) => `Test ${i + 1}:\n  Input: ${obs.input.trim()}\n  Output: ${obs.output}`)
    .join('\n\n');

  return `You are an expert competitive programmer analyzing a black-box program's behavior.

INPUT FORMAT:
${inputFormat}

CONSTRAINTS:
${constraints || 'Not specified'}

OBSERVED BEHAVIOR (Input → Output):
${observationsStr}

TASK: Analyze these input-output pairs and determine what competitive programming problem this program solves.

ANALYSIS STEPS:
1. PATTERN RECOGNITION:
   - What mathematical relationship exists between inputs and outputs?
   - Test hypotheses: sum? max? min? sort? search? DP?

2. HYPOTHESIS VALIDATION:
   - Check your hypothesis against ALL observations
   - Look for counterexamples
   - Consider edge cases

3. GENERATE OUTPUT in this exact format:

===PROBLEM_TITLE===
[Title of the problem]

===PROBLEM_STATEMENT===
[Full problem description in competitive programming style]
[Include Input Format, Output Format, Constraints]

===SAMPLE_EXPLANATION===
[Explain one sample test case step by step]

===ALGORITHM===
[Name of the algorithm/approach, e.g., "Prefix Sum", "Binary Search", "Greedy"]

===SOLUTION_CODE===
\`\`\`cpp
[Clean, well-commented C++ solution code]
\`\`\`

===COMPLEXITY===
Time: O(...)
Space: O(...)

Begin your analysis:`;
}

function parseTestCasesFromResponse(response: string): TestCase[] {
  try {
    // Find JSON array in response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Parsed response is not an array');
    }
    
    return parsed.map((item: any) => ({
      input: String(item.input || '').replace(/\\n/g, '\n'),
      rationale: String(item.rationale || 'Test case'),
    })).filter((tc: TestCase) => tc.input.trim().length > 0);
    
  } catch (error) {
    logger.error('Failed to parse test cases:', error);
    logger.debug('Raw response:', response);
    
    // Return default test cases as fallback
    return getDefaultTestCases();
  }
}

function parseInferenceResponse(response: string, observations: Observation[]): AnalysisResult {
  const sections: { [key: string]: string } = {};
  
  const patterns = [
    { key: 'title', regex: /===PROBLEM_TITLE===\s*([\s\S]*?)(?====|$)/ },
    { key: 'statement', regex: /===PROBLEM_STATEMENT===\s*([\s\S]*?)(?====|$)/ },
    { key: 'explanation', regex: /===SAMPLE_EXPLANATION===\s*([\s\S]*?)(?====|$)/ },
    { key: 'algorithm', regex: /===ALGORITHM===\s*([\s\S]*?)(?====|$)/ },
    { key: 'code', regex: /===SOLUTION_CODE===\s*([\s\S]*?)(?====|$)/ },
    { key: 'complexity', regex: /===COMPLEXITY===\s*([\s\S]*?)(?====|$)/ },
  ];
  
  for (const { key, regex } of patterns) {
    const match = response.match(regex);
    if (match) {
      sections[key] = match[1].trim();
    }
  }
  
  // Extract code from markdown code block
  let solutionCode = sections.code || '';
  const codeBlockMatch = solutionCode.match(/```(?:cpp|c\+\+)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    solutionCode = codeBlockMatch[1].trim();
  }
  
  // Build problem statement
  const problemStatement = `# ${sections.title || 'Unknown Problem'}

## Problem Statement
${sections.statement || 'Problem description not available.'}

## Sample Explanation
${sections.explanation || 'No explanation provided.'}

## Complexity Analysis
${sections.complexity || 'Not analyzed.'}`;

  return {
    problemStatement,
    solution: solutionCode || '// Solution code not generated',
    algorithm: sections.algorithm || 'Unknown',
    observations,
  };
}

function getDefaultTestCases(): TestCase[] {
  return [
    { input: '1\n42\n', rationale: 'Single element test' },
    { input: '5\n1 2 3 4 5\n', rationale: 'Small ascending sequence' },
    { input: '5\n5 4 3 2 1\n', rationale: 'Small descending sequence' },
    { input: '3\n0 0 0\n', rationale: 'All zeros' },
    { input: '4\n-1 -2 -3 -4\n', rationale: 'All negative' },
    { input: '6\n-2 -1 0 1 2 3\n', rationale: 'Mixed positive and negative' },
    { input: '4\n7 7 7 7\n', rationale: 'All same elements' },
    { input: '2\n1000000 -1000000\n', rationale: 'Large values' },
    { input: '10\n1 3 5 7 9 2 4 6 8 10\n', rationale: 'Mixed pattern' },
    { input: '3\n1 1 1\n', rationale: 'Repeated ones' },
  ];
}
```

---

## 7. Simple Pipeline Implementation

### 7.1 Configuration (`src/config/index.ts`)

```typescript
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20',
  },
  docker: {
    timeout: parseInt(process.env.DOCKER_TIMEOUT || '5000'),
    memoryLimit: process.env.DOCKER_MEMORY_LIMIT || '256MB',
    cpuQuota: parseInt(process.env.DOCKER_CPU_QUOTA || '50000'),
    sandboxImage: process.env.SANDBOX_IMAGE || 'sandbox:latest',
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
  security: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Validate required configuration
export function validateConfig(): void {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is required');
  }
}
```

### 7.2 Sanitizer Utility (`src/utils/sanitizer.ts`)

```typescript
/**
 * Sanitize and validate input before execution
 */
export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  let sanitized = input;
  
  // Block shell injection attempts
  const dangerousPatterns = [
    /\$\(/g,           // Command substitution
    /`/g,              // Backtick execution
    /\|\|/g,           // OR operator
    /&&/g,             // AND operator
    /;/g,              // Command separator
    />/g,              // Redirect
    /</g,              // Redirect (keep for stdin simulation)
    /\|(?!\s*$)/g,     // Pipe (but not at end)
  ];
  
  // For competitive programming input, we primarily expect:
  // - Numbers (integers, floats)
  // - Whitespace (spaces, newlines)
  // - Basic punctuation (minus sign for negative numbers)
  
  // Remove suspicious patterns but keep < for now as we control its usage
  sanitized = sanitized
    .replace(/\$\(/g, '')
    .replace(/`/g, '')
    .replace(/\|\|/g, '')
    .replace(/&&/g, '')
    .replace(/;(?!\s*\n)/g, ''); // Remove semicolons not followed by newline
  
  return sanitized;
}

/**
 * Validate input format description
 */
export function sanitizeFormatDescription(format: string): string {
  // Remove any HTML/script tags
  return format
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Check if input size is within limits
 */
export function validateInputSize(input: string, maxBytes: number = 10 * 1024 * 1024): boolean {
  return Buffer.byteLength(input, 'utf8') <= maxBytes;
}
```

---

## 8. Testing Phase 1

### 8.1 Manual Testing Checklist

#### Frontend Tests
- [ ] File upload accepts only `.exe` files
- [ ] File upload rejects files larger than 10MB
- [ ] Input format field is required
- [ ] Constraints field is optional
- [ ] Progress indicator shows correct stages
- [ ] Results display properly with tabs
- [ ] Copy functionality works
- [ ] Reset button clears all state

#### Backend Tests
- [ ] `/health` endpoint returns status
- [ ] `/api/analyze` accepts file uploads
- [ ] `/api/status/:jobId` returns job status
- [ ] Invalid file types are rejected
- [ ] Missing input format returns 400 error
- [ ] Job cleanup removes old jobs

#### Docker Tests
- [ ] Sandbox image builds successfully
- [ ] Container execution respects timeout
- [ ] Container has no network access
- [ ] Memory limits are enforced
- [ ] Container cleanup removes all traces

#### LLM Integration Tests
- [ ] Test case generation returns valid JSON
- [ ] At least 10 test cases are generated
- [ ] Problem inference returns structured response
- [ ] Fallback test cases work when LLM fails

### 8.2 Sample Test Executable

Create a simple test program to verify the pipeline:

**test_sum.cpp:**
```cpp
#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    
    long long sum = 0;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        sum += x;
    }
    
    cout << sum << endl;
    return 0;
}
```

Compile with:
```bash
# On Windows
g++ -o test_sum.exe test_sum.cpp

# Cross-compile on Linux/Mac with MinGW
x86_64-w64-mingw32-g++ -o test_sum.exe test_sum.cpp
```

### 8.3 Expected MVP Behavior

1. **Upload**: User uploads `test_sum.exe`
2. **Format**: "First line: integer n, Second line: n space-separated integers"
3. **Generation**: LLM generates ~15 test cases
4. **Execution**: Docker sandbox executes each test case
5. **Inference**: LLM analyzes patterns and identifies "Array Sum" problem
6. **Output**: Problem statement and C++ solution displayed

---

## Phase 1 Completion Checklist

- [ ] Project structure created
- [ ] Frontend with file upload working
- [ ] Backend server running
- [ ] Docker sandbox building and executing
- [ ] LLM integration generating test cases
- [ ] Basic pipeline completing end-to-end
- [ ] Simple problems (sum/max/min) correctly identified
- [ ] Error handling for common failures
- [ ] Logging implemented
- [ ] Basic input sanitization

---

**Next Phase**: Enhanced Inference (PHASE-2.md) - Advanced test case generation, multi-hypothesis validation, and improved pattern recognition.
