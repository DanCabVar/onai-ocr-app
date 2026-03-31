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
    action: 'create_type' | 'assign_type' | 'cancel',
    typeName?: string,
    typeId?: number,
  ): Promise<ConfirmTypeResponse & { lowConfidence?: boolean }> {
    const response = await apiClient.post<ConfirmTypeResponse & { lowConfidence?: boolean }>('/documents/confirm-type', {
      documentId,
      action,
      typeName,
      typeId,
    });
    return response.data;
  },

  /**
   * Sube archivos al inbox (originals/) sin procesar — modo background
   */
  async uploadToInbox(
    files: File[],
    onUploadProgress?: (percent: number) => void,
  ): Promise<{ success: boolean; message: string; documentIds: number[]; processing: boolean }> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await apiClient.post('/documents/upload-to-inbox', formData, {
      headers: { 'Content-Type': undefined as any },
      timeout: 120000,
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          onUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
    return response.data;
  },

  /**
   * Obtiene todos los documentos del usuario
   */
  async getAll(): Promise<Document[]> {
    const response = await apiClient.get<any>('/documents');
    // Backend may return paginated { items, total, ... } or plain array
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  },

  /**
   * Obtiene un documento específico por ID
   */
  async getById(id: number): Promise<Document> {
    const response = await apiClient.get<Document>(`/documents/${id}`);
    return response.data;
  },

  /**
   * Resolver docs pending_confirmation en batch con tipos asignados
   */
  async resolvePendingBatch(
    assignments: Array<{ documentId: number; typeName: string; typeId?: number }>,
  ): Promise<{ success: boolean; results: any[]; total: number; completed: number }> {
    const response = await apiClient.post('/documents/resolve-pending-batch', { assignments });
    return response.data;
  },

  /**
   * Re-procesa un documento con error o pendiente
   */
  async reprocess(id: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(`/documents/${id}/reprocess`);
    return response.data;
  },

  /**
   * Elimina un documento (DB + R2)
   */
  async delete(id: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/documents/${id}`);
    return response.data;
  },

  /**
   * Polling de estado para un batch de documentos
   */
  async getBatchStatus(documentIds: number[]): Promise<{
    total: number; completed: number; processing: number; pendingConfirmation: number;
    errors: number; allDone: boolean;
    documents: Array<{ id: number; filename: string; status: string; documentTypeName: string | null; confidenceScore: number }>
  }> {
    const response = await apiClient.post('/documents/batch-status', { documentIds });
    return response.data;
  },

  /**
   * Obtiene los tipos inferidos para docs pending_confirmation
   */
  async getInferredTypes(documentIds: number[]): Promise<{ inferredTypes: any[] }> {
    try {
      const response = await apiClient.post('/documents/inferred-types', { documentIds });
      return response.data;
    } catch {
      return { inferredTypes: [] };
    }
  },
};

