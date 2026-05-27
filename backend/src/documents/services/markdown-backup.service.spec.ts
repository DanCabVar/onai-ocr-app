import { MarkdownBackupService } from './markdown-backup.service';

describe('MarkdownBackupService', () => {
  const storageMock = {
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
  };

  const makeService = () => new MarkdownBackupService(storageMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MARKDOWN_BACKUP_ENABLED = 'true';
    process.env.MARKDOWN_BACKUP_PREFIX = 'markdown-backups';
    delete process.env.MARKDOWN_BACKUP_BUCKET;
  });

  it('renders frontmatter and graph sections', () => {
    const service = makeService();
    const markdown = service.renderMarkdown(
      {
        id: 42,
        filename: 'factura-abril.pdf',
        status: 'completed',
        storageKey: '7/tipos/facturas/factura-abril.pdf',
        createdAt: new Date('2026-05-27T10:00:00.000Z'),
        updatedAt: new Date('2026-05-27T10:05:00.000Z'),
        extractedData: {
          summary: 'Factura de compra',
          fields: [
            { name: 'proveedor', value: 'Acme Ltda' },
            { name: 'folio', value: 'F-991' },
          ],
        },
        inferredData: null,
      } as any,
      7,
      'Factura Compra',
    );

    expect(markdown).toContain('document_id: 42');
    expect(markdown).toContain('tenant: 7');
    expect(markdown).toContain('tipo: "Factura Compra"');
    expect(markdown).toContain('## Navegacion Grafo');
    expect(markdown).toContain('[[7/_index_tipo_factura-compra]]');
    expect(markdown).toContain('[[7/entity/acme-ltda]]');
  });

  it('writes current and history backups to storage', async () => {
    const service = makeService();
    storageMock.uploadFile.mockResolvedValue({ key: 'ok', bucket: 'b', size: 1 });
    storageMock.downloadFile.mockRejectedValue(new Error('not found'));

    await service.backupDocument({
      tenantId: 3,
      documentTypeName: 'Orden de Compra',
      document: {
        id: 99,
        filename: 'oc.pdf',
        status: 'completed',
        storageKey: '3/tipos/ordenes/oc.pdf',
        createdAt: new Date('2026-05-27T10:00:00.000Z'),
        updatedAt: new Date('2026-05-27T10:01:00.000Z'),
        extractedData: { fields: [] },
      } as any,
    });

    expect(storageMock.uploadFile).toHaveBeenCalledTimes(3);
    expect(storageMock.uploadFile.mock.calls[0][1]).toBe('markdown-backups/3/99/current.md');
    expect(storageMock.uploadFile.mock.calls[1][1]).toContain('markdown-backups/3/99/history/');
    expect(storageMock.uploadFile.mock.calls[2][1]).toBe('markdown-backups/3/_index_tipo_orden-de-compra.md');
  });

  it('does not duplicate doc link in type index', async () => {
    const service = makeService();
    storageMock.uploadFile.mockResolvedValue({ key: 'ok', bucket: 'b', size: 1 });
    storageMock.downloadFile.mockResolvedValue(
      Buffer.from('# Index tipo: Orden de Compra\n\n## Documentos\n- [[3/99/current]]\n', 'utf8'),
    );

    await service.backupDocument({
      tenantId: 3,
      documentTypeName: 'Orden de Compra',
      document: {
        id: 99,
        filename: 'oc.pdf',
        status: 'completed',
        storageKey: '3/tipos/ordenes/oc.pdf',
        createdAt: new Date('2026-05-27T10:00:00.000Z'),
        updatedAt: new Date('2026-05-27T10:01:00.000Z'),
        extractedData: { fields: [] },
      } as any,
    });

    const indexBuffer = storageMock.uploadFile.mock.calls[2][0] as Buffer;
    const indexContent = indexBuffer.toString('utf8');
    const occurrences = (indexContent.match(/\[\[3\/99\/current\]\]/g) || []).length;
    expect(occurrences).toBe(1);
  });
});
