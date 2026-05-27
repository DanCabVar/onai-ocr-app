import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { GraphRetrievalService } from './graph-retrieval.service';
import { MarkdownIngestService } from './markdown-ingest.service';
import { MarkdownIndexService } from './markdown-index.service';

describe('GraphRetrievalService', () => {
  it('returns answer and source traces from tenant markdown backups', async () => {
    const base = await mkdtemp(join(tmpdir(), 'markdown-rag-'));
    const tenantDir = join(base, '7');
    await mkdir(tenantDir, { recursive: true });

    await writeFile(
      join(tenantDir, 'doc-1.md'),
      `---\ndocument_id: DOC-777\ntenant: 7\ntipo: factura\nfecha: 2026-05-10\n---\nFactura de ACME por 15000.`,
      'utf8',
    );

    const configService = {
      get: (key: string) => {
        if (key === 'MARKDOWN_RAG_LOCAL_DIR') return base;
        return undefined;
      },
    } as unknown as ConfigService;

    const storageService = {
      isConfigured: () => false,
    } as any;

    const service = new GraphRetrievalService(
      configService,
      storageService,
      new MarkdownIngestService(),
      new MarkdownIndexService(),
    );

    const result = await service.retrieveAndAnswer('factura acme', 7);

    expect(result).not.toBeNull();
    expect(result?.sources.length).toBeGreaterThan(0);
    expect(result?.sources[0].documentId).toBe('DOC-777');
    expect(result?.answer).toContain('Fuentes');

    await rm(base, { recursive: true, force: true });
  });
});
