import { Injectable } from '@nestjs/common';

/**
 * Catálogo de intenciones del chat documental (T28 — Fase 2).
 *
 * Se mantiene como contrato estable entre la comprensión semántica de la
 * pregunta y la resolución de campos. Solo un subconjunto se resuelve por
 * ruta determinística hoy; el resto cae al fallback generativo (SQL-RAG).
 */
export type ChatIntent =
  | 'count_documents'
  | 'list_document_types'
  | 'list_issue_dates'
  | 'list_order_numbers'
  | 'list_dispatch_order_numbers'
  | 'list_supplier_names'
  | 'list_customer_names'
  | 'list_buyer_names'
  | 'list_totals'
  | 'unknown';

export interface ResolvedQueryIntent {
  /** Intención semántica de la pregunta actual. */
  intent: ChatIntent;
  /** Entidad rastreada (proveedor/comprador/empresa) o null si no se detecta. */
  entity: string | null;
  /** Texto de la pregunta actual, ya separado del contexto conversacional. */
  currentQuestion: string;
}

/**
 * Capa de intención del chat documental.
 *
 * Responsabilidad única: traducir la pregunta (con o sin contexto multi-turno)
 * a una intención semántica + entidad rastreada, SIN construir SQL. La
 * traducción a acceso concreto a datos vive en `FieldResolutionService`.
 */
@Injectable()
export class QueryIntentService {
  /** Detecta nombres de archivo para anclar consultas a un documento puntual. */
  private readonly filenamePattern =
    /\b([\w.-]+\.(?:pdf|png|jpe?g|tiff?|docx?|xlsx?|csv))\b/i;

  /** Statements declarativos que aportan una entidad sin ser una pregunta. */
  private static readonly CLARIFICATION_PATTERNS = [
    /\bnombre\s+del?\s+(?:comprador|proveedor|cliente|emisor|receptor)\b[\s\S]*\bes\b/,
    /\bel\s+(?:comprador|proveedor|cliente|emisor|receptor)\s+es\b/,
  ];

  /**
   * Tokens funcionales y genéricos de dominio que no identifican una entidad.
   * Permiten depurar capturas ruidosas del patrón de respaldo "de <…>".
   */
  private static readonly STOPWORDS = new Set<string>([
    // artículos, preposiciones y conectores
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
    'y', 'o', 'en', 'para', 'por', 'con', 'su', 'sus', 'mi', 'mis', 'lo',
    // verbos e interrogativos frecuentes
    'es', 'son', 'tengo', 'tienes', 'tiene', 'hay', 'dame', 'darme', 'puedes',
    'muestrame', 'mostrar', 'quien', 'quienes', 'cual', 'cuales', 'cuanto',
    'cuantos', 'que', 'cuya', 'cuyo',
    // genéricos de dominio (roles, campos, tipos)
    'documento', 'documentos', 'orden', 'ordenes', 'compra', 'compras',
    'despacho', 'tipo', 'tipos', 'fecha', 'fechas', 'emision', 'numero',
    'numeros', 'total', 'monto', 'montos', 'nombre', 'proveedor', 'proveedores',
    'comprador', 'compradores', 'cliente', 'clientes', 'emisor', 'factura',
    'facturas',
  ]);

  /**
   * Resuelve la pregunta a intención + entidad usando el contexto disponible.
   */
  resolve(question: string): ResolvedQueryIntent {
    const currentQuestion = this.extractCurrentQuestion(question);
    const entity = this.extractTrackedEntity(question);
    const intent = this.classifyIntent(currentQuestion);
    return { intent, entity, currentQuestion };
  }

  /**
   * Detecta cuando la "pregunta" actual es en realidad un statement de
   * aclaración que aporta una entidad ("el nombre del comprador es X"), no una
   * consulta. Permite responder con un acknowledgement contextual en lugar de
   * ejecutar SQL que devolvería "sin resultados" (caso T28-015).
   */
  isClarificationStatement(currentQuestion: string): boolean {
    const n = this.normalizeText(currentQuestion).trim();
    if (!n || n.includes('?')) {
      return false;
    }
    // Si arranca con un interrogativo, es una pregunta aunque no lleve signo.
    if (
      /^(?:y\s+)?(que|cual|cuales|quien|quienes|cuanto|cuantos|como|donde|cuando|dame|muestrame|lista|listame)\b/.test(
        n,
      )
    ) {
      return false;
    }
    return QueryIntentService.CLARIFICATION_PATTERNS.some((p) => p.test(n));
  }

  /**
   * Aísla la pregunta actual cuando el chat antepone el contexto reciente.
   */
  extractCurrentQuestion(question: string): string {
    const match = question.match(/Pregunta actual del usuario:\s*([\s\S]*)$/i);
    return match?.[1]?.trim() || question.trim();
  }

  /**
   * Clasifica la intención de primer nivel a partir de la pregunta actual.
   *
   * La precedencia es deliberada: campos más específicos (fecha de emisión,
   * conteo, número de orden) se evalúan antes que entidades genéricas
   * (proveedor, tipo de documento) para evitar colisiones de keywords.
   */
  classifyIntent(currentQuestion: string): ChatIntent {
    const n = this.normalizeText(currentQuestion);

    if (n.includes('fecha') && n.includes('emision')) {
      return 'list_issue_dates';
    }

    if (n.includes('cuanto') || n.includes('cuantos')) {
      return 'count_documents';
    }

    // El monto/total se resuelve antes que "orden de compra": en preguntas como
    // "el total de la orden de compra de X" el objetivo es el total, no el OC.
    if (n.includes('total') || n.includes('monto')) {
      return 'list_totals';
    }

    // Los roles explícitos (proveedor/cliente) tienen prioridad sobre la rama
    // amplia de "orden de compra": "¿qué proveedores aparecen en mis órdenes de
    // compra?" busca proveedores, no números de orden.
    if (n.includes('proveedor')) {
      return 'list_supplier_names';
    }

    if (n.includes('cliente')) {
      return 'list_customer_names';
    }

    // Número de orden de compra. Se acepta tanto el phrasing explícito
    // ("número de orden") como "órdenes de compra", excluyendo despacho.
    if (
      !n.includes('despacho') &&
      ((n.includes('numero') && n.includes('orden')) ||
        (n.includes('orden') && n.includes('compra')))
    ) {
      return 'list_order_numbers';
    }

    if (n.includes('tipo') && n.includes('document')) {
      return 'list_document_types';
    }

    return 'unknown';
  }

  /**
   * Extrae la entidad relevante (empresa/proveedor/comprador) desde la
   * pregunta o el contexto reciente, evitando frases genéricas que no
   * identifican una entidad real.
   */
  extractTrackedEntity(question: string): string | null {
    // 1. Nombre de archivo: ancla precisa a un documento puntual
    //    ("¿quién es el cliente en OC_Yolito.pdf?"). Se devuelve literal para
    //    permitir un match exacto sobre `filename`.
    const fileMatch = question.match(this.filenamePattern);
    if (fileMatch?.[1]) {
      return fileMatch[1].trim();
    }

    // 2. Patrones por rol o frase contextual.
    const patterns = [
      /nombre del (?:comprador|proveedor|emisor|cliente)[^.\n]* es ([^\n.]+)/i,
      /documentos de ([^\n?.]+)/i,
      /de ([A-Za-zÁÉÍÓÚáéíóúÑñ0-9 .&_-]{3,})/i,
    ];

    for (const pattern of patterns) {
      const match = question.match(pattern);
      const value = match?.[1]?.trim();
      if (!value || this.isGenericEntityPhrase(value)) {
        continue;
      }
      // Limpia tokens genéricos/funcionales (artículos, verbos, roles) para
      // quedarse con la entidad distintiva ("la orden de compra de Yolito2"
      // → "yolito2"), reduciendo ruido en el anclaje sin sobreajustar.
      const cleaned = this.cleanEntity(value);
      if (cleaned && !this.isGenericEntityPhrase(cleaned)) {
        return cleaned;
      }
    }

    return null;
  }

  /**
   * Depura una entidad candidata removiendo tokens funcionales y genéricos de
   * dominio, conservando solo los términos distintivos. Si no queda nada
   * distintivo, devuelve cadena vacía para que el llamador la descarte.
   */
  private cleanEntity(value: string): string {
    const tokens = this.normalizeText(value)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);

    const kept = tokens.filter((token) => !QueryIntentService.STOPWORDS.has(token));
    return kept.length > 0 ? kept.join(' ') : '';
  }

  private isGenericEntityPhrase(value: string): boolean {
    const normalized = this.normalizeText(value)
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return true;
    }

    const genericPhrases = [
      'orden de compra',
      'orden de despacho',
      'proveedor',
      'comprador',
      'cliente',
      'emisor',
      'tipo de documento',
      'tipos de documentos',
      'fechas de emision',
      'numero de orden',
      'numeros de orden de compra',
    ];

    return genericPhrases.includes(normalized);
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }
}
