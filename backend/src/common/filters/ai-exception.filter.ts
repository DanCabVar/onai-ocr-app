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

    const error = exception as Error;
    const message = error?.message || 'Error interno del servidor';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    // AI/processing errors → 422
    if (/Gemini|Mistral|OCR|parse|JSON|extract|classify|vision|procesar/i.test(message)) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
    }

    // Config errors → 400
    if (/no está configurada|not configured|No hay tipos/i.test(message)) {
      status = HttpStatus.BAD_REQUEST;
    }

    // Rate limit → 429
    if (/rate.limit|429|quota/i.test(message)) {
      status = HttpStatus.TOO_MANY_REQUESTS;
    }

    this.logger.error(`Unhandled [${status}]: ${message}`, error?.stack);

    response.status(status).json({
      statusCode: status,
      message,
      error: HttpStatus[status] || 'Error',
    });
  }
}
