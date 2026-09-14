import type { PipelineResult } from '../src-pipeline/index.js';

export type DashboardState =
  | { phase: 'idle' }
  | { phase: 'running'; currentStep: string }
  | { phase: 'done'; result: PipelineResult }
  | { phase: 'connection-error'; message: string };
