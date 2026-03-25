import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Global exception filter that converts unhandled errors from AI services
 * into proper HTTP responses instead of generic 500s.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // If it's already an HttpException, let NestJS handle it normally
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(
        typeof body === 'string'
          ? { statusCode: status, message: body }
          : body,
      );
      return;
    }

    // Determine appropriate status from error message
    const error = exception as Error;
    const message = error?.message || 'Error interno del servidor';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    // AI/processing errors → 422
    if (
      message.includes('Gemini') ||
      message.includes('Mistral') ||
      message.includes('OCR') ||
      message.includes('parse') ||
      message.includes('JSON') ||
      message.includes('extract') ||
      message.includes('classify') ||
      message.includes('vision') ||
      message.includes('procesar')
    ) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
    }

    // Config/setup errors → 400
    if (
      message.includes('no está configurada') ||
      message.includes('not configured') ||
      message.includes('No hay tipos')
    ) {
      status = HttpStatus.BAD_REQUEST;
    }

    // Rate limit → 429
    if (message.includes('rate limit') || message.includes('429') || message.includes('quota')) {
      status = HttpStatus.TOO_MANY_REQUESTS;
    }

    this.logger.error(
      `Unhandled exception [${status}]: ${message}`,
      error?.stack,
    );

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status] || 'Error',
    });
  }
}
