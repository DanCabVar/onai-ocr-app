import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QueryDto } from './dto/query.dto';
import { User } from '../database/entities/user.entity';

@Injectable()
export class ChatService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async getQueryResponse(queryDto: QueryDto, user: User) {
    const { query } = queryDto;

    try {
      // Obtener URL del webhook de n8n para RAG
      const n8nWebhookUrl = this.configService.get<string>('N8N_WEBHOOK_RAG');

      if (!n8nWebhookUrl) {
        throw new InternalServerErrorException(
          'Webhook de RAG no configurado',
        );
      }

      // Enviar consulta a n8n con el userId para filtrar documentos
      const response = await firstValueFrom(
        this.httpService.post(
          n8nWebhookUrl,
          {
            query,
            userId: user.id,
            userEmail: user.email,
          },
          {
            timeout: 30000, // 30 segundos
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return {
        response: response.data.response || 'No se pudo procesar la consulta',
        executedQuery: response.data.executedQuery,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error al consultar RAG:', error.message);
      
      // Si es un error de timeout
      if (error.code === 'ECONNABORTED') {
        throw new InternalServerErrorException(
          'La consulta tardó demasiado tiempo. Por favor, intenta con una pregunta más específica.',
        );
      }

      throw new InternalServerErrorException(
        'Error al procesar la consulta. Por favor, intenta nuevamente.',
      );
    }
  }
}

