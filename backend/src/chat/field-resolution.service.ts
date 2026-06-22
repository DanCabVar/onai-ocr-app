import { Injectable } from '@nestjs/common';

/**
 * Campos canónicos del dominio documental (T28 — Fase 2).
 *
 * Cada campo canónico representa la intención semántica real del usuario, y se
 * resuelve contra los `fields` extraídos (name/label) usando la matriz definida
 * en `docs/04_trabajo/T28_calidad_chatbot_documental/field_semantics_v1.md`.
 */
export type CanonicalField =
  | 'supplier_name'
  | 'customer_name'
  | 'buyer_name'
  | 'purchase_order_number'
  | 'dispatch_order_number'
  | 'issue_date'
  | 'monetary_total';

interface FieldRule {
  /**
   * Grupos de coincidencia. Cada grupo interno es un AND de substrings que
   * deben aparecer en `name` o en `label`; los grupos se combinan con OR.
   * Ej: `[['nombre', 'proveedor']]` exige nombre + proveedor juntos.
   */
  matchGroups: string[][];
  /**
   * Substrings que descalifican un campo aunque haya coincidido. Se aplican
   * tanto a `name` como a `label`. Materializan los "campos excluidos" de la
   * matriz semántica (rut, correo, teléfono, etc.).
   */
  excludeTerms: string[];
}

/** Placeholders sintéticos que nunca deben devolverse como valor real. */
const EMPTY_VALUE_PLACEHOLDERS = ['sin valor', '—', '-'];

/**
 * Capa de resolución semántica de campos.
 *
 * Responsabilidad única: dado un campo canónico (o una entidad rastreada),
 * producir las cláusulas SQL JSONB que aíslan el campo correcto, excluyen
 * campos semánticamente cercanos pero incorrectos, y descartan valores vacíos.
 *
 * No clasifica intención (eso es `QueryIntentService`) ni ejecuta SQL (eso es
 * `SqlRagService`). Centraliza el contrato de `field_semantics_v1.md`.
 */
@Injectable()
export class FieldResolutionService {
  private readonly rules: Record<CanonicalField, FieldRule> = {
    supplier_name: {
      matchGroups: [['nombre', 'proveedor']],
      excludeTerms: [
        'rut',
        'telefono',
        'fono',
        'fax',
        'correo',
        'email',
        'mail',
        'direccion',
        'celular',
      ],
    },
    customer_name: {
      matchGroups: [['cliente'], ['nombre', 'receptor']],
      excludeTerms: [
        'rut',
        'telefono',
        'fono',
        'correo',
        'email',
        'mail',
        'direccion',
        'celular',
      ],
    },
    buyer_name: {
      matchGroups: [['nombre', 'comprador']],
      excludeTerms: [
        'rut',
        'telefono',
        'fono',
        'correo',
        'email',
        'mail',
        'direccion',
        'celular',
      ],
    },
    purchase_order_number: {
      matchGroups: [
        ['numero', 'orden'],
        ['numero_oc'],
      ],
      excludeTerms: ['oc_mts', 'pedido_vta', 'despacho', 'rut', 'telefono'],
    },
    dispatch_order_number: {
      matchGroups: [
        ['numero', 'despacho'],
        ['orden', 'despacho'],
      ],
      excludeTerms: ['orden de compra', 'numero_oc_mts', 'pedido_vta', 'rut'],
    },
    issue_date: {
      matchGroups: [['fecha', 'emision']],
      excludeTerms: ['entrega', 'vigencia', 'vencimiento', 'actualiz'],
    },
    monetary_total: {
      matchGroups: [['total'], ['monto']],
      excludeTerms: ['neto', 'descuento', 'cantidad', 'unitario', 'iva'],
    },
  };

  /** Devuelve la regla semántica de un campo canónico. */
  getRule(field: CanonicalField): FieldRule {
    return this.rules[field];
  }

  /**
   * Construye la cláusula SQL que identifica un campo canónico sobre un alias
   * de `jsonb_array_elements(...->'fields')`, incluyendo exclusiones de campos
   * semánticamente cercanos.
   */
  buildFieldMatchClause(alias: string, field: CanonicalField): string {
    const rule = this.rules[field];

    const matchClause = rule.matchGroups
      .map((group) => {
        const nameClause = group
          .map((token) => `lower(${alias}->>'name') LIKE '%${token}%'`)
          .join(' AND ');
        const labelClause = group
          .map((token) => `lower(${alias}->>'label') LIKE '%${token}%'`)
          .join(' AND ');
        return `(${nameClause})\n    OR (${labelClause})`;
      })
      .join('\n    OR ');

    const excludeClause = rule.excludeTerms
      .map(
        (term) =>
          `lower(${alias}->>'name') NOT LIKE '%${term}%'\n    AND lower(${alias}->>'label') NOT LIKE '%${term}%'`,
      )
      .join('\n    AND ');

    if (!excludeClause) {
      return `(\n    ${matchClause}\n  )`;
    }

    return `(\n    ${matchClause}\n  )\n  AND ${excludeClause}`;
  }

  /**
   * Cláusula que descarta valores vacíos o placeholders sintéticos para un
   * alias de campo extraído.
   */
  buildNonEmptyValueClause(alias: string): string {
    const placeholders = EMPTY_VALUE_PLACEHOLDERS.map((p) => `'${p}'`).join(', ');
    return `trim(coalesce(${alias}->>'value', '')) <> ''
  AND lower(trim(coalesce(${alias}->>'value', ''))) NOT IN (${placeholders})`;
  }

  /**
   * Deriva términos de búsqueda a partir de la entidad rastreada para anclar
   * la consulta a los documentos correctos sin depender de un dataset puntual.
   */
  buildEntitySearchTerms(entity: string): string[] {
    const literal = this.normalizeText(entity).trim();

    // Nombre de archivo: usar el literal completo (con guiones/puntos) para un
    // match exacto sobre filename, evitando que "oc_yolito.pdf" arrastre a
    // "oc_yolito2.pdf" por compartir el prefijo.
    if (/\.(?:pdf|png|jpe?g|tiff?|docx?|xlsx?|csv)$/i.test(literal)) {
      return [literal];
    }

    const normalized = literal
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return [];
    }

    const words = normalized.split(' ').filter((word) => word.length >= 4);
    const terms = new Set<string>();

    terms.add(normalized);

    if (words.length > 0) {
      terms.add(words[0]);
    }

    if (words.length > 1) {
      terms.add(`${words[0]} ${words[1]}`);
    }

    words.slice(0, 4).forEach((word) => terms.add(word));

    return Array.from(terms);
  }

  /**
   * Construye las condiciones SQL que localizan documentos asociados a la
   * entidad rastreada, cubriendo filename, OCR, summaries y campos extraídos.
   */
  buildEntityMatchConditions(entityTerms: string[]): string {
    const termClauses = entityTerms.flatMap((term) => {
      const termLike = this.escapeSqlLike(term);
      return [
        `lower(d.filename) LIKE '%${termLike}%'`,
        `lower(coalesce(d.ocr_raw_text, '')) LIKE '%${termLike}%'`,
        `lower(coalesce(d.extracted_data->>'summary', '')) LIKE '%${termLike}%'`,
        `lower(coalesce(d.inferred_data->>'summary', '')) LIKE '%${termLike}%'`,
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements(coalesce(d.extracted_data->'fields', '[]'::jsonb)) f
          WHERE lower(coalesce(f->>'value', '')) LIKE '%${termLike}%'
        )`,
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements(coalesce(d.inferred_data->'key_fields', '[]'::jsonb)) f
          WHERE lower(coalesce(f->>'value', '')) LIKE '%${termLike}%'
        )`,
      ];
    });

    return termClauses.join('\n      OR ');
  }

  private escapeSqlLike(value: string): string {
    return this.normalizeText(value).replace(/'/g, "''").trim();
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }
}
