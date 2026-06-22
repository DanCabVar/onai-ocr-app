import { QueryIntentService } from './query-intent.service';

describe('QueryIntentService', () => {
  const service = new QueryIntentService();

  describe('classifyIntent — precedencia de intenciones', () => {
    it('resuelve total antes que orden de compra', () => {
      expect(
        service.classifyIntent('¿Cuál es el total de la orden de compra de Yolito2?'),
      ).toBe('list_totals');
    });

    it('prioriza proveedor sobre la rama amplia de orden de compra', () => {
      expect(
        service.classifyIntent('¿Qué proveedores aparecen en mis órdenes de compra?'),
      ).toBe('list_supplier_names');
    });

    it('reconoce número de orden de compra explícito', () => {
      expect(
        service.classifyIntent('¿y cuáles son sus números de orden de compra?'),
      ).toBe('list_order_numbers');
    });

    it('reconoce "órdenes de compra" como número de orden', () => {
      expect(
        service.classifyIntent('¿Qué órdenes de compra tengo de Sodimac?'),
      ).toBe('list_order_numbers');
    });

    it('reconoce conteo, tipos, fecha y cliente', () => {
      expect(service.classifyIntent('¿Cuántos documentos tengo?')).toBe(
        'count_documents',
      );
      expect(service.classifyIntent('¿Qué tipos de documentos tengo?')).toBe(
        'list_document_types',
      );
      expect(
        service.classifyIntent('dame las fechas de emisión de Yolito'),
      ).toBe('list_issue_dates');
      expect(
        service.classifyIntent('¿Quién es el cliente en OC_Yolito.pdf?'),
      ).toBe('list_customer_names');
    });
  });

  describe('extractTrackedEntity — anclaje y depuración', () => {
    it('detecta el nombre de archivo como ancla precisa', () => {
      expect(
        service.extractTrackedEntity('¿Quién es el proveedor en OC_Yolito2.pdf?'),
      ).toBe('OC_Yolito2.pdf');
    });

    it('depura la entidad ruidosa del patrón de respaldo', () => {
      expect(
        service.extractTrackedEntity(
          '¿Cuál es el total de la orden de compra de Yolito2?',
        ),
      ).toBe('yolito2');
      expect(
        service.extractTrackedEntity('¿Qué órdenes de compra tengo de Sodimac?'),
      ).toBe('sodimac');
    });

    it('captura la entidad desde el contexto de comprador', () => {
      expect(
        service.extractTrackedEntity(
          'el nombre del comprador es Yolito Balart Hnos. Ltda.',
        ),
      ).toBe('yolito balart hnos');
    });

    it('no inventa entidad en consultas agregadas sin entidad', () => {
      expect(service.extractTrackedEntity('¿Cuántos documentos tengo?')).toBeNull();
      expect(
        service.extractTrackedEntity('¿Qué tipos de documentos tengo?'),
      ).toBeNull();
    });
  });

  describe('resolveEntity — prioridad pregunta actual sobre historial', () => {
    const withContext = (history: string[], current: string): string =>
      [
        'Contexto reciente de la conversación:',
        history.join('\n'),
        `Pregunta actual del usuario: ${current}`,
        'Resuelve la pregunta actual usando el contexto anterior cuando haga falta.',
      ].join('\n\n');

    it('usa el archivo de la pregunta actual, no el citado por el asistente', () => {
      const ctx = withContext(
        [
          'Usuario: dame la fecha de OC_Yolito.pdf',
          'Asistente: La fecha de OC_Yolito.pdf es 2025-09-22.',
        ],
        '¿qué fecha de emisión tiene OC_Yolito2.pdf?',
      );
      const r = service.resolve(ctx);
      expect(r.entity).toBe('OC_Yolito2.pdf');
      expect(r.entityIsFilename).toBe(true);
    });

    it('no hereda un filename del asistente para un conteo por entidad', () => {
      const ctx = withContext(
        [
          'Usuario: dame las fechas de los documentos de Yolito',
          'Asistente: Las fechas de OC_Yolito.pdf y OC_Yolito2.pdf son 2025-09-22.',
        ],
        '¿y cuántos documentos de Yolito tengo?',
      );
      const r = service.resolve(ctx);
      expect(r.entity).toBe('yolito');
      expect(r.entityIsFilename).toBe(false);
    });

    it('hereda la entidad de un turno previo del usuario en un follow-up', () => {
      const ctx = withContext(
        ['Usuario: el nombre del comprador es Yolito Balart Hnos. Ltda.'],
        '¿y cuál es el proveedor?',
      );
      const r = service.resolve(ctx);
      expect(r.entity).toBe('yolito balart hnos');
      expect(r.entitySource).toBe('context');
    });
  });

  describe('isAmbiguousEntity — entidad débil en pregunta por nombre (T28-014)', () => {
    it('marca ambigüedad para "proveedor de Grupo TX" (ancla débil "de X")', () => {
      expect(
        service.isAmbiguousEntity(service.resolve('¿cuál es el proveedor de Grupo TX?')),
      ).toBe(true);
    });

    it('no marca ambigüedad cuando el ancla es un archivo o el contexto', () => {
      expect(
        service.isAmbiguousEntity(
          service.resolve('¿quién es el proveedor en OC_Yolito2.pdf?'),
        ),
      ).toBe(false);

      const ctx = [
        'Contexto reciente de la conversación:',
        'Usuario: el nombre del comprador es Yolito Balart Hnos. Ltda.',
        'Pregunta actual del usuario: ¿y cuál es el proveedor?',
      ].join('\n\n');
      expect(service.isAmbiguousEntity(service.resolve(ctx))).toBe(false);
    });
  });

  describe('isClarificationStatement — statements de aclaración (T28-015)', () => {
    it('detecta el statement que aporta la entidad', () => {
      expect(
        service.isClarificationStatement(
          'el nombre del comprador es Yolito Balart Hnos. Ltda.',
        ),
      ).toBe(true);
    });

    it('no trata como statement una pregunta', () => {
      expect(service.isClarificationStatement('¿y cuál es el proveedor?')).toBe(
        false,
      );
      expect(
        service.isClarificationStatement('¿el proveedor es MORTEROS TX?'),
      ).toBe(false);
      expect(
        service.isClarificationStatement('qué proveedores tengo'),
      ).toBe(false);
    });
  });
});
