import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DocumentType } from '../../database/entities/document-type.entity';
import { Document } from '../../database/entities/document.entity';
import { User } from '../../database/entities/user.entity';
import { GeminiClassifierService } from '../../ai-services/gemini-classifier.service';
import { MistralOCRService } from '../../ai-services/mistral-ocr.service';
import { OCRCacheService } from '../../ai-services/ocr-cache.service';
import { AIRateLimiterService } from '../../ai-services/rate-limiter.service';
import { PipelineMetricsService } from '../../ai-services/pipeline-metrics.service';
import { withRetry } from '../../ai-services/retry.util';
import { StorageService } from '../../storage/storage.service';
import {
  ProcessedDocument,
  DocumentTypeGroup,
  ConsolidatedType,
  CreatedDocumentType,
  ConsolidatedField,
} from '../dto/infer-from-samples.dto';

// ─── Concurrency Semaphore ───────────────────────────────────────────────────
class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}

/**
 * Run tasks with a true concurrency semaphore (not batch-of-N).
 * Returns PromiseSettledResult[] so individual failures don't kill the batch.
 */
async function runWithSemaphore<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const sem = new Semaphore(concurrency);
  const tasks = items.map(async (item, idx) => {
    await sem.acquire();
    try {
      return await fn(item, idx);
    } finally {
      sem.release();
    }
  });
  return Promise.allSettled(tasks);
}

// ─── Interfaces for internal pipeline state ──────────────────────────────────

interface OcrDoc {
  file: Express.Multer.File;
  ocrText: string;
  contentHash: string;
  error?: string;
}

interface ClassifiedDoc extends OcrDoc {
  inferredType: string;
}

interface TypeGroup {
  canonicalName: string;
  docs: ClassifiedDoc[];
  existingType: DocumentType | null;
}

/**
 * Document Type Inference Service (Refactored — True Parallel Pipeline)
 *
 * Pipeline:
 *   STEP 1 → OCR in parallel (max 3 concurrent, with cache)
 *   STEP 2 → Classify in parallel (max 5 concurrent)
 *   STEP 3 → Homologate types (single Gemini call to group similar names)
 *   STEP 4 → Consolidate schema per group (up to 30 shared fields)
 *   STEP 5 → Re-extract with unified schema (max 3 concurrent)
 *   STEP 6 → Save to DB + R2 (per type, in {user_id}/tipos/{tipo-slug}/)
 */
@Injectable()
export class DocumentTypeInferenceService {
  private readonly logger = new Logger(DocumentTypeInferenceService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;
  private modelName: string;

  constructor(
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    private readonly geminiClassifierService: GeminiClassifierService,
    private readonly mistralOCRService: MistralOCRService,
    private readonly ocrCache: OCRCacheService,
    private readonly rateLimiter: AIRateLimiterService,
    private readonly metricsService: PipelineMetricsService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY no está configurada');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });

    this.logger.log(`Inference Service inicializado: ${this.modelName}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Normaliza tipos de campo de Gemini a tipos válidos de FieldDefinition
   */
  private normalizeFieldType(type: string): 'string' | 'number' | 'date' | 'boolean' | 'array' {
    const lowerType = type.toLowerCase().trim();

    if (['number', 'integer', 'float', 'currency'].includes(lowerType)) return 'number';
    if (['date', 'datetime', 'timestamp'].includes(lowerType)) return 'date';
    if (['boolean', 'bool'].includes(lowerType)) return 'boolean';
    if (['array', 'list'].includes(lowerType)) return 'array';

    return 'string';
  }

  /**
   * Deduplicate files by content hash so the same PDF isn't processed N times.
   */
  private deduplicateFiles(files: Express.Multer.File[]): Express.Multer.File[] {
    const seen = new Set<string>();
    const unique: Express.Multer.File[] = [];

    for (const file of files) {
      const hash = this.ocrCache.computeHash(file.buffer);
      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(file);
      } else {
        this.logger.warn(`⚠️  Duplicado detectado y omitido: "${file.originalname}"`);
      }
    }

    return unique;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: OCR (parallel, max 3 concurrent, with cache)
  // ═══════════════════════════════════════════════════════════════════════════

  private async step1_OCR(files: Express.Multer.File[]): Promise<OcrDoc[]> {
    this.logger.log(`\n📖 PASO 1: OCR en paralelo (${files.length} docs, max 3 concurrent)...`);

    const results = await runWithSemaphore(files, 3, async (file, idx) => {
      const contentHash = this.ocrCache.computeHash(file.buffer);

      // Check cache first
      const cached = await this.ocrCache.get(contentHash);
      if (cached) {
        this.logger.log(`   🎯 [${idx + 1}/${files.length}] Cache HIT: "${file.originalname}"`);
        return { file, ocrText: cached.text, contentHash } as OcrDoc;
      }

      this.logger.log(`   📄 [${idx + 1}/${files.length}] OCR: "${file.originalname}"...`);

      // Upload to R2 temporarily for Mistral OCR (needs a URL)
      // Use userId=0 as temp namespace for OCR processing
      const tempKey = this.storageService.buildKey(0, 'originals', `temp-ocr-${contentHash}-${file.originalname}`);
      await this.storageService.uploadFile(file.buffer, tempKey, file.mimetype);
      const presignedUrl = await this.storageService.getPresignedUrl(tempKey, 600);

      try {
        const ocrResult = await this.mistralOCRService.extractTextSmart(presignedUrl, file.mimetype);

        // Cache the result
        this.ocrCache.set(contentHash, {
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          metadata: ocrResult.metadata,
        });

        this.logger.log(`   ✅ [${idx + 1}/${files.length}] "${file.originalname}": ${ocrResult.text.length} chars`);
        return { file, ocrText: ocrResult.text, contentHash } as OcrDoc;
      } finally {
        // Cleanup temp file (best-effort)
        this.storageService.deleteFile(tempKey).catch(() => {});
      }
    });

    const ocrDocs: OcrDoc[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        ocrDocs.push(r.value);
      } else {
        this.logger.error(`   ❌ OCR falló para "${files[i].originalname}": ${r.reason?.message}`);
        ocrDocs.push({
          file: files[i],
          ocrText: '',
          contentHash: this.ocrCache.computeHash(files[i].buffer),
          error: r.reason?.message || 'OCR failed',
        });
      }
    }

    const successCount = ocrDocs.filter((d) => !d.error).length;
    this.logger.log(`   📊 OCR completado: ${successCount}/${files.length} exitosos`);
    return ocrDocs;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Classify in parallel (max 5 concurrent)
  // ═══════════════════════════════════════════════════════════════════════════

  private async step2_Classify(ocrDocs: OcrDoc[]): Promise<ClassifiedDoc[]> {
    // Filter out docs that failed OCR
    const validDocs = ocrDocs.filter((d) => !d.error && d.ocrText.length > 0);
    this.logger.log(`\n🏷️  PASO 2: Clasificar en paralelo (${validDocs.length} docs, max 5 concurrent)...`);

    const results = await runWithSemaphore(validDocs, 5, async (doc, idx) => {
      this.logger.log(`   🔍 [${idx + 1}/${validDocs.length}] Clasificando "${doc.file.originalname}"...`);

      const inferred = await this.geminiClassifierService.inferFieldsForUnclassified(doc.ocrText);

      this.logger.log(`   ✅ [${idx + 1}/${validDocs.length}] "${doc.file.originalname}" → "${inferred.inferred_type}"`);

      return {
        ...doc,
        inferredType: inferred.inferred_type,
      } as ClassifiedDoc;
    });

    const classifiedDocs: ClassifiedDoc[] = [];

    // Keep error docs from step 1
    for (const doc of ocrDocs) {
      if (doc.error) {
        classifiedDocs.push({ ...doc, inferredType: '__ERROR__' } as ClassifiedDoc);
      }
    }

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        classifiedDocs.push(r.value);
      } else {
        this.logger.error(`   ❌ Clasificación falló para "${validDocs[i].file.originalname}": ${r.reason?.message}`);
        classifiedDocs.push({
          ...validDocs[i],
          inferredType: '__ERROR__',
          error: r.reason?.message || 'Classification failed',
        } as ClassifiedDoc);
      }
    }

    const successCount = classifiedDocs.filter((d) => d.inferredType !== '__ERROR__').length;
    this.logger.log(`   📊 Clasificación completada: ${successCount}/${ocrDocs.length} exitosos`);
    return classifiedDocs;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Homologate types (single Gemini call)
  // ═══════════════════════════════════════════════════════════════════════════

  private async step3_Homologate(
    classifiedDocs: ClassifiedDoc[],
    existingTypes: DocumentType[],
  ): Promise<TypeGroup[]> {
    // Separate error docs
    const validDocs = classifiedDocs.filter((d) => d.inferredType !== '__ERROR__');
    const errorDocs = classifiedDocs.filter((d) => d.inferredType === '__ERROR__');

    // Collect unique inferred type names
    const uniqueTypes = [...new Set(validDocs.map((d) => d.inferredType))];
    this.logger.log(`\n🔀 PASO 3: Homologar tipos (${uniqueTypes.length} tipos únicos detectados)...`);
    this.logger.log(`   📋 Tipos: ${uniqueTypes.join(', ')}`);

    // Check which types already exist in DB
    const existingByName = new Map<string, DocumentType>();
    for (const et of existingTypes) {
      existingByName.set(et.name.toLowerCase().trim(), et);
    }

    // If only 1 type, skip homologation
    if (uniqueTypes.length <= 1) {
      this.logger.log(`   ℹ️  Solo ${uniqueTypes.length} tipo, no requiere homologación`);
      const groups: TypeGroup[] = [];

      if (uniqueTypes.length === 1) {
        const name = uniqueTypes[0];
        const existing = existingByName.get(name.toLowerCase().trim()) || null;
        groups.push({
          canonicalName: name,
          docs: validDocs,
          existingType: existing,
        });
      }

      return groups;
    }

    // Use GeminiClassifierService homologation
    let homologation: Record<string, string[]>;
    try {
      homologation = await this.geminiClassifierService.homologateTypes(uniqueTypes);
      this.logger.log(`   ✅ Homologación: ${Object.keys(homologation).length} grupos canónicos`);
      for (const [canonical, variants] of Object.entries(homologation)) {
        this.logger.log(`      📁 "${canonical}" ← [${variants.join(', ')}]`);
      }
    } catch (error) {
      this.logger.error(`   ❌ Homologación falló: ${error.message}. Usando nombres originales.`);
      // Fallback: each type is its own group
      homologation = {};
      for (const t of uniqueTypes) {
        homologation[t] = [t];
      }
    }

    // Build type → canonical mapping
    const typeToCanonical = new Map<string, string>();
    for (const [canonical, variants] of Object.entries(homologation)) {
      for (const v of variants) {
        typeToCanonical.set(v, canonical);
      }
    }

    // Ensure all types have a mapping (fallback to self)
    for (const t of uniqueTypes) {
      if (!typeToCanonical.has(t)) {
        typeToCanonical.set(t, t);
      }
    }

    // Group documents by canonical name
    const groupMap = new Map<string, ClassifiedDoc[]>();
    for (const doc of validDocs) {
      const canonical = typeToCanonical.get(doc.inferredType) || doc.inferredType;
      if (!groupMap.has(canonical)) {
        groupMap.set(canonical, []);
      }
      groupMap.get(canonical)!.push(doc);
    }

    // Build TypeGroup array, matching against existing DB types
    const groups: TypeGroup[] = [];
    for (const [canonicalName, docs] of groupMap) {
      const existing = existingByName.get(canonicalName.toLowerCase().trim()) || null;
      groups.push({ canonicalName, docs, existingType: existing });
    }

    this.logger.log(`   📊 ${groups.length} grupo(s) finales`);
    return groups;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Consolidate schema per group
  // ═══════════════════════════════════════════════════════════════════════════

  private async step4_ConsolidateSchema(
    typeName: string,
    docs: ClassifiedDoc[],
  ): Promise<ConsolidatedType> {
    this.logger.log(`   🔧 PASO 4: Consolidando schema para "${typeName}" (${docs.length} docs)...`);

    // Build OCR text summaries for all docs in group (truncated)
    const ocrSummaries = docs.map((doc, i) => {
      const truncated = doc.ocrText.substring(0, 2000);
      return `--- DOCUMENTO ${i + 1} (${doc.file.originalname}) ---\n${truncated}${doc.ocrText.length > 2000 ? '\n...(truncado)' : ''}`;
    }).join('\n\n');

    const prompt = `Eres un experto en diseño de schemas de datos.

Tengo ${docs.length} documentos de tipo "${typeName}". Aquí están sus textos OCR:

${ocrSummaries}

**TAREA:** Define UN SOLO SCHEMA de hasta 30 campos principales para documentos tipo "${typeName}".

**INSTRUCCIONES:**
1. Analiza TODOS los documentos para identificar los campos más comunes y relevantes
2. Elige nombres en snake_case, en español, descriptivos
3. Tipos disponibles: string, number, date, boolean, email, phone, currency, array
4. required=true si aparece en ≥50% de los documentos
5. Máximo 30 campos, ordenados por importancia
6. Genera una descripción breve del tipo de documento

**FORMATO JSON:**
{
  "typeDescription": "Descripción breve del tipo de documento",
  "consolidatedFields": [
    {
      "name": "nombre_campo",
      "type": "string|number|date|boolean|email|phone|currency|array",
      "label": "Etiqueta en español",
      "required": true|false,
      "description": "Descripción del campo",
      "frequency": 0.85
    }
  ]
}

JSON only, sin texto adicional.`;

    const consolidationResult = await withRetry(async () => {
      await this.rateLimiter.acquire('gemini');
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in consolidation response');
      return JSON.parse(jsonMatch[0]);
    }, { maxRetries: 2, label: 'Gemini consolidate-schema' });

    this.logger.log(`   ✅ Schema consolidado: ${consolidationResult.consolidatedFields.length} campos`);

    return {
      typeName,
      description: consolidationResult.typeDescription || `Tipo "${typeName}" inferido de ${docs.length} documentos`,
      consolidatedFields: consolidationResult.consolidatedFields,
      sampleDocuments: docs.map((d) => ({
        filename: d.file.originalname,
        inferredType: typeName,
        fields: [], // Fields will be populated after re-extraction
        buffer: d.file.buffer,
        mimeType: d.file.mimetype,
      })),
      sampleCount: docs.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Re-extract with unified schema (parallel, max 3 concurrent)
  // ═══════════════════════════════════════════════════════════════════════════

  private async step5_ReExtract(
    docs: ClassifiedDoc[],
    consolidatedSchema: ConsolidatedField[],
    typeName: string,
  ): Promise<Array<{ doc: ClassifiedDoc; extractedData: any; error?: string }>> {
    this.logger.log(`   🔄 PASO 5: Re-extrayendo ${docs.length} docs con schema unificado (max 3 concurrent)...`);

    // Build a pseudo DocumentType for extraction
    const normalizedFields = consolidatedSchema.map(({ frequency, ...field }) => ({
      name: field.name,
      type: this.normalizeFieldType(field.type),
      label: field.label,
      required: field.required,
      description: field.description,
    })) as import('../../database/entities/document-type.entity').FieldDefinition[];

    const pseudoType = {
      name: typeName,
      fieldSchema: { fields: normalizedFields },
    } as DocumentType;

    const results = await runWithSemaphore(docs, 3, async (doc, idx) => {
      this.logger.log(`      📄 [${idx + 1}/${docs.length}] Re-extrayendo "${doc.file.originalname}"...`);

      const extractedData = await this.geminiClassifierService.extractDataWithVision(
        doc.file.buffer,
        doc.file.mimetype,
        pseudoType,
      );

      this.logger.log(`      ✅ [${idx + 1}/${docs.length}] "${doc.file.originalname}": ${extractedData.fields?.length || 0} campos`);
      return { doc, extractedData };
    });

    const extracted: Array<{ doc: ClassifiedDoc; extractedData: any; error?: string }> = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        extracted.push(r.value);
      } else {
        this.logger.error(`      ❌ Re-extracción falló para "${docs[i].file.originalname}": ${r.reason?.message}`);
        extracted.push({
          doc: docs[i],
          extractedData: { summary: 'Error en re-extracción', fields: [] },
          error: r.reason?.message,
        });
      }
    }

    return extracted;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Save to DB + R2
  // ═══════════════════════════════════════════════════════════════════════════

  private async step6_Save(
    group: TypeGroup,
    consolidated: ConsolidatedType,
    reExtracted: Array<{ doc: ClassifiedDoc; extractedData: any; error?: string }>,
    user: User,
    uploadSamples: boolean,
  ): Promise<CreatedDocumentType | null> {
    this.logger.log(`   💾 PASO 6: Guardando "${group.canonicalName}" en BD + R2...`);

    let documentType: DocumentType;
    let isNewType = false;

    if (group.existingType) {
      // Existing type: use its schema
      documentType = group.existingType;
      this.logger.log(`   ✅ Tipo "${group.canonicalName}" ya existe (ID: ${documentType.id})`);
    } else {
      // New type: create in DB
      isNewType = true;

      const normalizedFields = consolidated.consolidatedFields.map(({ frequency, ...field }) => ({
        name: field.name,
        type: this.normalizeFieldType(field.type),
        label: field.label,
        required: field.required,
        description: field.description,
      })) as import('../../database/entities/document-type.entity').FieldDefinition[];

      documentType = this.documentTypeRepository.create({
        userId: user.id,
        name: group.canonicalName,
        description: consolidated.description,
        fieldSchema: { fields: normalizedFields },
      });

      await this.documentTypeRepository.save(documentType);
      this.logger.log(`   ✅ Tipo "${group.canonicalName}" creado (ID: ${documentType.id})`);
    }

    // Upload sample documents
    if (uploadSamples && reExtracted.length > 0) {
      this.logger.log(`   📤 Subiendo ${reExtracted.length} documentos...`);

      for (const item of reExtracted) {
        try {
          const filename = item.doc.file.originalname;

          // Upload to R2 in typed folder
          const storageKey = this.storageService.buildKey(user.id, 'originals', filename);
          await this.storageService.uploadFile(item.doc.file.buffer, storageKey, item.doc.file.mimetype);
          const publicUrl = await this.storageService.getPresignedUrl(storageKey, 7 * 24 * 3600);

          const documentRecord = this.documentRepository.create({
            userId: user.id,
            documentTypeId: documentType.id,
            filename,
            storageKey,
            storageProvider: 'r2',
            ocrRawText: item.doc.ocrText || null,
            extractedData: item.extractedData,
            inferredData: null,
            confidenceScore: item.error ? 0.5 : 0.95,
            status: item.error ? 'error' : 'completed',
          });

          await this.documentRepository.save(documentRecord);
          this.logger.log(`      ✅ "${filename}" guardado (ID: ${documentRecord.id})`);
        } catch (error) {
          this.logger.error(`      ❌ Error guardando "${item.doc.file.originalname}": ${error.message}`);
        }
      }
    }

    return {
      id: documentType.id,
      name: documentType.name,
      description: isNewType ? documentType.description : `${documentType.description} (${reExtracted.length} docs agregados)`,
      fieldCount: consolidated.consolidatedFields.length,
      sampleDocumentCount: reExtracted.length,
      fields: consolidated.consolidatedFields,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN ORCHESTRATOR
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * MÉTODO PRINCIPAL: Orquesta todo el proceso de inferencia.
   *
   * Pipeline:
   *   1. OCR en paralelo (max 3)
   *   2. Clasificar en paralelo (max 5)
   *   3. Homologar tipos (1 llamada Gemini)
   *   4. Consolidar schema por grupo
   *   5. Re-extraer con schema unificado (max 3)
   *   6. Guardar en BD + R2
   */
  async inferDocumentTypesFromSamples(
    files: Express.Multer.File[],
    user: User,
    uploadSamples: boolean = false,
    onProgress?: (step: string, progress: number, message: string) => void,
  ): Promise<CreatedDocumentType[]> {
    const startTime = Date.now();
    this.logger.log(`🚀 Iniciando pipeline de inferencia: ${files.length} documentos`);

    // Deduplicate files by content
    const uniqueFiles = this.deduplicateFiles(files);
    if (uniqueFiles.length < files.length) {
      this.logger.log(`   📊 ${files.length} → ${uniqueFiles.length} documentos únicos`);
    }

    // Load existing types for matching
    const existingTypes = await this.documentTypeRepository.find();

    const reportProgress = (step: string, progress: number, message: string) => {
      if (onProgress) onProgress(step, progress, message);
    };

    // ─── STEP 1: OCR ───
    reportProgress('ocr', 5, 'Iniciando OCR...');
    const ocrDocs = await this.step1_OCR(uniqueFiles);
    reportProgress('ocr', 30, `OCR completado: ${ocrDocs.filter(d => !d.error).length}/${uniqueFiles.length} docs`);

    // ─── STEP 2: Classify ───
    reportProgress('classifying', 35, 'Clasificando documentos...');
    const classifiedDocs = await this.step2_Classify(ocrDocs);
    reportProgress('classifying', 50, 'Clasificación completada');

    // ─── STEP 3: Homologate ───
    reportProgress('homologating', 55, 'Homologando tipos...');
    const groups = await this.step3_Homologate(classifiedDocs, existingTypes);

    if (groups.length === 0) {
      this.logger.warn(`⚠️  No se pudieron clasificar documentos`);
      reportProgress('done', 100, 'No se pudieron clasificar documentos');
      return [];
    }
    reportProgress('homologating', 60, `${groups.length} grupo(s) identificado(s)`);

    // ─── STEPS 4-6: Per group ───
    const results: CreatedDocumentType[] = [];

    for (const group of groups) {
      try {
        this.logger.log(`\n📦 Procesando grupo "${group.canonicalName}" (${group.docs.length} docs)...`);

        // STEP 4: Consolidate schema
        reportProgress('consolidating', 65, `Consolidando schema: "${group.canonicalName}"...`);
        const consolidated = await this.step4_ConsolidateSchema(group.canonicalName, group.docs);

        // STEP 5: Re-extract with unified schema
        reportProgress('extracting', 75, `Re-extrayendo datos: "${group.canonicalName}"...`);
        const reExtracted = await this.step5_ReExtract(
          group.docs,
          consolidated.consolidatedFields,
          group.canonicalName,
        );

        // STEP 6: Save to DB + R2
        reportProgress('saving', 90, `Guardando "${group.canonicalName}" en sistema...`);
        const result = await this.step6_Save(group, consolidated, reExtracted, user, uploadSamples);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        this.logger.error(`❌ Error procesando grupo "${group.canonicalName}": ${error.message}`);
        // Continue with next group — don't kill the batch
      }
    }

    // Report errors
    const errorDocs = classifiedDocs.filter((d) => d.error || d.inferredType === '__ERROR__');
    if (errorDocs.length > 0) {
      this.logger.warn(`⚠️  ${errorDocs.length} documento(s) con errores:`);
      for (const doc of errorDocs) {
        this.logger.warn(`   - "${doc.file.originalname}": ${doc.error}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    this.logger.log(`\n🎉 Pipeline completado en ${elapsed}s: ${results.length} tipo(s) procesado(s)`);
    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY METHODS (kept for backward compat, delegate to new pipeline)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * @deprecated Use inferDocumentTypesFromSamples directly
   */
  async classifyAndGroupDocuments(
    files: Express.Multer.File[],
    user: User,
  ): Promise<Map<string, { files: Express.Multer.File[]; existingType: DocumentType | null }>> {
    this.logger.warn('⚠️  classifyAndGroupDocuments is deprecated — use inferDocumentTypesFromSamples');

    const existingTypes = await this.documentTypeRepository.find();
    const ocrDocs = await this.step1_OCR(files);
    const classifiedDocs = await this.step2_Classify(ocrDocs);
    const groups = await this.step3_Homologate(classifiedDocs, existingTypes);

    const result = new Map<string, { files: Express.Multer.File[]; existingType: DocumentType | null }>();
    for (const group of groups) {
      result.set(group.canonicalName, {
        files: group.docs.map((d) => d.file),
        existingType: group.existingType,
      });
    }
    return result;
  }

  /**
   * @deprecated Use step4_ConsolidateSchema instead
   */
  async consolidateFieldsByType(
    typeName: string,
    documents: ProcessedDocument[],
  ): Promise<ConsolidatedType> {
    this.logger.warn('⚠️  consolidateFieldsByType is deprecated');

    const documentsDescription = documents.map((doc, index) => {
      const fieldsStr = doc.fields
        .map((f) => `  - ${f.name} (${f.type}): "${f.label}"${f.required ? ' [REQUERIDO]' : ''}`)
        .join('\n');
      return `DOCUMENTO ${index + 1} (${doc.filename}):\n${fieldsStr}`;
    }).join('\n\n');

    const prompt = `Eres un experto en diseño de schemas de datos.

Tengo ${documents.length} documentos tipo "${typeName}" con estos campos extraídos:

${documentsDescription}

**TAREA:** Consolida estos campos en UN SOLO SCHEMA definitivo para "${typeName}".

**INSTRUCCIONES:**
1. Identificar campos equivalentes (mismo concepto, nombres diferentes)
2. Elegir mejor nombre (snake_case, español)
3. Elegir mejor tipo (string, number, date, boolean, email, phone, currency, array)
4. required: true si ≥50% de documentos
5. Máximo 30 campos, ordenados por importancia

**FORMATO JSON:**
{
  "typeDescription": "Descripción breve",
  "consolidatedFields": [
    {"name":"campo","type":"string","label":"Etiqueta","required":true,"description":"desc","frequency":0.85}
  ]
}

JSON only.`;

    const consolidationResult = await withRetry(async () => {
      await this.rateLimiter.acquire('gemini');
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in consolidation response');
      return JSON.parse(jsonMatch[0]);
    }, { maxRetries: 2, label: 'Gemini consolidate-fields' });

    return {
      typeName,
      description: consolidationResult.typeDescription || `Tipo "${typeName}"`,
      consolidatedFields: consolidationResult.consolidatedFields,
      sampleDocuments: documents,
      sampleCount: documents.length,
    };
  }

  /**
   * @deprecated Use step6_Save instead
   */
  async createDocumentTypesFromInference(
    consolidatedTypes: ConsolidatedType[],
    user: User,
    uploadSamples: boolean = false,
  ): Promise<CreatedDocumentType[]> {
    this.logger.warn('⚠️  createDocumentTypesFromInference is deprecated');

    const createdTypes: CreatedDocumentType[] = [];

    for (const consolidated of consolidatedTypes) {
      const existingType = await this.documentTypeRepository.findOne({
        where: { name: consolidated.typeName },
      });

      let documentType: DocumentType;
      let isNewType = false;

      if (existingType) {
        if (!uploadSamples || consolidated.sampleDocuments.length === 0) continue;
        documentType = existingType;
      } else {
        isNewType = true;

        const normalizedFields = consolidated.consolidatedFields.map(({ frequency, ...field }) => ({
          name: field.name,
          type: this.normalizeFieldType(field.type),
          label: field.label,
          required: field.required,
          description: field.description,
        })) as import('../../database/entities/document-type.entity').FieldDefinition[];

        documentType = this.documentTypeRepository.create({
          userId: user.id,
          name: consolidated.typeName,
          description: consolidated.description,
          fieldSchema: { fields: normalizedFields },
        });

        await this.documentTypeRepository.save(documentType);
      }

      if (uploadSamples) {
        for (const doc of consolidated.sampleDocuments) {
          try {
            const storageKey = this.storageService.buildKey(user.id, 'originals', doc.filename);
            await this.storageService.uploadFile(doc.buffer, storageKey, doc.mimeType);
            const publicUrl = await this.storageService.getPresignedUrl(storageKey, 7 * 24 * 3600);

            const documentRecord = this.documentRepository.create({
              userId: user.id,
              documentTypeId: documentType.id,
              filename: doc.filename,
              storageKey,
              storageProvider: 'r2',
              ocrRawText: null,
              extractedData: {
                summary: `Documento de ejemplo para "${consolidated.typeName}"`,
                fields: doc.fields.map((f) => ({ ...f, value: f.value || null })),
              },
              inferredData: null,
              confidenceScore: 0.95,
              status: 'completed',
            });

            await this.documentRepository.save(documentRecord);
          } catch (err) {
            this.logger.warn(`⚠️  Error procesando ${doc.filename}: ${err.message}`);
          }
        }
      }

      if (isNewType || uploadSamples) {
        createdTypes.push({
          id: documentType.id,
          name: documentType.name,
          description: documentType.description,
          fieldCount: consolidated.consolidatedFields.length,
          sampleDocumentCount: consolidated.sampleCount,
          fields: consolidated.consolidatedFields,
        });
      }
    }

    return createdTypes;
  }
}
