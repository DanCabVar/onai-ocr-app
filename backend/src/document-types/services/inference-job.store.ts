/**
 * In-memory job store for tracking async inference jobs.
 * Jobs are cleaned up 1 hour after completion.
 */
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type JobStatus = 'processing' | 'completed' | 'failed';
export type JobStep = 'queued' | 'ocr' | 'classifying' | 'homologating' | 'consolidating' | 'extracting' | 'saving' | 'done';

export interface JobState {
  jobId: string;
  status: JobStatus;
  step: JobStep;
  progress: number; // 0-100
  message: string;
  results?: any;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

@Injectable()
export class InferenceJobStore {
  private readonly logger = new Logger(InferenceJobStore.name);
  private readonly jobs = new Map<string, JobState>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  createJob(): string {
    const jobId = randomUUID();
    this.jobs.set(jobId, {
      jobId,
      status: 'processing',
      step: 'queued',
      progress: 0,
      message: 'En cola...',
      createdAt: Date.now(),
    });
    this.logger.log(`Job created: ${jobId}`);
    return jobId;
  }

  getJob(jobId: string): JobState | undefined {
    return this.jobs.get(jobId);
  }

  updateProgress(jobId: string, step: JobStep, progress: number, message: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.step = step;
    job.progress = Math.min(100, Math.max(0, progress));
    job.message = message;
  }

  completeJob(jobId: string, results: any): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'completed';
    job.step = 'done';
    job.progress = 100;
    job.message = 'Completado';
    job.results = results;
    job.completedAt = Date.now();
    this.logger.log(`Job completed: ${jobId}`);
  }

  failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'failed';
    job.progress = 0;
    job.message = 'Error';
    job.error = error;
    job.completedAt = Date.now();
    this.logger.error(`Job failed: ${jobId} — ${error}`);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, job] of this.jobs) {
      if (job.completedAt && now - job.completedAt > JOB_TTL_MS) {
        this.jobs.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired job(s)`);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
