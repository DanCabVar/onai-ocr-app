import { Injectable, Logger } from '@nestjs/common';
import { Document } from '../../database/entities/document.entity';
import { StorageService } from '../../storage/storage.service';

type ExtractedField = {
  name?: string;
  label?: string;
  value?: unknown;
};

@Injectable()
export class MarkdownBackupService {
  private readonly logger = new Logger(MarkdownBackupService.name);

  constructor(private readonly storageService: StorageService) {}

  async backupDocument(params: {
    document: Document;
    tenantId: number;
    documentTypeName?: string | null;
  }): Promise<void> {
    if (!this.isEnabled()) return;

    const { document, tenantId, documentTypeName } = params;
    const prefix = process.env.MARKDOWN_BACKUP_PREFIX || 'markdown-backups';
    const backupBucket = process.env.MARKDOWN_BACKUP_BUCKET || undefined;
    const folder = `${prefix}/${tenantId}/${document.id}`;
    const currentKey = `${folder}/current.md`;
    const historyKey = `${folder}/history/${this.toSafeTimestamp(new Date())}.md`;
    const markdown = this.renderMarkdown(document, tenantId, documentTypeName);

    try {
      await this.storageService.uploadFile(
        Buffer.from(markdown, 'utf8'),
        currentKey,
        'text/markdown; charset=utf-8',
        backupBucket,
      );

      await this.storageService.uploadFile(
        Buffer.from(markdown, 'utf8'),
        historyKey,
        'text/markdown; charset=utf-8',
        backupBucket,
      );

      await this.updateTypeIndex({
        tenantId,
        documentId: document.id,
        typeName: docTypeForIndex(documentTypeName),
        prefix,
        backupBucket,
      });
    } catch (error: any) {
      this.logger.error(
        `Markdown backup failed: doc=${document.id} tenant=${tenantId} key=${currentKey} error=${error?.message || 'unknown'}`,
      );
      throw error;
    }
  }

  renderMarkdown(document: Document, tenantId: number, documentTypeName?: string | null): string {
    const docType = documentTypeName || 'Sin tipo';
    const createdAt = document.createdAt ? document.createdAt.toISOString() : new Date().toISOString();
    const updatedAt = document.updatedAt ? document.updatedAt.toISOString() : createdAt;
    const fields = this.extractFields(document.extractedData);
    const keyEntities = fields.filter((f) => this.hasValue(f.value)).slice(0, 10);
    const typeSlug = this.slugify(docType);
    const indexLink = `[[${tenantId}/_index_tipo_${typeSlug}]]`;
    const relatedLinks = this.buildRelatedLinks(tenantId, keyEntities);

    const lines: string[] = [
      '---',
      `document_id: ${document.id}`,
      `tenant: ${tenantId}`,
      `tipo: "${this.escapeYaml(docType)}"`,
      `fecha: "${createdAt}"`,
      `filename: "${this.escapeYaml(document.filename || '')}"`,
      `status: "${this.escapeYaml(document.status || 'unknown')}"`,
      `updated_at: "${updatedAt}"`,
      `source_r2_key: "${this.escapeYaml(document.storageKey || '')}"`,
      `tags: [tenant-${tenantId}, tipo-${typeSlug}]`,
      '---',
      '',
      `# Documento ${document.id} - ${document.filename || 'sin-nombre'}`,
      '',
      '## Resumen',
      this.extractSummary(document.extractedData, document.inferredData),
      '',
      '## Navegacion Grafo',
      `- Indice tipo: ${indexLink}`,
      ...relatedLinks.map((l) => `- ${l}`),
      '',
      '## Campos Extraidos',
      ...this.renderFields(fields),
      '',
      '## OCR',
      this.safeText(document.ocrRawText || 'Sin OCR disponible'),
      '',
      '## Referencias',
      `- Storage key fuente: \`${document.storageKey || 'N/A'}\``,
    ];

    return `${lines.join('\n')}\n`;
  }

  private isEnabled(): boolean {
    const value = (process.env.MARKDOWN_BACKUP_ENABLED || 'true').toLowerCase();
    return value !== 'false' && value !== '0' && value !== 'no';
  }

  private extractSummary(extractedData: any, inferredData: any): string {
    const summary =
      extractedData?.summary ||
      inferredData?.summary ||
      (typeof extractedData === 'string' ? extractedData : null) ||
      'Sin resumen disponible.';
    return this.safeText(summary);
  }

  private extractFields(extractedData: any): ExtractedField[] {
    if (Array.isArray(extractedData?.fields)) return extractedData.fields;
    if (Array.isArray(extractedData?.key_fields)) return extractedData.key_fields;
    return [];
  }

  private renderFields(fields: ExtractedField[]): string[] {
    if (fields.length === 0) return ['- Sin campos extraidos'];
    return fields.map((f) => {
      const name = f.label || f.name || 'campo';
      const value = this.hasValue(f.value) ? this.safeText(String(f.value)) : 'N/A';
      return `- **${name}**: ${value}`;
    });
  }

  private buildRelatedLinks(tenantId: number, fields: ExtractedField[]): string[] {
    const links: string[] = [];
    const important = ['rut', 'cliente', 'proveedor', 'factura', 'orden', 'folio'];
    for (const field of fields) {
      const source = `${field.name || field.label || ''}`.toLowerCase();
      if (!important.some((token) => source.includes(token))) continue;
      if (!this.hasValue(field.value)) continue;
      const valueSlug = this.slugify(String(field.value));
      if (!valueSlug) continue;
      links.push(`[[${tenantId}/entity/${valueSlug}]]`);
    }
    return Array.from(new Set(links)).slice(0, 8);
  }

  private safeText(text: string): string {
    return `${text}`.replace(/\r\n/g, '\n').trim();
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private toSafeTimestamp(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-');
  }

  private escapeYaml(value: string): string {
    return `${value}`.replace(/"/g, '\\"');
  }

  hasValue(value: unknown): boolean {
    return value !== null && value !== undefined && `${value}`.trim() !== '';
  }

  private async updateTypeIndex(params: {
    tenantId: number;
    documentId: number;
    typeName: string;
    prefix: string;
    backupBucket?: string;
  }): Promise<void> {
    const { tenantId, documentId, typeName, prefix, backupBucket } = params;
    const typeSlug = this.slugify(typeName || 'sin-tipo');
    const indexKey = `${prefix}/${tenantId}/_index_tipo_${typeSlug}.md`;
    const docLink = `[[${tenantId}/${documentId}/current]]`;

    let existing = '';
    try {
      const raw = await this.storageService.downloadFile(indexKey);
      existing = raw.toString('utf8');
    } catch {
      existing = `# Index tipo: ${typeName}\n\n## Documentos\n`;
    }

    const hasLink = existing.includes(docLink);
    const content = hasLink ? existing : `${existing.trimEnd()}\n- ${docLink}\n`;

    await this.storageService.uploadFile(
      Buffer.from(content, 'utf8'),
      indexKey,
      'text/markdown; charset=utf-8',
      backupBucket,
    );
  }
}

function docTypeForIndex(documentTypeName?: string | null): string {
  const value = (documentTypeName || '').trim();
  return value || 'Sin tipo';
}
