import { Controller, Get, Query, Res, HttpStatus, Delete, Param } from '@nestjs/common';
import { Response } from 'express';
import { GoogleAuthService } from './services/google-auth.service';
import { GoogleDriveService } from './services/google-drive.service';

@Controller('google')
export class GoogleController {
  constructor(
    private googleAuthService: GoogleAuthService,
    private googleDriveService: GoogleDriveService,
  ) {}

  /**
   * Inicia el flujo de autenticación OAuth de Google
   * GET /api/google/auth
   */
  @Get('auth')
  async googleAuth(@Res() res: Response) {
    const authUrl = this.googleAuthService.getAuthUrl();
    return res.redirect(authUrl);
  }

  /**
   * Callback de Google OAuth
   * GET /api/google/callback?code=...
   */
  @Get('callback')
  async googleAuthCallback(
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    try {
      if (!code) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: 'Código de autorización no proporcionado',
        });
      }

      // Intercambia el código por tokens
      const tokens = await this.googleAuthService.getTokensFromCode(code);

      // Redirige al frontend con éxito
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Autenticación Exitosa</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                background: white;
                padding: 3rem;
                border-radius: 1rem;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 500px;
              }
              .success-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
              }
              h1 {
                color: #667eea;
                margin-bottom: 1rem;
              }
              p {
                color: #666;
                margin-bottom: 2rem;
              }
              .btn {
                background: #667eea;
                color: white;
                padding: 0.75rem 2rem;
                border: none;
                border-radius: 0.5rem;
                font-size: 1rem;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
              }
              .btn:hover {
                background: #5568d3;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>¡Autenticación Exitosa!</h1>
              <p>
                Tu cuenta de Google Drive ha sido conectada correctamente.
                Ahora puedes crear tipos de documento y las carpetas se crearán automáticamente.
              </p>
              <a href="http://localhost:3000/document-types" class="btn">
                Ir a Tipos de Documento
              </a>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Error al autenticar con Google',
        error: error.message,
      });
    }
  }

  /**
   * Verifica el estado de autenticación
   * GET /api/google/status
   */
  @Get('status')
  async getAuthStatus() {
    const isAuthenticated = this.googleAuthService.isAuthenticated();
    const accessToken = this.googleAuthService.getAccessToken();

    return {
      authenticated: isAuthenticated,
      hasAccessToken: !!accessToken,
      message: isAuthenticated
        ? 'Usuario autenticado con Google Drive'
        : 'Usuario no autenticado. Visita /api/google/auth',
    };
  }

  /**
   * Lista archivos de la carpeta raíz
   * GET /api/google/files
   */
  @Get('files')
  async listRootFiles() {
    try {
      const rootFolderId = this.googleDriveService.getRootFolderId();
      const files = await this.googleDriveService.listFilesInFolder(
        rootFolderId,
      );

      return {
        folderId: rootFolderId,
        filesCount: files.length,
        files: files,
      };
    } catch (error) {
      return {
        message: error.message,
        error: true,
      };
    }
  }

  /**
   * Lista archivos de una carpeta específica
   * GET /api/google/files/:folderId
   */
  @Get('files/:folderId')
  async listFolderFiles(@Param('folderId') folderId: string) {
    try {
      const files = await this.googleDriveService.listFilesInFolder(folderId);

      return {
        folderId,
        filesCount: files.length,
        files: files,
      };
    } catch (error) {
      return {
        message: error.message,
        error: true,
      };
    }
  }

  /**
   * Elimina una carpeta/archivo de Google Drive
   * DELETE /api/google/folder/:folderId?checkEmpty=true
   */
  @Delete('folder/:folderId')
  async deleteFolder(
    @Param('folderId') folderId: string,
    @Query('checkEmpty') checkEmpty?: string,
  ) {
    try {
      const shouldCheckEmpty = checkEmpty === 'true';
      await this.googleDriveService.deleteFile(folderId, shouldCheckEmpty);

      return {
        message: 'Carpeta eliminada exitosamente de Google Drive',
        folderId,
      };
    } catch (error) {
      return {
        message: error.message,
        error: true,
      };
    }
  }
}

