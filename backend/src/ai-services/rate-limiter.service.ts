/**
 * AI Rate Limiter Service
 * 
 * Token-bucket rate limiter for Mistral and Gemini API calls.
 * Prevents 429 errors by enforcing per-provider RPM limits
 * with a minimum delay between consecutive calls.
 * 
 * Each provider gets its own independent limiter.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ProviderLimiter {
  name: string;
  rpmLimit: number;
  minDelayMs: number;
  callTimestamps: number[];
  lastCallTime: number;
  lock: Promise<void>;
  lockResolve: (() => void) | null;
}

@Injectable()
export class AIRateLimiterService {
  private readonly logger = new Logger(AIRateLimiterService.name);
  private readonly limiters = new Map<string, ProviderLimiter>();

  // Stats
  private totalWaitMs = 0;
  private totalAcquires = 0;

  constructor(private readonly configService: ConfigService) {
    // Mistral: free tier ~2 RPM for OCR, paid ~60 RPM
    this.registerProvider('mistral', {
      rpmLimit: this.configService.get<number>('MISTRAL_RPM_LIMIT') || 10,
      minDelayMs: this.configService.get<number>('MISTRAL_MIN_DELAY_MS') || 3000,
    });

    // Gemini: free tier ~10 RPM, paid ~60 RPM
    this.registerProvider('gemini', {
      rpmLimit: this.configService.get<number>('GEMINI_RPM_LIMIT') || 10,
      minDelayMs: this.configService.get<number>('GEMINI_MIN_DELAY_MS') || 4000,
    });
  }

  private registerProvider(
    name: string,
    config: { rpmLimit: number; minDelayMs: number },
  ): void {
    this.limiters.set(name, {
      name,
      rpmLimit: config.rpmLimit,
      minDelayMs: config.minDelayMs,
      callTimestamps: [],
      lastCallTime: 0,
      lock: Promise.resolve(),
      lockResolve: null,
    });

    this.logger.log(
      `Rate limiter registered: ${name} — ${config.rpmLimit} RPM, ${config.minDelayMs}ms min delay`,
    );
  }

  /**
   * Acquire permission to make an API call. Blocks if rate limit would be exceeded.
   * Must be called before each AI API call.
   */
  async acquire(provider: 'mistral' | 'gemini'): Promise<void> {
    const limiter = this.limiters.get(provider);
    if (!limiter) {
      this.logger.warn(`No limiter for provider: ${provider}`);
      return;
    }

    // Serialize access per provider
    const previousLock = limiter.lock;
    let resolve: () => void;
    limiter.lock = new Promise<void>((r) => (resolve = r));

    await previousLock;

    try {
      const now = Date.now();
      const startWait = now;

      // Clean timestamps older than 60s
      limiter.callTimestamps = limiter.callTimestamps.filter(
        (t) => now - t < 60_000,
      );

      // If RPM limit reached, wait for oldest call to expire
      if (limiter.callTimestamps.length >= limiter.rpmLimit) {
        const oldest = limiter.callTimestamps[0];
        const waitMs = 60_000 - (now - oldest) + 1000; // +1s safety
        if (waitMs > 0) {
          this.logger.warn(
            `⏳ ${provider} RPM limit reached (${limiter.rpmLimit}), waiting ${(waitMs / 1000).toFixed(1)}s`,
          );
          await this.sleep(waitMs);
        }
      }

      // Enforce minimum delay between consecutive calls
      const elapsed = Date.now() - limiter.lastCallTime;
      if (elapsed < limiter.minDelayMs) {
        const waitMs = limiter.minDelayMs - elapsed;
        this.logger.debug(`⏳ ${provider} min delay: waiting ${waitMs}ms`);
        await this.sleep(waitMs);
      }

      // Record this call
      limiter.lastCallTime = Date.now();
      limiter.callTimestamps.push(limiter.lastCallTime);

      // Track stats
      const totalWait = Date.now() - startWait;
      this.totalWaitMs += totalWait;
      this.totalAcquires++;
    } finally {
      resolve!();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Get rate limiter statistics.
   */
  getStats(): { totalAcquires: number; totalWaitMs: number; avgWaitMs: string } {
    return {
      totalAcquires: this.totalAcquires,
      totalWaitMs: this.totalWaitMs,
      avgWaitMs:
        this.totalAcquires > 0
          ? `${(this.totalWaitMs / this.totalAcquires).toFixed(0)}ms`
          : 'N/A',
    };
  }
}
