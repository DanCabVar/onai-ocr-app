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

  it('boosts nodes matching tipo and fecha hints', () => {
    const nodes: MarkdownNode[] = [
      {
        key: '1/markdown/factura-mayo.md',
        slug: 'factura-mayo',
        documentId: 'DOC-10',
        tenant: '1',
        tipo: 'factura',
        fecha: '2026-05-11',
        summary: 'factura mayo',
        frontmatter: {},
        links: [],
        text: 'resumen de factura del mes de mayo',
      },
      {
        key: '1/markdown/boleta-mayo.md',
        slug: 'boleta-mayo',
        documentId: 'DOC-11',
        tenant: '1',
        tipo: 'boleta',
        fecha: '2026-05-12',
        summary: 'boleta mayo',
        frontmatter: {},
        links: [],
        text: 'resumen de documento de mayo',
      },
    ];

    const index = service.buildIndex(nodes);
    const result = service.retrieve(index, 'facturas de mayo 2026', 1);

    expect(result[0].slug).toBe('factura-mayo');
  });
});
