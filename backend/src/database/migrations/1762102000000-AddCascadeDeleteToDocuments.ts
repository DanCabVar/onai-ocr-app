import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCascadeDeleteToDocuments1762102000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Eliminar la restricción de clave foránea existente
        await queryRunner.query(`
            ALTER TABLE "documents" 
            DROP CONSTRAINT IF EXISTS "FK_documents_document_type_id"
        `);

        // 2. Crear la nueva restricción con ON DELETE CASCADE
        await queryRunner.query(`
            ALTER TABLE "documents" 
            ADD CONSTRAINT "FK_documents_document_type_id" 
            FOREIGN KEY ("document_type_id") 
            REFERENCES "document_types"("id") 
            ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revertir el cambio: eliminar CASCADE
        await queryRunner.query(`
            ALTER TABLE "documents" 
            DROP CONSTRAINT IF EXISTS "FK_documents_document_type_id"
        `);

        // Recrear la restricción sin CASCADE
        await queryRunner.query(`
            ALTER TABLE "documents" 
            ADD CONSTRAINT "FK_documents_document_type_id" 
            FOREIGN KEY ("document_type_id") 
            REFERENCES "document_types"("id")
        `);
    }

}

