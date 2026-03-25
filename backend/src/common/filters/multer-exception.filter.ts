import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  PayloadTooLargeException,
} from '@nestjs/common';
import { MulterError } from 'multer';
import { Response } from 'express';

/**
 * Captura errores de Multer (ej: archivo muy grande) y los convierte
 * en respuestas HTTP con status codes apropiados y mensajes en español.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception.code === 'LIMIT_FILE_SIZE') {
      response.status(413).json({
        statusCode: 413,
        message: 'El archivo excede el tamaño máximo permitido de 10MB.',
        error: 'Payload Too Large',
      });
      return;
    }

    if (exception.code === 'LIMIT_UNEXPECTED_FILE') {
      response.status(400).json({
        statusCode: 400,
        message: 'Campo de archivo inesperado. Usa el campo "file" para subir documentos.',
        error: 'Bad Request',
      });
      return;
    }

    // Otros errores de Multer
    response.status(400).json({
      statusCode: 400,
      message: `Error al procesar el archivo: ${exception.message}`,
      error: 'Bad Request',
    });
  }
}
