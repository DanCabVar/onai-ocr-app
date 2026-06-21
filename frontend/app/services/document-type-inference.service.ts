const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://ocr.moti.cl/api';

export interface ProgressEvent {
  status: 'processing' | 'completed' | 'failed';
  step: string;
  progress_pct: number;
  message: string;
  error?: string;
}

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
  googleDriveFolderId?: string;
  folderPath?: string;
  fields: InferredField[];
}

export interface InferFromSamplesResponse {
  success: boolean;
  message: string;
  createdTypes: CreatedDocumentType[];
  totalDocumentsProcessed: number;
  totalTypesCreated: number;
}

interface InferFromSamplesJobStartResponse {
  jobId: string;
  status: 'processing';
}

interface InferFromSamplesJobStatusResponse {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  step: string;
  progress: number;
  message: string;
  results?: InferFromSamplesResponse;
  error?: string;
}

class DocumentTypeInferenceService {
  private getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }

  private async pollJobUntilFinished(
    jobId: string,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<InferFromSamplesResponse> {
    const pollIntervalMs = 2000;
    const maxAttempts = 450;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const response = await fetch(
        `${API_BASE_URL}/document-types/jobs/${jobId}`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        },
      );

      if (!response.ok) {
        let message = 'Error consultando estado de inferencia';
        try {
          const data = await response.json();
          message = data?.message || message;
        } catch {}
        throw new Error(message);
      }

      const job = (await response.json()) as InferFromSamplesJobStatusResponse;

      onProgress?.({
        status: job.status,
        step: job.step,
        progress_pct: job.progress,
        message: job.message,
        error: job.error,
      });

      if (job.status === 'completed') {
        return (
          job.results || {
            success: true,
            message: job.message || 'Proceso completado',
            createdTypes: [],
            totalDocumentsProcessed: 0,
            totalTypesCreated: 0,
          }
        );
      }

      if (job.status === 'failed') {
        throw new Error(job.error || job.message || 'Error procesando documentos');
      }
    }

    throw new Error('Tiempo de espera agotado procesando inferencia desde muestras');
  }

  async inferFromSamples(
    files: File[],
    uploadSamples: boolean = false,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<InferFromSamplesResponse> {
    if (!files || files.length < 2) {
      throw new Error('Se requieren al menos 2 archivos');
    }

    if (files.length > 10) {
      throw new Error('Máximo 10 archivos permitidos');
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(
      `${API_BASE_URL}/document-types/infer-from-samples?uploadSamples=${uploadSamples}`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: formData,
      },
    );

    if (!response.ok) {
      let message = 'Error iniciando inferencia desde muestras';
      try {
        const data = await response.json();
        message = data?.message || message;
      } catch {}
      throw new Error(message);
    }

    const data = (await response.json()) as InferFromSamplesJobStartResponse;

    onProgress?.({
      status: 'processing',
      step: 'queued',
      progress_pct: 0,
      message: 'En cola...',
    });

    return this.pollJobUntilFinished(data.jobId, onProgress);
  }

  async inferFromSamplesWithProgress(
    files: File[],
    uploadSamples: boolean = false,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<InferFromSamplesResponse> {
    return this.inferFromSamples(files, uploadSamples, onProgress);
  }
}

export const documentTypeInferenceService = new DocumentTypeInferenceService();
