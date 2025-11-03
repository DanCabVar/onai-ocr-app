import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleAuthService } from './services/google-auth.service';
import { GoogleDriveService } from './services/google-drive.service';
import { GoogleTokenService } from './services/google-token.service';
import { GoogleController } from './google.controller';
import { GoogleToken } from '../database/entities/google-token.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([GoogleToken])],
  controllers: [GoogleController],
  providers: [GoogleAuthService, GoogleDriveService, GoogleTokenService],
  exports: [GoogleAuthService, GoogleDriveService],
})
export class GoogleDriveModule {}

