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

