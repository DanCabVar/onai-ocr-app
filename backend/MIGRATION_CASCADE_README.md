# 🔄 Migración: Eliminación en Cascada de Documentos

## 📋 ¿Qué hace esta migración?

Agrega **eliminación en cascada** (`ON DELETE CASCADE`) a la relación entre `documents` y `document_types`.

### **Antes:**
❌ No se podía eliminar un tipo de documento si tenía documentos asociados
❌ Aparecía error: _"No se puede eliminar el tipo de documento porque tiene X documento(s) asociado(s)"_
❌ Había que eliminar los documentos manualmente uno por uno

### **Después:**
✅ Al eliminar un tipo de documento, **automáticamente se eliminan todos los documentos asociados** en la base de datos
✅ Eliminación rápida y sin errores
✅ La carpeta de Google Drive se mantiene intacta por seguridad (eliminación manual)

---

## 🚀 Cómo Ejecutar la Migración

### **Opción 1: Script Automático (PowerShell) - RECOMENDADO**

```powershell
cd backend
.\run-cascade-migration.ps1
```

Este script:
- Lee automáticamente las credenciales del archivo `.env`
- Ejecuta la migración SQL
- Muestra mensajes de éxito o error

---

### **Opción 2: Ejecución Manual con psql**

Si el script automático falla o prefieres ejecutarlo manualmente:

```bash
# 1. Navegar a la carpeta backend
cd backend

# 2. Ejecutar la migración con psql
psql -h localhost -p 5432 -U postgres -d onai_ocr -f MIGRATION_CASCADE_DELETE.sql

# (Reemplaza los valores según tu configuración)
```

---

### **Opción 3: Usando un Cliente SQL (DBeaver, pgAdmin, TablePlus)**

1. Abre tu cliente SQL favorito
2. Conéctate a la base de datos `onai_ocr`
3. Abre el archivo `MIGRATION_CASCADE_DELETE.sql`
4. Ejecuta todo el script

---

## ✅ Verificar que la Migración Funcionó

Después de ejecutar la migración, verifica que el CASCADE esté configurado:

```sql
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'documents' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'document_type_id';
```

**Resultado esperado:**
```
constraint_name                | table_name | column_name      | delete_rule
-------------------------------|------------|------------------|------------
FK_documents_document_type_id  | documents  | document_type_id | CASCADE
```

Si ves `delete_rule = 'CASCADE'`, la migración fue exitosa ✅

---

## ⚠️ IMPORTANTE: Advertencias

### **1. Los documentos asociados se eliminarán de la BD**
Cuando elimines un tipo de documento, **TODOS** los documentos de ese tipo se eliminarán **permanentemente** de la base de datos.

### **2. Los archivos en Google Drive NO se eliminan**
Por seguridad, la carpeta y los archivos en Google Drive **no se eliminan automáticamente**. Deberás:
- Eliminarlos manualmente desde Google Drive si lo deseas
- O conservarlos como respaldo

### **3. Acción irreversible**
Una vez eliminados los documentos de la BD, **no se pueden recuperar** (a menos que tengas un backup).

---

## 🔄 Revertir la Migración (si es necesario)

Si por alguna razón necesitas revertir el CASCADE:

```sql
-- Eliminar la restricción con CASCADE
ALTER TABLE documents DROP CONSTRAINT IF EXISTS "FK_documents_document_type_id";

-- Recrear la restricción sin CASCADE
ALTER TABLE documents 
ADD CONSTRAINT "FK_documents_document_type_id" 
FOREIGN KEY ("document_type_id") 
REFERENCES "document_types"("id");
```

Esto volverá al comportamiento anterior donde NO se pueden eliminar tipos con documentos asociados.

---

## 📝 Cambios en el Código

### **1. Entidad `Document` (`document.entity.ts`)**
```typescript
@ManyToOne(() => DocumentType, (documentType) => documentType.documents, { 
  nullable: true, 
  onDelete: 'CASCADE' // ← AGREGADO
})
```

### **2. Servicio `DocumentTypesService` (`document-types.service.ts`)**
- ✅ Removida la validación que impedía la eliminación
- ✅ Agregado contador de documentos que serán eliminados
- ✅ Agregadas advertencias al usuario sobre la eliminación en cascada

---

## 🧪 Cómo Probar

1. **Ejecutar la migración** (usando cualquiera de las 3 opciones)
2. **Crear un tipo de documento de prueba**
3. **Subir 2-3 documentos de ese tipo**
4. **Intentar eliminar el tipo de documento**
5. **Verificar:**
   - ✅ El tipo se elimina sin errores
   - ✅ Los documentos asociados desaparecen de la BD
   - ✅ La carpeta de Drive sigue existiendo (si la había)

---

## 🆘 Solución de Problemas

### **Error: "psql: command not found"**
- **Causa:** PostgreSQL no está instalado o no está en el PATH
- **Solución:** 
  - Instala PostgreSQL: https://www.postgresql.org/download/
  - O usa la Opción 3 (cliente SQL gráfico)

### **Error: "FATAL: password authentication failed"**
- **Causa:** Credenciales incorrectas en el `.env`
- **Solución:** Verifica `DB_USERNAME` y `DB_PASSWORD` en tu archivo `.env`

### **Error: "relation does not exist"**
- **Causa:** El nombre de la tabla o columna no coincide
- **Solución:** Verifica que las tablas `documents` y `document_types` existan

---

## 📞 ¿Necesitas Ayuda?

Si tienes problemas ejecutando la migración:
1. Verifica los logs del script PowerShell
2. Ejecuta la migración manualmente con psql
3. Revisa que tu base de datos esté activa y accesible

---

**¡Listo!** Después de ejecutar esta migración, podrás eliminar tipos de documento sin restricciones. 🎉

