import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth } from 'googleapis';
import { GoogleTokenService } from './google-token.service';

@Injectable()
export class GoogleAuthService implements OnModuleInit {
  private readonly logger = new Logger(GoogleAuthService.name);
  private oauth2Client: Auth.OAuth2Client;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(
    private configService: ConfigService,
    private googleTokenService: GoogleTokenService,
  ) {
    this.initializeOAuth2Client();
  }

  async onModuleInit() {
    // Cargar tokens guardados al iniciar el módulo
    await this.loadTokensFromDatabase();
  }

  private initializeOAuth2Client() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    this.logger.log('OAuth2 client initialized');
  }

  /**
   * Carga los tokens guardados de la base de datos
   */
  private async loadTokensFromDatabase() {
    try {
      const savedToken = await this.googleTokenService.getToken();

      if (!savedToken) {
        this.logger.log('No hay tokens guardados en la base de datos');
        return;
      }

      // Verificar si el token ha expirado
      if (this.googleTokenService.isTokenExpired(savedToken)) {
        this.logger.log('Token expirado, intentando refrescar...');
        
        if (savedToken.refreshToken) {
          this.refreshToken = savedToken.refreshToken;
          this.oauth2Client.setCredentials({
            refresh_token: savedToken.refreshToken,
          });

          try {
            await this.refreshAccessToken();
            this.logger.log('Token refrescado exitosamente');
          } catch (error) {
            this.logger.error('Error al refrescar token', error);
            await this.googleTokenService.deleteToken();
          }
        } else {
          this.logger.warn('Token expirado y no hay refresh token');
          await this.googleTokenService.deleteToken();
        }
      } else {
        // Token aún válido
        this.accessToken = savedToken.accessToken;
        this.refreshToken = savedToken.refreshToken;

        this.oauth2Client.setCredentials({
          access_token: savedToken.accessToken,
          refresh_token: savedToken.refreshToken,
        });

        this.logger.log('Tokens cargados desde base de datos');
      }
    } catch (error) {
      this.logger.error('Error cargando tokens de base de datos', error);
    }
  }

  /**
   * Genera la URL de autorización para que el usuario autorice la aplicación
   */
  getAuthUrl(): string {
    const scopes = this.configService
      .get<string>('GOOGLE_SCOPES')
      .split(',');

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Fuerza a mostrar la pantalla de consentimiento
    });

    this.logger.log('Generated auth URL');
    return authUrl;
  }

  /**
   * Intercambia el código de autorización por tokens de acceso
   */
  async getTokensFromCode(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
  }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      this.accessToken = tokens.access_token;
      if (tokens.refresh_token) {
        this.refreshToken = tokens.refresh_token;
      }

      // Configurar las credenciales en el cliente
      this.oauth2Client.setCredentials(tokens);

      // Guardar tokens en base de datos
      await this.googleTokenService.saveTokens(
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date ? (tokens.expiry_date - Date.now()) / 1000 : undefined,
        tokens.scope,
      );

      this.logger.log('Tokens obtained, set, and saved to database successfully');

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      };
    } catch (error) {
      this.logger.error('Error getting tokens from code', error);
      throw error;
    }
  }

  /**
   * Retorna el cliente OAuth2 configurado
   */
  getOAuth2Client(): Auth.OAuth2Client {
    return this.oauth2Client;
  }

  /**
   * Verifica si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Retorna el token de acceso actual
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Configura manualmente los tokens (útil si se guardan en BD)
   */
  setTokens(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }

    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.logger.log('Tokens set manually');
  }

  /**
   * Refresca el token de acceso usando el refresh token
   */
  async refreshAccessToken(): Promise<string> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.accessToken = credentials.access_token;
      
      // Si hay nuevo refresh token, actualizarlo
      if (credentials.refresh_token) {
        this.refreshToken = credentials.refresh_token;
      }

      this.oauth2Client.setCredentials(credentials);

      // Guardar tokens actualizados en base de datos
      await this.googleTokenService.saveTokens(
        credentials.access_token,
        credentials.refresh_token || this.refreshToken,
        credentials.expiry_date ? (credentials.expiry_date - Date.now()) / 1000 : undefined,
        credentials.scope,
      );

      this.logger.log('Access token refreshed and saved to database');
      return credentials.access_token;
    } catch (error) {
      this.logger.error('Error refreshing access token', error);
      throw error;
    }
  }
}

