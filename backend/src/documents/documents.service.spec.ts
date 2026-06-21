import { Repository } from 'typeorm';
import { DocumentsService } from './documents.service';
import { Document } from '../database/entities/document.entity';
import { DocumentType } from '../database/entities/document-type.entity';

describe('DocumentsService progress tracking', () => {
  const createService = () => {
    const documentRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      delete: jest.fn(),
    } as unknown as Repository<Document>;

    const documentTypeRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<DocumentType>;

    const service = new DocumentsService(
      documentRepository,
      documentTypeRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return {
      service,
      documentRepository,
    };
  };

  it('returns processingStep for processing docs in batch status', async () => {
    const { service, documentRepository } = createService();
    const user = { id: 42 } as any;

    documentRepository.find = jest.fn().mockResolvedValue([
      {
        id: 1,
        filename: 'factura-1.pdf',
        status: 'processing',
        processingStep: 'analyzing_content',
        confidenceScore: null,
        documentType: null,
      },
      {
        id: 2,
        filename: 'factura-2.pdf',
        status: 'completed',
        processingStep: null,
        confidenceScore: 0.98,
        documentType: { name: 'Factura' },
      },
    ]);

    const result = await service.getBatchStatus([1, 2], user);

    expect(result.processing).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.allDone).toBe(false);
    expect(result.documents).toEqual([
      expect.objectContaining({
        id: 1,
        status: 'processing',
        processingStep: 'analyzing_content',
      }),
      expect.objectContaining({
        id: 2,
        status: 'completed',
        processingStep: null,
      }),
    ]);
  });
});
