import { ChatService } from './chat.service';

describe('ChatService conversation context', () => {
  const createService = () => {
    const sqlRagService = {
      query: jest.fn().mockResolvedValue({ answer: 'ok' }),
    } as any;

    const graphRagService = {
      isEnabled: jest.fn().mockReturnValue(false),
      shouldUseGraph: jest.fn().mockReturnValue(false),
      answerRelationalQuestion: jest.fn(),
    } as any;

    const service = new ChatService(sqlRagService, graphRagService);
    return { service, sqlRagService };
  };

  it('passes recent conversation context to sql rag queries', async () => {
    const { service, sqlRagService } = createService();

    await service.getQueryResponse(
      {
        query: 'el nombre del comprador es Yolito Balart Hnos. Ltda.',
        history: [
          { role: 'user', content: 'puedes darme las fechas de emisión de los documentos de Yolito' },
          {
            role: 'assistant',
            content:
              'Para poder darte las fechas de emisión, necesito saber a qué te refieres con Yolito.',
          },
        ],
      } as any,
      { id: 7 } as any,
    );

    expect(sqlRagService.query).toHaveBeenCalledWith(
      expect.stringContaining('Contexto reciente de la conversación:'),
      7,
    );
    expect(sqlRagService.query).toHaveBeenCalledWith(
      expect.stringContaining('Pregunta actual del usuario: el nombre del comprador es Yolito Balart Hnos. Ltda.'),
      7,
    );
  });
});
