import axios from 'axios';

// Use relative URL so requests go to the same origin (proxied by Next.js rewrites)
const API_URL = '/api';

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

export interface ProgressEvent {
  step: string;
  progress_pct: number;
  message: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  step: string;
  progress: number;
  message: string;
  results?: InferFromSamplesResponse;
  error?: string;
}

const POLL_INTERVAL_MS = 2000;

class DocumentTypeInferenceService {
  /**
   * Starts the inference job and returns the jobId.
   */
  private async startJob(
    files: File[],
    uploadSamples: boolean,
  ): Promise<string> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await axios.post<{ jobId: string; status: string }>(
      `${API_URL}/document-types/infer-from-samples?uploadSamples=${uploadSamples}`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60s is plenty — the POST returns immediately now
      },
    );

    return response.data.jobId;
  }

  /**
   * Polls job status.
   */
  private async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const response = await axios.get<JobStatusResponse>(
      `${API_URL}/document-types/jobs/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        timeout: 10000,
      },
    );

    return response.data;
  }

  /**
   * Infiere tipos de documento desde archivos de ejemplo.
   * POST → get jobId → poll GET every 2s → return results.
   */
  async inferFromSamples(
    files: File[],
    uploadSamples: boolean = false,
  ): Promise<InferFromSamplesResponse> {
    return this.inferFromSamplesWithProgress(files, uploadSamples);
  }

  /**
   * Infiere tipos con progreso en tiempo real via polling.
   *
   * @param files - Array of files (2-10)
   * @param uploadSamples - Whether to upload sample files
   * @param onProgress - Callback for progress updates
   * @returns Final response with created types
   */
  async inferFromSamplesWithProgress(
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

    // Step 1: Start the job
    const jobId = await this.startJob(files, uploadSamples);

    // Step 2: Poll for status
    return new Promise<InferFromSamplesResponse>((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getJobStatus(jobId);

          // Report progress
          if (onProgress) {
            onProgress({
              step: status.step,
              progress_pct: status.progress,
              message: status.message,
            });
          }

          if (status.status === 'completed' && status.results) {
            resolve(status.results);
            return;
          }

          if (status.status === 'failed') {
            reject(new Error(status.error || 'Error en el procesamiento'));
            return;
          }

          // Still processing — poll again
          setTimeout(poll, POLL_INTERVAL_MS);
        } catch (error: any) {
          // Network errors during polling — retry a few times
          if (error.code === 'ECONNABORTED' || error.response?.status >= 500) {
            console.warn('Poll error, retrying...', error.message);
            setTimeout(poll, POLL_INTERVAL_MS * 2);
            return;
          }
          reject(error);
        }
      };

      // Start polling after a short delay (give backend time to start)
      setTimeout(poll, 1000);
    });
  }
}

export const documentTypeInferenceService = new DocumentTypeInferenceService();
