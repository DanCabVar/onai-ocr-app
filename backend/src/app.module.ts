import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { ChatModule } from './chat/chat.module';
import { DocumentTypesModule } from './document-types/document-types.module';
import { GoogleDriveModule } from './google-drive/google-drive.module';
import { User } from './database/entities/user.entity';
import { Document } from './database/entities/document.entity';
import { DocumentType } from './database/entities/document-type.entity';
import { GoogleToken } from './database/entities/google-token.entity';

@Module({
  imports: [
    // Configuración de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Configuración de TypeORM (PostgreSQL)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USER'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        entities: [User, Document, DocumentType, GoogleToken],
        synchronize: true, // ⚠️ Solo para desarrollo, desactivar en producción
        logging: false,
      }),
    }),

    // Módulos de la aplicación
    AuthModule,
    GoogleDriveModule,
    DocumentTypesModule,
    DocumentsModule,
    ChatModule,
  ],
})
export class AppModule {}

