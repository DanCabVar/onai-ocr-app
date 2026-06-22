import { apiClient } from './client';

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatQueryResponse {
  answer: string;
  query?: string;
  data?: Record<string, any>[];
}

export const chatService = {
  async query(
    question: string,
    history: ChatHistoryMessage[] = [],
  ): Promise<ChatQueryResponse> {
    const response = await apiClient.post<ChatQueryResponse>('/chat/query', {
      query: question,
      history,
    });
    return response.data;
  },
};
