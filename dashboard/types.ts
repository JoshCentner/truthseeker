import type { PipelineResult } from '../src-pipeline/index.js';

export interface RunRequest {
  claim: string;
  apiKey: string;
  requester?: string;
}

export type ServerEvent = { type: 'progress'; step: string } | { type: 'result'; result: PipelineResult };
