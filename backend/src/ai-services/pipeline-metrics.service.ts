/**
 * Pipeline Metrics Service
 * 
 * Tracks timing, token usage, and estimated costs per processing stage.
 * Each document processing run gets a unique metrics context.
 * 
 * Cost estimates (approximate, as of 2025):
 *   - Mistral OCR: ~$0.001/page
 *   - Gemini 2.5 Flash: ~$0.075/1M input tokens, ~$0.30/1M output tokens
 *   - Pixtral Vision: ~$0.002/image
 */
import { Injectable, Logger } from '@nestjs/common';

export interface StageMetric {
  stage: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  inputTokensEstimate?: number;
  outputTokensEstimate?: number;
  costEstimateUsd?: number;
  metadata?: Record<string, any>;
}

export interface PipelineMetrics {
  documentId?: number;
  filename: string;
  startTime: number;
  endTime?: number;
  totalDurationMs?: number;
  totalCostEstimateUsd?: number;
  stages: StageMetric[];
  cacheHit: boolean;
}

// Rough token estimation: ~4 chars per token for mixed content
const CHARS_PER_TOKEN = 4;

// Cost per 1M tokens (USD) — Gemini 2.5 Flash
const GEMINI_INPUT_COST_PER_M = 0.075;
const GEMINI_OUTPUT_COST_PER_M = 0.30;

// Mistral OCR cost per page (approximate)
const MISTRAL_OCR_COST_PER_PAGE = 0.001;

// Pixtral Vision cost per image
const PIXTRAL_COST_PER_IMAGE = 0.002;

@Injectable()
export class PipelineMetricsService {
  private readonly logger = new Logger(PipelineMetricsService.name);

  /**
   * Create a new metrics context for a document processing run.
   */
  createContext(filename: string): PipelineMetrics {
    return {
      filename,
      startTime: Date.now(),
      stages: [],
      cacheHit: false,
    };
  }

  /**
   * Start tracking a stage.
   */
  startStage(ctx: PipelineMetrics, stage: string): StageMetric {
    const metric: StageMetric = {
      stage,
      startTime: Date.now(),
    };
    ctx.stages.push(metric);
    return metric;
  }

  /**
   * End a stage and compute duration + cost estimates.
   */
  endStage(
    metric: StageMetric,
    opts?: {
      inputChars?: number;
      outputChars?: number;
      pages?: number;
      isVision?: boolean;
      provider?: 'gemini' | 'mistral' | 'pixtral';
    },
  ): void {
    metric.endTime = Date.now();
    metric.durationMs = metric.endTime - metric.startTime;

    if (opts) {
      const inputTokens = opts.inputChars
        ? Math.ceil(opts.inputChars / CHARS_PER_TOKEN)
        : 0;
      const outputTokens = opts.outputChars
        ? Math.ceil(opts.outputChars / CHARS_PER_TOKEN)
        : 0;

      metric.inputTokensEstimate = inputTokens;
      metric.outputTokensEstimate = outputTokens;

      // Cost estimation
      if (opts.provider === 'mistral' && opts.pages) {
        metric.costEstimateUsd = opts.pages * MISTRAL_OCR_COST_PER_PAGE;
      } else if (opts.provider === 'pixtral' || opts.isVision) {
        metric.costEstimateUsd = PIXTRAL_COST_PER_IMAGE;
      } else {
        // Gemini
        metric.costEstimateUsd =
          (inputTokens / 1_000_000) * GEMINI_INPUT_COST_PER_M +
          (outputTokens / 1_000_000) * GEMINI_OUTPUT_COST_PER_M;
      }

      metric.metadata = {
        inputTokens,
        outputTokens,
        ...(opts.pages && { pages: opts.pages }),
        ...(opts.isVision && { method: 'vision' }),
      };
    }
  }

  /**
   * Finalize the metrics context and log a summary.
   */
  finalize(ctx: PipelineMetrics, documentId?: number): void {
    ctx.endTime = Date.now();
    ctx.totalDurationMs = ctx.endTime - ctx.startTime;
    ctx.documentId = documentId;

    ctx.totalCostEstimateUsd = ctx.stages.reduce(
      (sum, s) => sum + (s.costEstimateUsd || 0),
      0,
    );

    // Log summary
    const stagesLog = ctx.stages
      .map(
        (s) =>
          `  ${s.stage}: ${s.durationMs}ms` +
          (s.costEstimateUsd ? ` (~$${s.costEstimateUsd.toFixed(4)})` : '') +
          (s.inputTokensEstimate ? ` [~${s.inputTokensEstimate} in / ~${s.outputTokensEstimate} out tokens]` : ''),
      )
      .join('\n');

    this.logger.log(
      `\n📊 Pipeline Metrics — "${ctx.filename}"${ctx.cacheHit ? ' (OCR CACHE HIT)' : ''}\n` +
      `  Total: ${ctx.totalDurationMs}ms (~$${ctx.totalCostEstimateUsd.toFixed(4)} est.)\n` +
      stagesLog,
    );
  }
}
