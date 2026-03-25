import { apiClient } from './client';

export interface ChatQueryResponse {
  answer: string;
  query?: string;
  data?: Record<string, any>[];
}

export const chatService = {
  /**
   * Send a natural language question to the RAG SQL chat endpoint.
   * POST /api/chat/query  { query: string }
   */
  async query(question: string): Promise<ChatQueryResponse> {
    const response = await apiClient.post<ChatQueryResponse>('/chat/query', {
      query: question,
    });
    return response.data;
  },
};
