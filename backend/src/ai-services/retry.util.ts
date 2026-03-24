/**
 * Retry Utility with Exponential Backoff
 * 
 * Handles transient failures from AI APIs (429, 500, 503, network errors).
 * Implements exponential backoff with jitter to avoid thundering herd.
 */
import { Logger } from '@nestjs/common';

const logger = new Logger('RetryUtil');

export interface RetryOptions {
  /** Max number of retries (default: 3) */
  maxRetries?: number;
  /** Base delay in ms (default: 2000) */
  baseDelayMs?: number;
  /** Max delay in ms (default: 60000) */
  maxDelayMs?: number;
  /** Context label for logging */
  label?: string;
}

/**
 * Check if an error is retryable (rate limit, server error, network).
 */
function isRetryable(error: any): boolean {
  // HTTP status codes
  const status = error?.status || error?.statusCode || error?.response?.status;
  if (status === 429 || status === 500 || status === 502 || status === 503) {
    return true;
  }

  // Network errors
  const msg = (error?.message || '').toLowerCase();
  if (
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('resource exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota')
  ) {
    return true;
  }

  return false;
}

/**
 * Execute a function with retry logic and exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelayMs ?? 2000;
  const maxDelay = options?.maxDelayMs ?? 60_000;
  const label = options?.label ?? 'operation';

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !isRetryable(error)) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay,
      );

      // Check for Retry-After header
      const retryAfter = error?.response?.headers?.['retry-after'];
      const actualDelay = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;

      logger.warn(
        `⚠️ ${label} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. ` +
        `Retrying in ${(actualDelay / 1000).toFixed(1)}s...`,
      );

      await new Promise((resolve) => setTimeout(resolve, actualDelay));
    }
  }

  throw lastError;
}
