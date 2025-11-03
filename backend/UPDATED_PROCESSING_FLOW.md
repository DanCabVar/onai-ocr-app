# 📋 Flujo Actualizado de Procesamiento de Documentos

## 🎯 Objetivo
Procesar múltiples documentos usando URLs de Google Drive en vez de base64, con cola de procesamiento y manejo de documentos no clasificados.

---

## 🔄 Flujo Completo

### **1. Upload Múltiple**
```
Usuario selecciona N archivos
  ↓
Frontend envía archivos al backend
  ↓
Backend sube cada archivo a carpeta temporal "Processing" en Google Drive
  ↓
Backend retorna lista de IDs de archivos en Drive para tracking
```

### **2. Procesamiento en Cola**
```
Para cada archivo en la carpeta "Processing":
  ↓
  2.1. Obtener URL pública del archivo en Drive
  ↓
  2.2. OCR con Mistral usando la URL:
       - PDF: document_url + documentUrl
       - Imagen: image_url + imageUrl
  ↓
  2.3. Obtener tipos de documento de la BD
  ↓
  2.4. Clasificación con Gemini 2.5 Flash:
       - Comparar texto OCR vs tipos existentes
       - Retornar: tipo_id, confidence, reasoning
  ↓
  2.5a. SI clasificado (confidence >= threshold):
        - Mover archivo a carpeta del tipo
        - Extraer datos según field_schema del tipo
        - Guardar en BD (extractedData)
  ↓
  2.5b. SI NO clasificado (confidence < threshold):
        - Verificar si existe tipo "Otros Documentos"
        - Si no existe, crear con schema genérico
        - Mover archivo a carpeta "Otros Documentos"
        - Gemini infiere campos clave del documento
        - Guardar en BD (extractedData + inferredData)
  ↓
  2.6. Eliminar archivo de carpeta "Processing"
  ↓
  2.7. Actualizar status del documento en BD
```

---

## 📊 Estructura de Datos

### **`documents` table (actualizada)**

| Campo              | Tipo      | Descripción                                        |
|--------------------|-----------|----------------------------------------------------|
| id                 | int       | ID del documento                                   |
| user_id            | int       | Usuario propietario                                |
| document_type_id   | int       | Tipo de documento (FK)                             |
| filename           | text      | Nombre del archivo                                 |
| google_drive_link  | text      | URL pública del archivo en Drive                   |
| google_drive_file_id | text    | ID del archivo en Drive                            |
| **extracted_data** | jsonb     | Datos extraídos según field_schema del tipo        |
| **inferred_data**  | jsonb     | Campos inferidos (solo para "Otros Documentos")    |
| ocr_raw_text       | text      | Texto completo extraído por OCR                    |
| confidence_score   | decimal   | Confianza de la clasificación (0-1)                |
| status             | text      | Estado: processing, completed, error               |
| created_at         | timestamp | Fecha de creación                                  |
| updated_at         | timestamp | Fecha de actualización                             |

### **Tipo "Otros Documentos" - field_schema**

```json
{
  "fields": [
    {
      "name": "document_title",
      "label": "Título del Documento",
      "type": "text",
      "required": false,
      "description": "Título o nombre inferido del documento"
    },
    {
      "name": "document_category",
      "label": "Categoría Inferida",
      "type": "text",
      "required": false,
      "description": "Categoría o tipo inferido por la IA"
    },
    {
      "name": "key_entities",
      "label": "Entidades Clave",
      "type": "textarea",
      "required": false,
      "description": "Nombres, empresas, fechas relevantes"
    }
  ]
}
```

### **Ejemplo de `inferredData` para "Otros Documentos"**

```json
{
  "inferred_type": "Certificado de Estudios",
  "key_fields": [
    {
      "field_name": "institution_name",
      "field_label": "Nombre de la Institución",
      "field_value": "Universidad Nacional",
      "field_type": "text"
    },
    {
      "field_name": "student_name",
      "field_label": "Nombre del Estudiante",
      "field_value": "Juan Pérez",
      "field_type": "text"
    },
    {
      "field_name": "issue_date",
      "field_label": "Fecha de Emisión",
      "field_value": "2024-05-15",
      "field_type": "date"
    }
  ],
  "summary": "Certificado de estudios emitido por Universidad Nacional"
}
```

---

## 🛠️ Cambios Técnicos Necesarios

### **1. Google Drive Service**

**Nuevos métodos:**
- ✅ `createProcessingFolder()` - Crear carpeta "Processing" si no existe
- ✅ `uploadToProcessing(file, filename, mimeType)` - Subir a carpeta temporal
- ✅ `getPublicUrl(fileId)` - Obtener URL pública del archivo
- ✅ `moveFile(fileId, targetFolderId)` - Mover archivo entre carpetas
- ✅ `listFilesInProcessing()` - Listar archivos pendientes
- ✅ `deleteFile(fileId)` - Eliminar archivo de Drive

### **2. Mistral OCR Service**

**Método actualizado:**
```typescript
async extractTextFromUrl(fileUrl: string, mimeType: string): Promise<OCRResult> {
  const isPDF = mimeType === 'application/pdf';
  
  const response = await client.ocr.process({
    model: "mistral-ocr-latest",
    document: isPDF ? {
      type: "document_url",
      documentUrl: fileUrl  // camelCase
    } : {
      type: "image_url",
      imageUrl: fileUrl     // camelCase
    },
    includeImageBase64: true  // camelCase
  });
  
  return { text: response.text, confidence: 0.95, metadata: {...} };
}
```

### **3. Gemini Classifier Service**

**Nuevo método para "Otros Documentos":**
```typescript
async inferFieldsForUnclassified(ocrText: string): Promise<InferredData> {
  // Prompt a Gemini para inferir:
  // - Tipo de documento inferido
  // - Campos clave encontrados
  // - Valores de cada campo
  // - Resumen del documento
  
  return {
    inferred_type: "...",
    key_fields: [...],
    summary: "..."
  };
}
```

### **4. Document Processing Service**

**Flujo actualizado:**
1. Recibir archivo del frontend
2. Subir a carpeta "Processing" en Drive
3. Obtener URL pública
4. OCR con Mistral (usando URL)
5. Clasificación con Gemini
6. Si clasificado → mover a carpeta del tipo
7. Si NO → crear/usar "Otros Documentos" + inferir campos
8. Extraer datos
9. Guardar en BD
10. Eliminar de "Processing"

### **5. Document Types Service**

**Nuevo método:**
```typescript
async createOthersDocumentType(user: User): Promise<DocumentType> {
  // Crear tipo "Otros Documentos" con schema genérico
  // Crear carpeta en Google Drive
  // Guardar en BD
}
```

---

## 🎨 Cambios en el Frontend

### **Upload Modal (componente actualizado)**

**Características:**
- ✅ Selección múltiple de archivos
- ✅ Vista previa de archivos en cola
- ✅ Barra de progreso individual por archivo
- ✅ Estados por archivo: pending, uploading, processing, completed, error
- ✅ Opción de cancelar archivos individuales
- ✅ Resumen final: X exitosos, Y fallidos

**Fases de procesamiento por archivo:**
1. **Uploading**: Subiendo a Drive...
2. **OCR**: Extrayendo texto...
3. **Classifying**: Clasificando documento...
4. **Extracting**: Extrayendo datos...
5. **Completed**: ✅ Procesado

---

## 🧪 Endpoints a Actualizar/Crear

### **`POST /api/documents/upload`**
**Antes:** Recibe 1 archivo, procesa inmediatamente
**Ahora:** Recibe 1 archivo, sube a "Processing", procesa con URL

### **`POST /api/documents/upload-multiple`** (NUEVO)
**Request:** FormData con múltiples archivos
**Response:**
```json
{
  "uploaded": [
    {
      "filename": "doc1.pdf",
      "driveFileId": "abc123",
      "status": "queued"
    }
  ],
  "errors": []
}
```

### **`POST /api/documents/process-queue`** (NUEVO)
**Descripción:** Procesar todos los archivos en la carpeta "Processing"
**Response:**
```json
{
  "processed": 5,
  "successful": 4,
  "failed": 1,
  "results": [...]
}
```

### **`GET /api/documents/processing-status`** (NUEVO)
**Descripción:** Estado actual de la cola de procesamiento
**Response:**
```json
{
  "pending": 3,
  "processing": 1,
  "completed": 10
}
```

---

## 📈 Ventajas del Nuevo Flujo

1. **Escalabilidad**: Procesar N archivos sin sobrecargar memoria
2. **Simplicidad**: URLs en vez de base64 (menos errores)
3. **Resiliencia**: Si falla el procesamiento, el archivo sigue en Drive
4. **Flexibilidad**: Documentos no clasificados se manejan automáticamente
5. **Trazabilidad**: Estado claro de cada archivo en cada etapa
6. **UX mejorada**: Usuario ve progreso en tiempo real

---

## 🚀 Plan de Implementación

### **Fase 1: Backend Core** (Prioridad Alta)
- [ ] Actualizar entidad `Document` (agregar `inferred_data`)
- [ ] Migración de BD para nuevo campo
- [ ] Actualizar `GoogleDriveService` con métodos de carpeta temporal
- [ ] Corregir `MistralOCRService` para usar URLs
- [ ] Crear método `inferFieldsForUnclassified` en Gemini
- [ ] Actualizar `DocumentProcessingService` con nuevo flujo

### **Fase 2: Endpoints** (Prioridad Alta)
- [ ] Actualizar `POST /documents/upload` para usar Drive URL
- [ ] Crear `POST /documents/upload-multiple`
- [ ] Crear `POST /documents/process-queue`
- [ ] Crear `GET /documents/processing-status`

### **Fase 3: Frontend** (Prioridad Media)
- [ ] Actualizar `UploadDocumentModal` para múltiples archivos
- [ ] Agregar vista de cola de procesamiento
- [ ] Agregar barras de progreso individuales
- [ ] Mostrar campos inferidos para documentos "Otros"

### **Fase 4: Testing** (Prioridad Media)
- [ ] Test de upload múltiple
- [ ] Test de OCR con URL
- [ ] Test de clasificación con threshold
- [ ] Test de "Otros Documentos" con campos inferidos
- [ ] Test de eliminación de archivos temporales

---

## 📚 Referencias

- [Mistral OCR Documentation](https://docs.mistral.ai/capabilities/document_ai/basic_ocr)
- [Google Drive API - Files: create](https://developers.google.com/drive/api/v3/reference/files/create)
- [Google Drive API - Permissions](https://developers.google.com/drive/api/v3/reference/permissions)

