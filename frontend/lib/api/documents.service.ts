import { apiClient } from './client';

export interface DocumentUploadResponse {
  success: boolean;
  message: string;
  document: {
    id: number;
    filename: string;
    documentTypeId: number;
    googleDriveFileId: string;
    googleDriveLink: string;
    extractedData: Record<string, any>;
    confidenceScore: number;
    createdAt: string;
  };
  wasClassified: boolean;
  createdOthersFolder: boolean;
}

export interface BatchDocumentResult {
  filename: string;
  status: 'completed' | 'pending_confirmation' | 'error';
  document?: DocumentUploadResponse['document'];
  wasClassified?: boolean;
  suggestedType?: string;
  documentId?: number;
  error?: string;
}

export interface BatchUploadResponse {
  success: boolean;
  message: string;
  results: BatchDocumentResult[];
  totalProcessed: number;
  totalSuccess: number;
  totalPending: number;
  totalErrors: number;
}

export interface ConfirmTypeResponse {
  success: boolean;
  message: string;
  document?: DocumentUploadResponse['document'];
}

export interface DocumentField {
  name: string;
  type: string;
  label: string;
  required: boolean;
  description: string;
  value: any;
}

export interface Document {
  id: number;
  filename: string;
  documentTypeId: number;
  documentTypeName: string | null;
  googleDriveLink: string;
  googleDriveFileId: string;
  extractedData: {
    summary: string;
    fields?: DocumentField[];
    key_fields?: DocumentField[]; // Para compatibilidad con documentos "Otros"
  };
  inferredData?: {
    inferred_type: string;
    summary: string;
    key_fields: DocumentField[];
  } | null;
  ocrRawText?: string | null;
  confidenceScore: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const documentsService = {
  /**
   * Sube un documento y lo procesa automáticamente
   * (OCR + Clasificación + Extracción)
   */
  async upload(
    file: File,
    onUploadProgress?: (percent: number) => void,
  ): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<DocumentUploadResponse>('/documents/upload', formData, {
      // Do NOT set Content-Type manually — axios will set it with the
      // correct multipart boundary when it detects FormData.
      headers: {
        'Content-Type': undefined as any,
      },
      timeout: 120000, // 2 minutos (el procesamiento puede tardar)
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percent);
        }
      },
    });

    return response.data;
  },

  /**
   * Sube múltiples documentos en lote y los procesa
   */
  async uploadBatch(
    files: File[],
    onUploadProgress?: (percent: number) => void,
  ): Promise<BatchUploadResponse> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await apiClient.post<BatchUploadResponse>('/documents/upload-batch', formData, {
      headers: {
        'Content-Type': undefined as any,
      },
      timeout: 300000, // 5 minutos para lotes grandes
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onUploadProgress(percent);
        }
      },
    });

    return response.data;
  },

  /**
   * Confirma o cancela un tipo sugerido para un documento pendiente
   */
  async confirmType(
    documentId: number,
    action: 'confirm' | 'cancel',
    typeName?: string,
  ): Promise<ConfirmTypeResponse> {
    const response = await apiClient.post<ConfirmTypeResponse>('/documents/confirm-type', {
      documentId,
      action,
      typeName,
    });
    return response.data;
  },

  /**
   * Obtiene todos los documentos del usuario
   */
  async getAll(): Promise<Document[]> {
    const response = await apiClient.get<Document[]>('/documents');
    return response.data;
  },

  /**
   * Obtiene un documento específico por ID
   */
  async getById(id: number): Promise<Document> {
    const response = await apiClient.get<Document>(`/documents/${id}`);
    return response.data;
  },
};

