import { MarkdownIndexService } from './markdown-index.service';
import { MarkdownNode } from './types';

describe('MarkdownIndexService', () => {
  const service = new MarkdownIndexService();

  it('ranks by textual match and expands one hop via links', () => {
    const nodes: MarkdownNode[] = [
      {
        key: '1/markdown/factura.md',
        slug: 'factura',
        documentId: 'DOC-1',
        tenant: '1',
        tipo: 'factura',
        fecha: '2026-05-01',
        summary: 'factura abril',
        frontmatter: {},
        links: ['cliente-acme'],
        text: 'factura abril cliente acme monto total 1000',
      },
      {
        key: '1/markdown/cliente-acme.md',
        slug: 'cliente-acme',
        documentId: 'DOC-2',
        tenant: '1',
        tipo: 'cliente',
        fecha: '2026-05-02',
        summary: 'ficha cliente',
        frontmatter: {},
        links: [],
        text: 'cliente acme rubro industrial',
      },
    ];

    const index = service.buildIndex(nodes);
    const result = service.retrieve(index, 'monto de factura de acme', 2);

    expect(result.map((r) => r.slug)).toEqual(
      expect.arrayContaining(['factura', 'cliente-acme']),
    );
  });
});
