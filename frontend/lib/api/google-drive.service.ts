import { apiClient } from './client';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export interface GoogleDriveFolder {
  folderId: string;
  filesCount: number;
  files: GoogleDriveFile[];
}

export interface GoogleAuthStatus {
  authenticated: boolean;
  hasAccessToken: boolean;
  message: string;
}

export const googleDriveService = {
  // Verificar estado de autenticación
  async getAuthStatus(): Promise<GoogleAuthStatus> {
    const response = await apiClient.get<GoogleAuthStatus>('/google/status');
    return response.data;
  },

  // Listar archivos en la carpeta raíz
  async listRootFiles(): Promise<GoogleDriveFolder> {
    const response = await apiClient.get<GoogleDriveFolder>('/google/files');
    return response.data;
  },

  // Listar archivos en una carpeta específica
  async listFolderFiles(folderId: string): Promise<GoogleDriveFolder> {
    const response = await apiClient.get<GoogleDriveFolder>(`/google/files/${folderId}`);
    return response.data;
  },

  // Obtener URL de autenticación
  getAuthUrl(): string {
    return `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/api/google/auth`;
  },
};

