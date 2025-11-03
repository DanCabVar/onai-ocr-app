import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Habilitar CORS
  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL') || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

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

