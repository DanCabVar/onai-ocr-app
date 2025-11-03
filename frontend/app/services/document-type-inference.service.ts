import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface InferredField {
  name: string;
  type: string;
  label: string;
  required: boolean;
  description: string;
  frequency: number;
}

export interface CreatedDocumentType {
  id: number;
  name: string;
  description: string;
  fieldCount: number;
  sampleDocumentCount: number;
  googleDriveFolderId: string;
  folderPath: string;
  fields: InferredField[];
}

export interface InferFromSamplesResponse {
  success: boolean;
  message: string;
  createdTypes: CreatedDocumentType[];
  totalDocumentsProcessed: number;
  totalTypesCreated: number;
}

class DocumentTypeInferenceService {
  /**
   * Infiere tipos de documento desde archivos de ejemplo
   * @param files - Array de archivos (2-10)
   * @param uploadSamples - Si se deben subir los archivos de ejemplo a Drive
   * @returns Tipos creados
   */
  async inferFromSamples(
    files: File[],
    uploadSamples: boolean = false
  ): Promise<InferFromSamplesResponse> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    // Validaciones
    if (!files || files.length < 2) {
      throw new Error('Se requieren al menos 2 archivos');
    }

    if (files.length > 10) {
      throw new Error('Máximo 10 archivos permitidos');
    }

    // Crear FormData
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    // Hacer la solicitud
    const response = await axios.post<InferFromSamplesResponse>(
      `${API_URL}/document-types/infer-from-samples?uploadSamples=${uploadSamples}`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 900000, // 15 minutos (margen extra para 10 documentos con homologación)
      }
    );

    return response.data;
  }
}

export const documentTypeInferenceService = new DocumentTypeInferenceService();

