import { MarkdownIngestService } from './markdown-ingest.service';

describe('MarkdownIngestService', () => {
  const service = new MarkdownIngestService();

  it('parses frontmatter and wikilinks', () => {
    const content = `---
document_id: DOC-123
tenant: 5
tipo: factura
fecha: 2026-05-01
summary: Resumen de factura
---
# Factura
Relacionada con [[Cliente-A]] y [[Orden-99|Orden]]`;

    const parsed = service.parseMarkdown('5/markdown/factura-1.md', content);

    expect(parsed.documentId).toBe('DOC-123');
    expect(parsed.tenant).toBe('5');
    expect(parsed.tipo).toBe('factura');
    expect(parsed.links).toEqual(expect.arrayContaining(['cliente-a', 'orden-99']));
    expect(parsed.slug).toBe('factura-1');
  });
});
