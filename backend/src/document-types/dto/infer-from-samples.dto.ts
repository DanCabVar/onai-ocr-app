import { FieldDefinition } from '../../database/entities/document-type.entity';

/**
 * Campo con valor extraído (usado durante el procesamiento)
 * Más flexible que FieldDefinition para soportar tipos inferidos por IA
 */
export interface FieldWithValue {
  name: string;
  type: string; // Más flexible: puede ser "email", "phone", "currency", etc.
  label: string;
  required: boolean;
  description?: string;
  value?: any; // Valor extraído del documento
}

/**
 * Documento procesado individualmente con tipo y campos inferidos
 */
export interface ProcessedDocument {
  filename: string;
  inferredType: string;
  fields: FieldWithValue[]; // Campos con valores extraídos
  buffer: Buffer;
  mimeType: string;
}

/**
 * Grupo de documentos agrupados por tipo consolidado
 */
export interface DocumentTypeGroup {
  consolidatedName: string;
  documents: ProcessedDocument[];
}

/**
 * Campo consolidado con frecuencia de aparición
 */
export interface ConsolidatedField {
  name: string;
  type: string; // Más flexible para tipos inferidos
  label: string;
  required: boolean;
  description?: string;
  frequency: number; // 0-1, porcentaje de documentos donde aparece
}

/**
 * Tipo de documento consolidado con sus campos
 */
export interface ConsolidatedType {
  typeName: string;
  description: string;
  consolidatedFields: ConsolidatedField[];
  sampleDocuments: ProcessedDocument[];
  sampleCount: number;
}

/**
 * Tipo de documento creado en la BD
 */
export interface CreatedDocumentType {
  id: number;
  name: string;
  description: string;
  fieldCount: number;
  sampleDocumentCount: number;
  googleDriveFolderId: string;
  folderPath: string;
  fields: ConsolidatedField[];
}

/**
 * Respuesta del endpoint de inferencia
 */
export class InferFromSamplesResponseDto {
  success: boolean;
  message: string;
  createdTypes: CreatedDocumentType[];
  totalDocumentsProcessed: number;
  totalTypesCreated: number;
}

