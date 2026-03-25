import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export interface UploadResult {
  key: string;
  bucket: string;
  size: number;
}

export interface StorageFile {
  key: string;
  size: number;
  lastModified: Date;
  filename: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.bucket = this.configService.get<string>('R2_BUCKET');
    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
    const region = this.configService.get<string>('R2_REGION') || 'auto';

    if (!this.bucket || !endpoint || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'R2 storage not fully configured. Set R2_BUCKET, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY env vars.',
      );
      return;
    }

    this.s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // R2 requires path-style
      forcePathStyle: true,
    });

    this.logger.log(`R2 Storage initialized — bucket: ${this.bucket}, endpoint: ${endpoint}`);
  }

  /**
   * Build the object key following multi-tenant convention:
   *   {userId}/originals/{filename}
   *   {userId}/extracted/{docId}.json
   */
  buildKey(userId: number, folder: 'originals' | 'extracted', filename: string): string {
    return `${userId}/${folder}/${filename}`;
  }

  /**
   * Build a type-organized storage key:
   *   {userId}/tipos/{tipoSlug}/{filename}
   * Used for batch processing to organize files by document type.
   */
  buildTypedKey(userId: number, typeName: string, filename: string): string {
    const slug = this.slugify(typeName);
    return `${userId}/tipos/${slug}/${filename}`;
  }

  /**
   * Convert a type name to a URL-safe slug.
   * "Factura de Venta" → "factura-de-venta"
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]+/g, '-')     // non-alphanumeric → dash
      .replace(/^-+|-+$/g, '');         // trim leading/trailing dashes
  }

  /**
   * Upload a file (Buffer) to R2.
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    mimeType: string,
  ): Promise<UploadResult> {
    this.logger.log(`Uploading ${key} (${(buffer.length / 1024).toFixed(1)} KB)`);

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    this.logger.log(`✅ Uploaded: ${key}`);

    return {
      key,
      bucket: this.bucket,
      size: buffer.length,
    };
  }

  /**
   * Download a file from R2 and return it as a Buffer.
   */
  async downloadFile(key: string): Promise<Buffer> {
    this.logger.log(`Downloading ${key}`);

    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  /**
   * Delete a file from R2.
   */
  async deleteFile(key: string): Promise<void> {
    this.logger.log(`Deleting ${key}`);

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.log(`✅ Deleted: ${key}`);
  }

  /**
   * Generate a presigned URL for reading a file (default 1 hour).
   */
  async getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const url = await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds },
    );

    return url;
  }

  /**
   * Generate a presigned URL for uploading a file (default 15 min).
   */
  async getPresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds = 900,
  ): Promise<string> {
    const url = await getSignedUrl(
      this.s3Client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      }),
      { expiresIn: expiresInSeconds },
    );

    return url;
  }

  /**
   * List all files for a given user, optionally filtered by folder.
   */
  async listUserFiles(
    userId: number,
    folder?: 'originals' | 'extracted',
  ): Promise<StorageFile[]> {
    const prefix = folder ? `${userId}/${folder}/` : `${userId}/`;

    this.logger.log(`Listing files with prefix: ${prefix}`);

    const response = await this.s3Client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      }),
    );

    if (!response.Contents) {
      return [];
    }

    return response.Contents.map((obj) => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      filename: obj.Key.split('/').pop(),
    }));
  }
}
