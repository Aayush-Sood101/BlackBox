import { AnalysisResponse, HealthResponse } from '../types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Check API health
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/api/health`);
  if (!response.ok) {
    throw new Error('Failed to check API health');
  }
  return response.json();
}

/**
 * Analyze an executable file
 */
export async function analyzeExecutable(
  file: File,
  inputFormat: string,
  constraints: string,
  useMock: boolean = false
): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('executable', file);
  formData.append('inputFormat', inputFormat);
  formData.append('constraints', constraints);
  formData.append('useMock', useMock.toString());

  const response = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Analysis failed');
  }

  return data;
}

/**
 * Run demo analysis without actual file
 */
export async function runDemo(
  inputFormat: string,
  constraints: string
): Promise<AnalysisResponse> {
  const response = await fetch(`${API_URL}/api/demo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputFormat,
      constraints,
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Demo failed');
  }

  return data;
}
