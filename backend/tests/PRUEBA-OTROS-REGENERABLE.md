# 🧪 Prueba del Flujo "Otros" Regenerable

Este documento te guía para probar que el tipo de documento "Otros" se puede **eliminar** y **recrear automáticamente** cuando sea necesario.

---

## 🎯 **Objetivo**

Verificar que:
1. ✅ Se puede eliminar el tipo "Otros" igual que cualquier otro tipo
2. ✅ Cuando se sube un documento sin clasificación y no existe "Otros", se crea automáticamente
3. ✅ Los datos se guardan correctamente en `extractedData` e `inferredData`

---

## 📋 **Pasos de la Prueba**

### **Paso 1: Preparar el entorno**

1. Asegúrate de que el backend esté corriendo:
```powershell
cd backend
pnpm run start:dev
```

2. Asegúrate de que el frontend esté corriendo:
```powershell
cd frontend
pnpm run dev
```

3. Asegúrate de estar logueado en el frontend (`http://localhost:3000`)

---

### **Paso 2: Ejecutar el script de prueba**

```powershell
cd backend/tests
.\quick-test-otros.ps1
```

**⚠️ IMPORTANTE:** Antes de ejecutar, abre el script y **cambia las credenciales**:
```powershell
$email = "tu-email@example.com"  # TU EMAIL
$password = "tu-contraseña"       # TU CONTRASEÑA
```

El script te mostrará:
- ✅ Lista de documentos actuales
- ✅ Opción para eliminar documentos
- ✅ Lista de tipos de documento
- ✅ Opción para eliminar el tipo "Otros"

---

### **Paso 3: Subir un nuevo documento**

Una vez que hayas eliminado "Otros" con el script:

1. Ve al frontend: `http://localhost:3000`
2. Haz clic en **"Subir Documento"**
3. Selecciona un documento que **NO** pertenezca a ningún tipo existente
4. Espera a que se procese

**✅ Resultado esperado:**
- El sistema detectará que el documento no coincide con ningún tipo
- Creará automáticamente el tipo "Otros" en PostgreSQL
- Creará la carpeta "Otros" en Google Drive
- Guardará el documento con:
  - `extractedData` (con estructura básica)
  - `inferredData` (con tipo inferido y campos clave detectados por la IA)

---

### **Paso 4: Verificar la recreación**

1. Ve a **"Tipos de Documento"** (`http://localhost:3000/document-types`)
2. Deberías ver que "Otros" se ha recreado automáticamente
3. Haz clic en "Otros" para ver sus campos:
   - `document_title` (Título del Documento)
   - `document_category` (Categoría)
   - `key_entities` (Resumen/Entidades Clave)

4. Ve al **Dashboard** (`http://localhost:3000`)
5. Selecciona el documento que subiste
6. En el "Visor de Datos", verifica que muestre:
   - **Resumen**: El resumen generado por la IA
   - **Datos Extraídos**: Los campos inferidos automáticamente con sus valores

---

## 🔍 **Verificación en la Base de Datos**

Si quieres verificar directamente en PostgreSQL:

```sql
-- Ver el tipo "Otros" recreado
SELECT id, name, description, "googleDriveFolderId"
FROM document_types
WHERE name LIKE '%Otros%';

-- Ver el documento guardado
SELECT 
  id, 
  filename, 
  "documentTypeId",
  "extractedData",
  "inferredData",
  "confidenceScore"
FROM documents
WHERE "documentTypeId" IN (
  SELECT id FROM document_types WHERE name LIKE '%Otros%'
);

-- Ver los campos inferidos (JSONB)
SELECT 
  filename,
  "inferredData"->'inferred_type' AS tipo_inferido,
  "inferredData"->'summary' AS resumen,
  "inferredData"->'key_fields' AS campos_clave
FROM documents
WHERE "inferredData" IS NOT NULL;
```

---

## ✅ **Criterios de Éxito**

La prueba es exitosa si:

1. ✅ Puedes eliminar el tipo "Otros" sin problemas (siempre que no tenga documentos)
2. ✅ Al subir un documento sin clasificación, "Otros" se recrea automáticamente
3. ✅ La carpeta "Otros" se crea en Google Drive
4. ✅ El registro se guarda en PostgreSQL con:
   - `extractedData` → Estructura básica (summary + fields)
   - `inferredData` → Tipo inferido + campos clave detectados por IA
5. ✅ El frontend muestra correctamente:
   - El resumen del documento
   - Los campos inferidos con sus valores
   - La tabla de datos en el "Visor de Datos"

---

## 🐛 **Troubleshooting**

### **Error: "No se puede eliminar el tipo 'Otros' porque tiene documentos asociados"**
- **Solución:** Elimina primero los documentos asociados
- Usa el script `quick-test-otros.ps1` y selecciona eliminar documentos

### **Error: "GOOGLE_AI_API_KEY no está configurada"**
- **Solución:** Verifica que tu `backend/.env` tenga:
```env
GOOGLE_AI_API_KEY=tu-api-key-aqui
MISTRAL_API_KEY=tu-api-key-aqui
```

### **Error: "Usuario no autenticado con Google Drive"**
- **Solución:** Ve a `http://localhost:4000/api/google/auth` para autenticarte

### **El documento no se clasifica como "Otros"**
- **Solución:** Asegúrate de subir un documento que no coincida con ningún tipo existente
- Ejemplo: Si tienes un tipo "Factura", no subas una factura
- Prueba con un documento aleatorio como un certificado, carta, etc.

---

## 📝 **Notas Importantes**

- **"Otros" es especial:** Aunque se puede eliminar, el sistema lo recrea automáticamente cuando es necesario
- **No se elimina de Google Drive:** Por seguridad, las carpetas en Google Drive no se eliminan automáticamente
- **Inferencia dinámica:** Cada documento en "Otros" puede tener campos diferentes según lo que la IA detecte
- **Estructura de datos:**
  - `extractedData` → Campos del schema del tipo (para tipos conocidos)
  - `inferredData` → Campos detectados por IA (para "Otros")

---

## 🎓 **Entendiendo el Flujo**

```
Usuario sube documento
        ↓
OCR extrae texto
        ↓
IA clasifica documento
        ↓
   ¿Coincide con algún tipo?
        ↓
  ┌─────┴─────┐
  SÍ          NO
  ↓           ↓
Usar tipo   ¿Existe "Otros"?
existente         ↓
  ↓         ┌─────┴─────┐
  |         SÍ          NO
  |         ↓           ↓
  |    Usar "Otros"  Crear "Otros"
  |         ↓           ↓
  └────────→ Guardar documento
                  ↓
            extractedData (tipo conocido)
                  o
            inferredData (tipo "Otros")
```

---

## 📚 **Referencias**

- [Documentación de Tipos de Documento](../../frontend/app/document-types/page.tsx)
- [Servicio de Procesamiento](../../backend/src/documents/services/document-processing.service.ts)
- [Endpoint DELETE /documents/:id](../../backend/src/documents/documents.controller.ts)


