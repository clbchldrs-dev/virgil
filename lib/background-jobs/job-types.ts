export interface JobHandlerResult {
  success: boolean;
  data?: Record<string, unknown>;
  proposalCount?: number;
  error?: string;
}
