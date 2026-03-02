import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

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

class DocumentTypeInferenceService {
  /**
   * Infiere tipos de documento desde archivos de ejemplo.
   * Uses the standard POST endpoint (NestJS proxies to Python processor).
   */
  async inferFromSamples(
    files: File[],
    uploadSamples: boolean = false
  ): Promise<InferFromSamplesResponse> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

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

    const response = await axios.post<InferFromSamplesResponse>(
      `${API_URL}/document-types/infer-from-samples?uploadSamples=${uploadSamples}`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        timeout: 900000, // 15 minutes
      }
    );

    return response.data;
  }

  /**
   * Infiere tipos con progreso en tiempo real via SSE.
   * Calls the Python processor's /process-batch-stream endpoint directly
   * for real-time progress updates.
   *
   * @param files - Array of files (2-10)
   * @param uploadSamples - Whether to upload sample files to Drive
   * @param onProgress - Callback for progress updates
   * @returns Final response with created types
   */
  async inferFromSamplesWithProgress(
    files: File[],
    uploadSamples: boolean = false,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<InferFromSamplesResponse> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    if (!files || files.length < 2) {
      throw new Error('Se requieren al menos 2 archivos');
    }

    // Try SSE streaming first, fallback to standard POST
    try {
      return await this._streamFromProcessor(files, uploadSamples, onProgress);
    } catch (sseError) {
      console.warn('SSE streaming failed, falling back to standard POST:', sseError);
      return this.inferFromSamples(files, uploadSamples);
    }
  }

  private async _streamFromProcessor(
    files: File[],
    uploadSamples: boolean,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<InferFromSamplesResponse> {
    const token = localStorage.getItem('auth_token');

    // Build the form data for the SSE endpoint
    // This goes through the NestJS backend which proxies to the processor
    const formData = new FormData();
    formData.append('user_id', '1'); // Will be overridden by JWT user
    formData.append('upload_samples', String(uploadSamples));
    files.forEach((file) => {
      formData.append('files', file);
    });

    // Use fetch for SSE (axios doesn't support streaming well)
    const response = await fetch(
      `${API_URL}/document-types/infer-from-samples?uploadSamples=${uploadSamples}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // If the response is SSE (text/event-stream), parse events
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      return this._parseSSEResponse(response, onProgress);
    }

    // Standard JSON response (fallback)
    return response.json();
  }

  private async _parseSSEResponse(
    response: Response,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<InferFromSamplesResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No readable stream available');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult: InferFromSamplesResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      let eventData = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          eventData = line.slice(6);
        } else if (line === '' && eventData) {
          // End of event
          try {
            const parsed = JSON.parse(eventData);

            if (eventType === 'progress' && onProgress) {
              onProgress(parsed as ProgressEvent);
            } else if (eventType === 'complete') {
              finalResult = parsed as InferFromSamplesResponse;
            } else if (eventType === 'error') {
              throw new Error(parsed.error || 'Error en el procesamiento');
            }
          } catch (parseError) {
            if (eventType === 'error') throw parseError;
            console.warn('Failed to parse SSE event:', eventData);
          }

          eventType = '';
          eventData = '';
        }
      }
    }

    if (finalResult) {
      return finalResult;
    }

    throw new Error('Stream ended without a complete event');
  }
}

export const documentTypeInferenceService = new DocumentTypeInferenceService();
