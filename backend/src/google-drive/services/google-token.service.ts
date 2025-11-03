import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleToken } from '../../database/entities/google-token.entity';

@Injectable()
export class GoogleTokenService {
  private readonly logger = new Logger(GoogleTokenService.name);

  constructor(
    @InjectRepository(GoogleToken)
    private readonly tokenRepository: Repository<GoogleToken>,
  ) {}

  /**
   * Guarda o actualiza los tokens en la base de datos
   */
  async saveTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn?: number,
    scope?: string,
  ): Promise<GoogleToken> {
    try {
      // Buscar token existente (solo manejamos un token global)
      let token = await this.tokenRepository.findOne({ where: {} });

      const expiresAt = expiresIn
        ? Date.now() + expiresIn * 1000
        : Date.now() + 3600 * 1000; // Default 1 hora

      if (token) {
        // Actualizar token existente
        token.accessToken = accessToken;
        if (refreshToken) {
          token.refreshToken = refreshToken;
        }
        token.expiresAt = expiresAt;
        if (scope) {
          token.scope = scope;
        }
      } else {
        // Crear nuevo token
        token = this.tokenRepository.create({
          accessToken,
          refreshToken,
          expiresAt,
          scope: scope || '',
          tokenType: 'Bearer',
        });
      }

      await this.tokenRepository.save(token);
      this.logger.log('Tokens guardados en base de datos');

      return token;
    } catch (error) {
      this.logger.error('Error guardando tokens', error);
      throw error;
    }
  }

  /**
   * Obtiene el token guardado en la base de datos
   */
  async getToken(): Promise<GoogleToken | null> {
    try {
      const token = await this.tokenRepository.findOne({ where: {} });
      return token;
    } catch (error) {
      this.logger.error('Error obteniendo token', error);
      return null;
    }
  }

  /**
   * Verifica si el token ha expirado
   */
  isTokenExpired(token: GoogleToken): boolean {
    if (!token.expiresAt) {
      return false; // Si no sabemos cuándo expira, asumimos que es válido
    }

    // Agregar buffer de 5 minutos
    const bufferMs = 5 * 60 * 1000;
    return Date.now() >= token.expiresAt - bufferMs;
  }

  /**
   * Elimina el token de la base de datos
   */
  async deleteToken(): Promise<void> {
    try {
      await this.tokenRepository.delete({});
      this.logger.log('Token eliminado de base de datos');
    } catch (error) {
      this.logger.error('Error eliminando token', error);
    }
  }
}

