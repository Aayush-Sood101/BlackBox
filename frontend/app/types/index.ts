export interface TestCase {
  input: string;
  rationale: string;
}

export interface Observation {
  input: string;
  output: string;
}

export interface SampleTestCase {
  input: string;
  output: string;
  explanation: string;
}

export interface InferenceResult {
  problemTitle: string;
  problemStatement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleTestCases: SampleTestCase[];
  solutionCode: string;
  algorithmExplanation: string;
  timeComplexity: string;
  spaceComplexity: string;
  confidence: number;
}

export interface ExecutionStats {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  averageExecutionTime: number;
}

export interface AnalysisResponse {
  success: boolean;
  jobId?: string;
  inference?: InferenceResult;
  observations?: Observation[];
  stats?: ExecutionStats;
  error?: string;
}

export interface AnalysisProgress {
  stage: 'generating' | 'executing' | 'inferring' | 'complete' | 'error';
  progress: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  docker: {
    healthy: boolean;
    version?: string;
    error?: string;
  };
  config: {
    maxFileSize: number;
    dockerTimeout: number;
  };
}
