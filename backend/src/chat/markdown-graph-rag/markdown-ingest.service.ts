import { Injectable } from '@nestjs/common';
import { MarkdownNode } from './types';

@Injectable()
export class MarkdownIngestService {
  parseMarkdown(key: string, content: string): MarkdownNode {
    const { frontmatter, body } = this.extractFrontmatter(content);
    const links = this.extractWikilinks(body);
    const normalizedBody = body.replace(/\r\n/g, '\n').trim();

    return {
      key,
      slug: this.slugFromKey(key),
      documentId: frontmatter.document_id,
      tenant: frontmatter.tenant,
      tipo: frontmatter.tipo,
      fecha: frontmatter.fecha,
      summary: frontmatter.summary,
      frontmatter,
      links,
      text: [
        frontmatter.document_id,
        frontmatter.tipo,
        frontmatter.fecha,
        frontmatter.summary,
        normalizedBody,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  private extractFrontmatter(content: string): {
    frontmatter: Record<string, string>;
    body: string;
  } {
    const trimmed = content.replace(/^\uFEFF/, '');
    if (!trimmed.startsWith('---\n')) {
      return { frontmatter: {}, body: trimmed };
    }

    const endMarkerIndex = trimmed.indexOf('\n---\n', 4);
    if (endMarkerIndex < 0) {
      return { frontmatter: {}, body: trimmed };
    }

    const fmRaw = trimmed.slice(4, endMarkerIndex).trim();
    const body = trimmed.slice(endMarkerIndex + 5);

    const frontmatter: Record<string, string> = {};
    for (const line of fmRaw.split('\n')) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
      if (key) frontmatter[key] = value;
    }

    return { frontmatter, body };
  }

  private extractWikilinks(text: string): string[] {
    const matches = [...text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)];
    return [...new Set(matches.map((m) => this.normalizeLinkTarget(m[1])))];
  }

  private normalizeLinkTarget(link: string): string {
    return link
      .trim()
      .toLowerCase()
      .replace(/\.md$/i, '')
      .replace(/[^a-z0-9_-]+/g, '-');
  }

  private slugFromKey(key: string): string {
    const filename = key.split('/').pop() || key;
    return this.normalizeLinkTarget(filename);
  }
}
