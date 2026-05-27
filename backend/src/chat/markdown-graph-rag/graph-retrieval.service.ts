import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { promises as fs } from 'fs';
import { join } from 'path';
import { StorageService } from '../../storage/storage.service';
import { MarkdownIngestService } from './markdown-ingest.service';
import { MarkdownIndexService } from './markdown-index.service';
import { HybridRetrievalResult, MarkdownNode, RetrievalSource } from './types';

@Injectable()
export class GraphRetrievalService {
  private readonly logger = new Logger(GraphRetrievalService.name);
  private readonly model: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly ingestService: MarkdownIngestService,
    private readonly indexService: MarkdownIndexService,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (apiKey) {
      const modelName =
        this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
      this.model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: modelName,
      });
    }
  }

  async retrieveAndAnswer(
    question: string,
    tenantId: number,
  ): Promise<HybridRetrievalResult | null> {
    const nodes = await this.loadTenantMarkdown(tenantId);
    if (nodes.length === 0) return null;

    const index = this.indexService.buildIndex(nodes);
    const hits = this.indexService.retrieve(index, question, 4);
    if (hits.length === 0) return null;

    const sources: RetrievalSource[] = hits.map((node, i) => ({
      key: node.key,
      documentId: node.documentId,
      tenant: node.tenant,
      score: Math.max(1, hits.length - i),
    }));

    const answer = await this.composeAnswer(question, hits, sources);
    return { answer, sources };
  }

  private async loadTenantMarkdown(tenantId: number): Promise<MarkdownNode[]> {
    const localDir = this.configService.get<string>('MARKDOWN_RAG_LOCAL_DIR');
    if (localDir) {
      return this.loadFromLocalDir(localDir, tenantId);
    }

    if (!this.storageService.isConfigured()) {
      return [];
    }

    const prefixTemplate =
      this.configService.get<string>('MARKDOWN_RAG_PREFIX_TEMPLATE') ||
      '{userId}/markdown/';
    const prefix = prefixTemplate.replace('{userId}', String(tenantId));

    try {
      const objects = await this.storageService.listByPrefix(prefix);
      const markdownFiles = objects.filter((o) => o.key.toLowerCase().endsWith('.md'));
      const nodes: MarkdownNode[] = [];

      for (const file of markdownFiles) {
        const buffer = await this.storageService.downloadFile(file.key);
        nodes.push(this.ingestService.parseMarkdown(file.key, buffer.toString('utf-8')));
      }

      return nodes.filter((n) => !n.tenant || n.tenant === String(tenantId));
    } catch (error) {
      this.logger.warn(`Markdown retrieval unavailable: ${error.message}`);
      return [];
    }
  }

  private async loadFromLocalDir(baseDir: string, tenantId: number): Promise<MarkdownNode[]> {
    const tenantPath = join(baseDir, String(tenantId));

    try {
      const files = await this.collectMarkdownFiles(tenantPath);
      const nodes: MarkdownNode[] = [];

      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf-8');
        nodes.push(this.ingestService.parseMarkdown(filePath, content));
      }

      return nodes.filter((n) => !n.tenant || n.tenant === String(tenantId));
    } catch {
      return [];
    }
  }

  private async collectMarkdownFiles(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.collectMarkdownFiles(fullPath)));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async composeAnswer(
    question: string,
    hits: MarkdownNode[],
    sources: RetrievalSource[],
  ): Promise<string> {
    const citations = sources
      .slice(0, 4)
      .map((s, i) => `${i + 1}. ${s.documentId || 'sin_document_id'} (${s.key})`)
      .join('\n');

    const context = hits
      .slice(0, 4)
      .map((n, i) => {
        const snippet = n.text.slice(0, 700);
        return `Fuente ${i + 1}:\n- key: ${n.key}\n- document_id: ${n.documentId || 'N/A'}\n- tipo: ${n.tipo || 'N/A'}\n- texto:\n${snippet}`;
      })
      .join('\n\n');

    if (!this.model) {
      return `Encontré contexto en respaldos Markdown para tu pregunta.\n\nFuentes:\n${citations}`;
    }

    try {
      const prompt = `Responde en español usando SOLO el contexto proporcionado.\nPregunta: "${question}"\n\nContexto:\n${context}\n\nIncluye al final una sección corta "Fuentes:" con document_id o key.`;
      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
    } catch {
      return `Encontré contexto en respaldos Markdown para tu pregunta.\n\nFuentes:\n${citations}`;
    }
  }
}
