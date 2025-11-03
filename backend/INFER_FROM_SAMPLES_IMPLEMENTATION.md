# 🤖 Implementación: Inferir Tipos desde Documentos de Ejemplo

## 📋 Resumen

Funcionalidad para crear tipos de documento automáticamente analizando documentos de ejemplo con IA (Gemini 2.5 Flash).

---

## 🎯 Flujo Completo

```
1. Usuario sube hasta 10 documentos
        ↓
2. analyzeDocumentSamples()
   → Gemini Vision analiza cada documento
   → Extrae tipo + 3-20 campos
        ↓
3. groupDocumentsByType()
   → Gemini agrupa tipos similares
   → "Purchase Order" = "Orden de Compra"
        ↓
4. consolidateFieldsByType()
   → Gemini consolida campos por tipo
   → Homologa nombres, tipos, required
        ↓
5. createDocumentTypesFromInference()
   → Crea carpetas en Drive
   → Guarda en BD
   → Sube documentos de ejemplo (opcional)
        ↓
6. Retorna tipos creados con IDs y schemas
```

---

## 📂 Archivos Creados

### **Backend**

1. **`backend/src/document-types/dto/infer-from-samples.dto.ts`**
   - Interfaces y DTOs para el proceso de inferencia
   - `ProcessedDocument`, `ConsolidatedType`, `CreatedDocumentType`, etc.

2. **`backend/src/document-types/services/document-type-inference.service.ts`**
   - Servicio principal con los 4 métodos:
     - `analyzeDocumentSamples()` - Analiza cada documento
     - `groupDocumentsByType()` - Agrupa tipos similares
     - `consolidateFieldsByType()` - Consolida campos
     - `createDocumentTypesFromInference()` - Crea en BD y Drive
     - `inferDocumentTypesFromSamples()` - Orquesta todo el proceso

3. **`backend/src/document-types/document-types.controller.ts`**
   - Nuevo endpoint: `POST /document-types/infer-from-samples`
   - Acepta hasta 10 archivos (PDF, PNG, JPG)
   - Query param: `?uploadSamples=true` para subir ejemplos a Drive

4. **`backend/src/document-types/document-types.module.ts`**
   - Agregado `DocumentTypeInferenceService`
   - Agregado `GeminiClassifierService`

5. **`backend/tests/test-infer-from-samples.ps1`**
   - Script de prueba en PowerShell
   - Permite probar el endpoint con documentos reales

---

## 🔧 Los 4 Métodos del Servicio

### **1. `analyzeDocumentSamples(files[])`**

**Input:**
```typescript
files: Express.Multer.File[] // Hasta 10 archivos
```

**Output:**
```typescript
ProcessedDocument[] = [
  {
    filename: "orden_compra_1.pdf",
    inferredType: "Orden de Compra",
    fields: [{ name: "numero_orden", type: "string", ... }],
    buffer: Buffer,
    mimeType: "application/pdf"
  }
]
```

**Reutiliza:** `geminiClassifierService.inferFieldsForUnclassifiedWithVision()`

---

### **2. `groupDocumentsByType(processedDocs[])`**

**Input:**
```typescript
ProcessedDocument[] // Del método anterior
```

**Output:**
```typescript
Map<string, ProcessedDocument[]> = {
  "Orden de Compra": [doc1, doc2, doc5],     // 3 docs
  "Orden de Despacho": [doc3, doc4]          // 2 docs
}
```

**Prompt a Gemini:**
- Identifica tipos equivalentes
- "Purchase Order" = "Orden de Compra"
- "Factura" ≠ "Orden de Compra"

---

### **3. `consolidateFieldsByType(typeName, documents[])`**

**Input:**
```typescript
{
  typeName: "Orden de Compra",
  documents: [7 documentos con campos]
}
```

**Output:**
```typescript
ConsolidatedType = {
  typeName: "Orden de Compra",
  consolidatedFields: [
    {
      name: "numero_orden",
      type: "string",
      label: "Número de Orden",
      required: true,
      frequency: 1.0  // Aparece en 100% de docs
    }
  ]
}
```

**Prompt a Gemini:**
- Identifica campos equivalentes
- `numero_orden` = `order_number` = `nro_orden`
- Elige mejor nombre (español, snake_case)
- Elige mejor tipo (mayoría)
- `required: true` si aparece en ≥50% de docs

---

### **4. `createDocumentTypesFromInference(consolidated[], user, uploadSamples)`**

**Input:**
```typescript
ConsolidatedType[]
```

**Output:**
```typescript
CreatedDocumentType[] = [
  {
    id: 15,
    name: "Orden de Compra",
    fieldCount: 18,
    sampleDocumentCount: 7,
    googleDriveFolderId: "abc123",
    fields: [...]
  }
]
```

**Proceso:**
1. Verifica que no exista tipo con ese nombre
2. Crea carpeta en Google Drive
3. (Opcional) Sube documentos Y los guarda como documentos reales en BD
4. Guarda `DocumentType` en BD

**⚡ NUEVO: Si `uploadSamples = true`:**
- Los documentos NO se suben como "ejemplos", sino como **documentos reales procesados**
- Cada documento se guarda en la tabla `documents` con:
  - `extractedData` → Datos ya extraídos durante el análisis
  - `confidenceScore` → 0.95 (alta confianza)
  - `status` → `completed`
  - `ocrRawText` → `null` (Gemini Vision procesó directamente)
- Los documentos quedan disponibles inmediatamente en el sistema para consulta
- **Ventaja:** No es necesario volver a subir los documentos uno por uno después de crear el tipo

---

## 🌐 Endpoint

```http
POST /document-types/infer-from-samples?uploadSamples=true
Content-Type: multipart/form-data
Authorization: Bearer {JWT_TOKEN}

files: [file1, file2, ..., file10]
```

**Validaciones:**
- ✅ Mínimo 2 archivos
- ✅ Máximo 10 archivos
- ✅ Máximo 10MB por archivo
- ✅ Solo PDF, PNG, JPG

**⚙️ Query Parameter `uploadSamples`:**
- `uploadSamples=false` (default): Solo crea los tipos de documento, NO sube archivos
- `uploadSamples=true`: Crea tipos + sube archivos a Drive + **guarda documentos como registros reales en BD**
  - ✅ Los documentos quedan disponibles inmediatamente en el dashboard
  - ✅ Ya incluyen `extractedData` (no requieren reprocesamiento)
  - ✅ Se guardan con `confidenceScore: 0.95` y `status: completed`

**Respuesta:**
```json
{
  "success": true,
  "message": "2 tipo(s) de documento creado(s) exitosamente",
  "createdTypes": [
    {
      "id": 15,
      "name": "Orden de Compra",
      "description": "Tipo creado automáticamente...",
      "fieldCount": 18,
      "sampleDocumentCount": 7,
      "googleDriveFolderId": "abc123xyz",
      "folderPath": "https://drive.google.com/...",
      "fields": [...]
    }
  ],
  "totalDocumentsProcessed": 10,
  "totalTypesCreated": 2
}
```

---

## 🧪 Cómo Probar

### **Opción 1: Script PowerShell**

```powershell
cd backend/tests
.\test-infer-from-samples.ps1
```

Sigue las instrucciones para:
1. Especificar rutas de documentos
2. Elegir si subir ejemplos a Drive
3. Ver resultados detallados

### **Opción 2: Thunder Client / Postman**

1. **Endpoint:** `POST http://localhost:3000/document-types/infer-from-samples?uploadSamples=true`
2. **Headers:**
   - `Authorization: Bearer {TU_TOKEN}`
3. **Body:** `form-data`
   - Key: `files` (File, multiple)
   - Selecciona 2-10 archivos

---

## 📊 Ejemplo de Caso de Uso

**Escenario:** Tengo 10 documentos físicos escaneados y quiero crear tipos automáticamente.

**Documentos:**
- 5 órdenes de compra (algunas en inglés, otras en español)
- 3 órdenes de despacho
- 2 facturas

**Proceso:**
1. Subo los 10 archivos al endpoint
2. El sistema analiza cada uno (2-3 min)
3. Gemini identifica 3 tipos:
   - "Orden de Compra" (5 docs)
   - "Orden de Despacho" (3 docs)
   - "Factura" (2 docs)
4. Consolida campos de cada tipo
5. Crea 3 tipos de documento en BD con sus schemas
6. Crea 3 carpetas en Google Drive

**Resultado:**
- 3 tipos listos para usar
- Cada uno con 15-20 campos consolidados
- Folders en Drive con documentos de ejemplo

---

## ⚙️ Configuración

**Variables de entorno necesarias:**
```env
GOOGLE_AI_API_KEY=tu_clave_gemini
GEMINI_MODEL=gemini-2.5-flash
```

**Dependencias:**
- ✅ `@google/generative-ai`
- ✅ `@nestjs/platform-express` (multipart/form-data)
- ✅ Google Drive Service
- ✅ Gemini Classifier Service

---

## 🎯 Próximos Pasos

### **Frontend Pendiente:**
1. Modal con drag & drop para subir archivos
2. Vista de progreso en tiempo real
3. Botón "Nuevo tipo a partir de documentos"
4. Vista de resultados con tipos creados

### **Mejoras Futuras:**
- [ ] Streaming de progreso (WebSockets o SSE)
- [ ] Caché de análisis de documentos
- [ ] Permitir editar campos antes de crear
- [ ] Preview de schemas consolidados
- [ ] Reintentar documentos fallidos

---

## 🚨 Consideraciones

### **Performance:**
- ⏱️ ~15-20 segundos por documento
- 🔄 Procesa en batches de 3 para no saturar Gemini
- 💰 Cada documento = 1 llamada a Gemini Vision (~$0.002)

### **Límites:**
- 📄 Máximo 10 documentos por batch
- 📦 Máximo 10MB por archivo
- 🏷️ Máximo 20 campos consolidados por tipo
- ⏱️ Timeout recomendado: 5 minutos

### **Errores Comunes:**
1. **"Se requieren al menos 2 documentos"**
   - Solución: Sube mínimo 2 archivos

2. **"Tipo de archivo no permitido"**
   - Solución: Solo PDF, PNG, JPG

3. **"El tipo ya existe"**
   - Solución: El sistema skipea tipos duplicados automáticamente

---

## 📝 Notas de Implementación

- **Reutilización:** Aprovecha `inferFieldsForUnclassifiedWithVision()` existente
- **Idempotencia:** No crea tipos duplicados
- **Atomicidad:** Si falla al crear un tipo, continúa con los demás
- **Logging:** Logs detallados en cada paso del proceso
- **Fallbacks:** Si Gemini falla al agrupar, usa agrupación por nombre exacto

---

## ✅ Estado Actual

**Backend:** ✅ Completado
- [x] Servicio de inferencia con 4 métodos
- [x] Endpoint configurado
- [x] DTOs e interfaces
- [x] Módulo actualizado
- [x] Script de prueba

**Frontend:** ⏳ Pendiente
- [ ] Modal de upload
- [ ] Vista de progreso
- [ ] Botón en UI
- [ ] Integración con backend

---

**Última actualización:** 2 de noviembre, 2025

