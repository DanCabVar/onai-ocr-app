import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { DocumentTypeInferenceService } from './document-type-inference.service';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}));

describe('DocumentTypeInferenceService tenant isolation', () => {
  const createService = () => {
    const documentTypeRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((payload) => ({ id: 123, ...payload })),
      save: jest.fn(async (entity) => entity),
    } as unknown as Repository<any>;

    const documentRepository = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<any>;

    const service = new DocumentTypeInferenceService(
      documentTypeRepository,
      documentRepository,
      { inferFieldsForUnclassified: jest.fn(), homologateTypes: jest.fn() } as any,
      { extractTextSmart: jest.fn() } as any,
      { computeHash: jest.fn(), get: jest.fn(), set: jest.fn() } as any,
      { acquire: jest.fn() } as any,
      {} as any,
      { buildKey: jest.fn(), uploadFile: jest.fn(), getPresignedUrl: jest.fn(), deleteFile: jest.fn() } as any,
      {
        get: jest.fn((key: string) => {
          if (key === 'GOOGLE_AI_API_KEY') return 'test-key';
          if (key === 'GEMINI_MODEL') return 'gemini-test';
          return undefined;
        }),
      } as unknown as ConfigService,
    );

    return {
      service,
      documentTypeRepository: documentTypeRepository as any,
      documentRepository: documentRepository as any,
    };
  };

  it('loads existing types scoped to the current user in inferDocumentTypesFromSamples', async () => {
    const { service, documentTypeRepository } = createService();
    const user = { id: 42 } as any;

    jest.spyOn(service as any, 'deduplicateFiles').mockReturnValue([]);
    jest.spyOn(service as any, 'step1_OCR').mockResolvedValue([]);
    jest.spyOn(service as any, 'step2_Classify').mockResolvedValue([]);
    jest.spyOn(service as any, 'step3_Homologate').mockResolvedValue([]);

    await service.inferDocumentTypesFromSamples([], user, false);

    expect(documentTypeRepository.find).toHaveBeenCalledWith({
      where: { userId: user.id },
    });
  });

  it('loads existing types scoped to the current user in classifyAndGroupDocuments', async () => {
    const { service, documentTypeRepository } = createService();
    const user = { id: 7 } as any;

    jest.spyOn(service as any, 'step1_OCR').mockResolvedValue([]);
    jest.spyOn(service as any, 'step2_Classify').mockResolvedValue([]);
    jest.spyOn(service as any, 'step3_Homologate').mockResolvedValue([]);

    await service.classifyAndGroupDocuments([], user);

    expect(documentTypeRepository.find).toHaveBeenCalledWith({
      where: { userId: user.id },
    });
  });

  it('checks existing types by name and user when creating inferred types', async () => {
    const { service, documentTypeRepository } = createService();
    const user = { id: 99 } as any;

    await service.createDocumentTypesFromInference(
      [
        {
          typeName: 'Orden de Compra',
          description: 'OC',
          consolidatedFields: [],
          sampleDocuments: [],
          sampleCount: 0,
        },
      ] as any,
      user,
      false,
    );

    expect(documentTypeRepository.findOne).toHaveBeenCalledWith({
      where: { name: 'Orden de Compra', userId: user.id },
    });
  });
});
