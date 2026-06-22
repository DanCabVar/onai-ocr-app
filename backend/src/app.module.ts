import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { ChatModule } from './chat/chat.module';
import { DocumentTypesModule } from './document-types/document-types.module';
import { StorageModule } from './storage/storage.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { StripeModule } from './stripe/stripe.module';
import { UsersController } from './users/users.controller';
import { getNestTypeOrmOptions } from './database/typeorm.config';

// GoogleDriveModule removed — R2 (Cloudflare) is the storage provider.

@Module({
  controllers: [UsersController],
  imports: [
    // Configuración de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Configuración de TypeORM (PostgreSQL)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => getNestTypeOrmOptions(__dirname),
    }),

    // Módulos de la aplicación
    AuthModule,
    StorageModule,
    SubscriptionsModule,
    StripeModule,

    DocumentTypesModule,
    DocumentsModule,
    ChatModule,
  ],
})
export class AppModule {}
