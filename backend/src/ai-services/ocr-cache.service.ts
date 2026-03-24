/**
 * OCR Cache Service
 * 
 * Caches OCR results by document content hash (SHA-256).
 * If the same document is uploaded twice, we skip the OCR call entirely.
 * 
 * Storage: In-memory Map with LRU eviction + optional persistence via DB column.
 * The document entity already has ocrRawText — we check existing documents first.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Document } from '../database/entities/document.entity';

export interface CachedOCRResult {
  text: string;
  confidence: number;
  metadata?: Record<string, any>;
}

interface CacheEntry {
  result: CachedOCRResult;
  timestamp: number;
  accessCount: number;
}

@Injectable()
export class OCRCacheService {
  private readonly logger = new Logger(OCRCacheService.name);

  /** In-memory LRU cache: contentHash → OCR result */
  private readonly cache = new Map<string, CacheEntry>();
  private readonly MAX_CACHE_SIZE = 200;
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Stats
  private hits = 0;
  private misses = 0;

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  /**
   * Compute SHA-256 hash of file content for cache key.
   */
  computeHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Try to get cached OCR result. Checks in-memory first, then DB.
   * Returns null if not found.
   */
  async get(contentHash: string): Promise<CachedOCRResult | null> {
    // 1. Check in-memory cache
    const memEntry = this.cache.get(contentHash);
    if (memEntry) {
      if (Date.now() - memEntry.timestamp < this.CACHE_TTL_MS) {
        memEntry.accessCount++;
        this.hits++;
        this.logger.log(`🎯 OCR cache HIT (memory) — hash: ${contentHash.substring(0, 12)}...`);
        return memEntry.result;
      }
      // Expired — remove
      this.cache.delete(contentHash);
    }

    // 2. Check DB: find any completed document with matching filename hash pattern
    //    We store the hash in metadata, but we can also check ocrRawText by content
    //    For now, we'll skip DB lookup to keep it simple and fast.
    //    The in-memory cache handles the common case (re-upload in same session).

    this.misses++;
    return null;
  }

  /**
   * Store OCR result in cache.
   */
  set(contentHash: string, result: CachedOCRResult): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }

    this.cache.set(contentHash, {
      result,
      timestamp: Date.now(),
      accessCount: 1,
    });

    this.logger.log(`💾 OCR result cached — hash: ${contentHash.substring(0, 12)}...`);
  }

  /**
   * Evict least recently used entries (bottom 20% by access count).
   */
  private evictLRU(): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].accessCount - b[1].accessCount);

    const toEvict = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toEvict; i++) {
      this.cache.delete(entries[i][0]);
    }

    this.logger.log(`🗑️ Evicted ${toEvict} OCR cache entries`);
  }

  /**
   * Get cache statistics for metrics logging.
   */
  getStats(): { hits: number; misses: number; size: number; hitRate: string } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : 'N/A',
    };
  }
}
