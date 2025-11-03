import { apiClient } from './client';

export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  label: string;
  required: boolean;
  description?: string;
}

export interface DocumentType {
  id: number;
  name: string;
  description?: string;
  fieldSchema: {
    fields: FieldDefinition[];
  };
  folderPath?: string;
  googleDriveFolderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentTypeDto {
  name: string;
  description?: string;
  fields: FieldDefinition[];
}

export interface UpdateDocumentTypeDto {
  name?: string;
  description?: string;
  fields?: FieldDefinition[];
}

export const documentTypesService = {
  // Crear tipo de documento
  async create(data: CreateDocumentTypeDto): Promise<DocumentType> {
    const response = await apiClient.post<DocumentType>('/document-types', data);
    return response.data;
  },

  // Listar todos los tipos
  async getAll(): Promise<DocumentType[]> {
    const response = await apiClient.get<DocumentType[]>('/document-types');
    return response.data;
  },

  // Obtener un tipo por ID
  async getById(id: number): Promise<DocumentType> {
    const response = await apiClient.get<DocumentType>(`/document-types/${id}`);
    return response.data;
  },

  // Actualizar tipo
  async update(id: number, data: UpdateDocumentTypeDto): Promise<DocumentType> {
    const response = await apiClient.patch<DocumentType>(`/document-types/${id}`, data);
    return response.data;
  },

  // Eliminar tipo
  async delete(id: number): Promise<{ 
    message: string; 
    warning?: string;
    googleDriveFolderId?: string;
    folderPath?: string;
  }> {
    const response = await apiClient.delete<{ 
      message: string; 
      warning?: string;
      googleDriveFolderId?: string;
      folderPath?: string;
    }>(`/document-types/${id}`);
    return response.data;
  },
};

