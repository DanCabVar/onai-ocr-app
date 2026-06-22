import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddR2StorageColumns1762200000000 implements MigrationInterface {
  name = 'AddR2StorageColumns1762200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "storage_key" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "storage_provider" varchar(20) DEFAULT 'google_drive'`,
    );
    const hasGoogleDriveFileId = await queryRunner.hasColumn(
      'documents',
      'google_drive_file_id',
    );

    if (hasGoogleDriveFileId) {
      await queryRunner.query(
        `UPDATE "documents" SET "storage_provider" = 'google_drive' WHERE "storage_provider" IS NULL AND "google_drive_file_id" IS NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" DROP COLUMN IF EXISTS "storage_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP COLUMN IF EXISTS "storage_provider"`,
    );
  }
}
