-- =====================================================
-- MIGRACIÓN: Agregar CASCADE DELETE a la tabla documents
-- =====================================================
-- 
-- Esta migración agrega eliminación en cascada para que cuando
-- se elimine un tipo de documento (document_types), también se
-- eliminen automáticamente todos los documentos asociados.
--
-- IMPORTANTE: Ejecutar este script en la base de datos PostgreSQL
-- antes de usar la nueva funcionalidad de eliminación en cascada.
-- =====================================================

-- Paso 1: Verificar las restricciones actuales (opcional, para referencia)
-- SELECT constraint_name, table_name, column_name
-- FROM information_schema.key_column_usage
-- WHERE table_name = 'documents' AND column_name = 'document_type_id';

-- Paso 2: Eliminar la restricción de clave foránea existente
-- Intentamos varios nombres posibles de la restricción
DO $$
BEGIN
    -- Intentar con diferentes nombres posibles
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS "FK_documents_document_type_id";
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS "FK_8ce1e1eeb6ebbe1edbf03cfdb09";
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS "fk_documents_document_type";
    
    -- Si ninguna de las anteriores funciona, buscar la restricción automáticamente
    EXECUTE (
        SELECT 'ALTER TABLE documents DROP CONSTRAINT IF EXISTS "' || constraint_name || '";'
        FROM information_schema.table_constraints
        WHERE table_name = 'documents'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%document_type%'
        LIMIT 1
    );
END $$;

-- Paso 3: Crear la nueva restricción con ON DELETE CASCADE
ALTER TABLE documents 
ADD CONSTRAINT "FK_documents_document_type_id" 
FOREIGN KEY ("document_type_id") 
REFERENCES "document_types"("id") 
ON DELETE CASCADE;

-- Verificación (opcional)
-- SELECT 
--     tc.constraint_name, 
--     tc.table_name, 
--     kcu.column_name, 
--     rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--     ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.referential_constraints rc
--     ON tc.constraint_name = rc.constraint_name
-- WHERE tc.table_name = 'documents' 
--   AND tc.constraint_type = 'FOREIGN KEY'
--   AND kcu.column_name = 'document_type_id';

-- Resultado esperado: delete_rule = 'CASCADE'

COMMIT;

