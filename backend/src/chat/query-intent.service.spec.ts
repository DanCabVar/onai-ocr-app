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
