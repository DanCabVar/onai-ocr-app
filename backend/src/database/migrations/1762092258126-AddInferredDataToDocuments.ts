import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInferredDataToDocuments1762092258126 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "documents" 
            ADD COLUMN "inferred_data" jsonb NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "documents" 
            DROP COLUMN "inferred_data"
        `);
    }

}
