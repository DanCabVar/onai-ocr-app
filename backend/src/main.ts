import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification
  });

  const configService = app.get(ConfigService);

  // Habilitar CORS — accept both landing and app domains
  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  const landingUrl = configService.get<string>('LANDING_URL');
  const appUrlEnv = configService.get<string>('APP_URL');
  const allowedOrigins = [frontendUrl];
  if (landingUrl) allowedOrigins.push(landingUrl);
  if (appUrlEnv) allowedOrigins.push(appUrlEnv);
  // Deduplicate
  const uniqueOrigins = [...new Set(allowedOrigins)];

  app.enableCors({
    origin: uniqueOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Filtro global para errores de Multer (archivo muy grande, formato inválido, etc.)
  app.useGlobalFilters(new MulterExceptionFilter());

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Prefijo global para las rutas
  app.setGlobalPrefix('api');

  const port = configService.get<number>('PORT') || 4000;
  await app.listen(port);

  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
  console.log(`📚 API disponible en http://localhost:${port}/api`);
  console.log(`🔐 Endpoints de autenticación:`);
  console.log(`   - POST http://localhost:${port}/api/auth/register`);
  console.log(`   - POST http://localhost:${port}/api/auth/login`);
  console.log(`   - GET  http://localhost:${port}/api/auth/profile`);
  console.log(`☁️  Endpoints de Google Drive:`);
  console.log(`   - GET  http://localhost:${port}/api/google/auth (Autorizar con Google)`);
  console.log(`   - GET  http://localhost:${port}/api/google/callback (OAuth callback)`);
  console.log(`   - GET  http://localhost:${port}/api/google/status (Verificar autenticación)`);
  console.log(`   - GET  http://localhost:${port}/api/google/files (Listar carpeta raíz)`);
  console.log(`📋 Endpoints de tipos de documento:`);
  console.log(`   - POST http://localhost:${port}/api/document-types (Crea carpeta en Drive)`);
  console.log(`   - GET  http://localhost:${port}/api/document-types`);
  console.log(`   - GET  http://localhost:${port}/api/document-types/:id`);
  console.log(`   - PATCH http://localhost:${port}/api/document-types/:id`);
  console.log(`   - DELETE http://localhost:${port}/api/document-types/:id`);
  console.log(`📄 Endpoints de documentos (con AI Pipeline):`);
  console.log(`   - POST http://localhost:${port}/api/documents/upload (OCR + Clasificación + Extracción)`);
  console.log(`   - GET  http://localhost:${port}/api/documents`);
  console.log(`   - GET  http://localhost:${port}/api/documents/:id`);
  console.log(`   - DELETE http://localhost:${port}/api/documents/:id (Elimina de BD, no de Drive)`);
  console.log(`💬 Endpoints de chat:`);
  console.log(`   - POST http://localhost:${port}/api/chat/query`);
}

bootstrap();

