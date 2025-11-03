# 🧪 Guía Completa de Pruebas - Pipeline de Procesamiento con IA

Esta guía te ayudará a probar el sistema completo de procesamiento de documentos con IA integrada (Gemini + Mistral OCR).

---

## 📋 **Checklist Pre-Test**

Antes de empezar, verifica que tienes todo configurado:

### ✅ **1. Backend Configurado**

```bash
cd backend
```

Verifica que `backend/.env` contiene:

```env
# ✅ Base de datos
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=onai_ocr

# ✅ JWT
JWT_SECRET=super-secret-jwt-key-change-this-in-production-2024
JWT_EXPIRATION=7d

# ✅ Google AI (Gemini)
GOOGLE_AI_API_KEY=tu-api-key-aqui
GEMINI_MODEL=gemini-2.5-flash

# ✅ Mistral AI (OCR)
MISTRAL_API_KEY=tu-api-key-aqui
MISTRAL_OCR_MODEL=mistral-ocr-latest

# ✅ Google Drive OAuth
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google/callback
GOOGLE_DRIVE_ROOT_FOLDER_ID=tu-folder-id

# ✅ Configuración
PORT=4000
FRONTEND_URL=http://localhost:3000
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf,image/png,image/jpeg,image/jpg,image/webp
```

### ✅ **2. PostgreSQL Corriendo**

```bash
# Iniciar PostgreSQL con Docker
docker-compose up -d postgres

# Verificar que está corriendo
docker-compose ps
```

### ✅ **3. Google Drive Autenticado**

1. Asegúrate de que el backend esté corriendo:
   ```bash
   cd backend
   pnpm run start:dev
   ```

2. Visita en tu navegador:
   ```
   http://localhost:4000/api/google/auth
   ```

3. Completa el flujo de OAuth con tu cuenta de Google

4. Verifica la autenticación:
   ```
   http://localhost:4000/api/google/status
   ```
   Deberías ver: `"authenticated": true`

### ✅ **4. Frontend Configurado**

```bash
cd frontend
```

Verifica que `frontend/.env.local` contiene:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

---

## 🚀 **Opción 1: Probar desde el Frontend (Recomendado)**

### Paso 1: Iniciar Backend

```bash
cd backend
pnpm run start:dev
```

Espera a ver:
```
🚀 Servidor corriendo en http://localhost:4000
📄 Endpoints de documentos (con AI Pipeline):
   - POST http://localhost:4000/api/documents/upload (OCR + Clasificación + Extracción)
```

### Paso 2: Iniciar Frontend

```bash
cd frontend
pnpm run dev
```

### Paso 3: Crear un Tipo de Documento

1. Abre http://localhost:3000
2. Login con tus credenciales
3. Ve a "Tipos de Documento"
4. Crea un nuevo tipo, por ejemplo:
   - **Nombre:** Factura
   - **Descripción:** Facturas de proveedores
   - **Campos:**
     - `numero_factura` (string, obligatorio) - Número de factura
     - `fecha` (date, obligatorio) - Fecha de emisión
     - `monto_total` (number, obligatorio) - Monto total
     - `proveedor` (string, obligatorio) - Nombre del proveedor
     - `descripcion` (string, opcional) - Descripción de servicios

5. Guarda el tipo - esto creará automáticamente una carpeta en Google Drive

### Paso 4: Subir un Documento

1. Ve a la página principal (http://localhost:3000)
2. Click en "Subir Documento" en la navegación
3. Selecciona un archivo PDF o imagen
4. Click en "Subir y Procesar"
5. Observa el progreso:
   - ⬆️ Subiendo archivo...
   - 🔍 Extrayendo texto (OCR)...
   - 🤖 Clasificando documento...
   - 📊 Extrayendo datos...
6. Verás el resultado:
   - Clasificado correctamente ✅
   - Confianza: XX%
   - Datos extraídos

### Paso 5: Ver el Documento Procesado

1. En la página principal, ve al panel "Rutas de Archivos"
2. Busca la carpeta del tipo de documento que creaste (ej: "Factura")
3. Expande la carpeta
4. Click en el documento que subiste
5. Verás:
   - **Visor de Documento:** El PDF/imagen en el iframe de Google Drive
   - **Visor de Datos:**
     - Información del documento (metadata)
     - Datos extraídos (tabla con los campos definidos)

---

## 🔧 **Opción 2: Probar desde el Backend (Script PowerShell)**

### Preparación

1. Edita `backend/tests/test-document-upload.ps1`
2. Cambia la línea 12:
   ```powershell
   $TestFile = "C:\ruta\a\tu\documento-prueba.pdf"
   ```
   Por ejemplo:
   ```powershell
   $TestFile = "C:\Users\tuusuario\Desktop\factura-ejemplo.pdf"
   ```

### Ejecución

```powershell
cd backend/tests
.\test-document-upload.ps1
```

### Output Esperado

```
========================================
TEST: SUBIDA Y PROCESAMIENTO DE DOCUMENTOS
========================================

[1/5] Autenticando usuario...
Login exitoso. Token obtenido.

[2/5] Obteniendo tipos de documento...
Tipos de documento disponibles: 1

Tipos:
  - ID: 1 | Nombre: Factura

[3/5] Verificando conexión con Google Drive...
Google Drive conectado correctamente

[4/5] Subiendo y procesando documento...
Archivo: C:\Users\...\factura-ejemplo.pdf

Etapas del procesamiento:
  1. Subiendo archivo...
  2. Extrayendo texto (OCR con Mistral)...
  3. Clasificando documento (Gemini)...
  4. Extrayendo datos estructurados...
  5. Guardando en Google Drive y PostgreSQL...

Procesando... (esto puede tardar 30-60 segundos)

========================================
PROCESAMIENTO EXITOSO
========================================

Resultado:
  - ID del documento: 123
  - Nombre archivo: factura-ejemplo.pdf
  - Clasificado: True
  - Confianza: 92.5%
  - Carpeta Otros creada: False
  - Mensaje: Documento clasificado como "Factura" con 92.5% de confianza

Datos extraídos:
{
  "numero_factura": "F-2024-001",
  "fecha": "2024-11-01",
  "monto_total": 1500.50,
  "proveedor": "Empresa XYZ S.A.",
  "descripcion": "Servicios de consultoría"
}

[5/5] Verificando documento en base de datos...

Documento recuperado exitosamente:
  - ID: 123
  - Nombre: factura-ejemplo.pdf
  - Tipo: Factura
  - Google Drive ID: 1abc123xyz...
  - Link: https://drive.google.com/file/d/1abc123xyz.../view
  - Estado: completed

========================================
TEST COMPLETADO
========================================
```

---

## 🎯 **Casos de Prueba Recomendados**

### Caso 1: Documento que Coincide con un Tipo Existente

**Archivo:** Factura de proveedor (PDF)
**Tipo existente:** "Factura" con campos (número, fecha, monto, proveedor)
**Resultado esperado:**
- ✅ Clasificado correctamente
- ✅ Confianza > 70%
- ✅ Campos extraídos correctamente
- ✅ Guardado en carpeta "Factura" de Google Drive

### Caso 2: Documento que NO Coincide (Carpeta "Otros")

**Archivo:** Contrato de arriendo (PDF) - sin tipo creado
**Tipos existentes:** Solo "Factura"
**Resultado esperado:**
- ✅ NO clasificado (confianza < 70%)
- ✅ Guardado en carpeta "Otros"
- ✅ Gemini sugiere: "Tipo inferido: Contrato de Arriendo"
- ✅ Gemini sugiere campos útiles para este tipo
- ✅ Datos extraídos incluyen sugerencias del modelo

### Caso 3: Imagen con Texto (OCR)

**Archivo:** Foto de una factura (JPG/PNG)
**Tipo existente:** "Factura"
**Resultado esperado:**
- ✅ OCR extrae el texto de la imagen
- ✅ Clasificado correctamente
- ✅ Campos extraídos del texto de la imagen

### Caso 4: Múltiples Tipos de Documento

**Setup:**
- Crear 3 tipos: "Factura", "Boleta", "Contrato"
- Subir un documento de cada tipo

**Resultado esperado:**
- ✅ Cada documento clasificado en su carpeta correcta
- ✅ Campos específicos extraídos según el tipo

---

## 🐛 **Troubleshooting**

### Error: "GOOGLE_AI_API_KEY no está configurada"

**Solución:**
```bash
# Edita backend/.env
GOOGLE_AI_API_KEY=tu-api-key-de-gemini
```
Obtén tu API key en: https://aistudio.google.com/app/apikey

### Error: "MISTRAL_API_KEY no está configurada"

**Solución:**
```bash
# Edita backend/.env
MISTRAL_API_KEY=tu-api-key-de-mistral
```
Obtén tu API key en: https://console.mistral.ai/

### Error: "Usuario no autenticado con Google Drive"

**Solución:**
1. Inicia el backend: `pnpm run start:dev`
2. Visita: http://localhost:4000/api/google/auth
3. Completa el OAuth
4. Reinicia el backend (los tokens se guardan en PostgreSQL)

### El documento se sube pero no aparece en el frontend

**Solución:**
- Verifica que el evento `documentUploaded` se emite correctamente
- Refresca la página manualmente
- Verifica en la consola del navegador si hay errores

### El OCR no extrae texto correctamente

**Posibles causas:**
- La imagen tiene muy baja calidad
- El documento es muy complejo o manuscrito
- El idioma del documento no es español/inglés

**Solución:**
- Usa imágenes de alta resolución
- Asegúrate de que el texto sea legible
- Prueba con documentos más simples primero

### La clasificación es incorrecta

**Posibles causas:**
- El documento no coincide con ningún tipo existente
- La descripción del tipo de documento es vaga
- Los campos definidos no son representativos

**Solución:**
- Mejora la descripción del tipo de documento
- Agrega más campos relevantes
- Reduce el `CLASSIFICATION_CONFIDENCE_THRESHOLD` (default: 0.7)

---

## 📊 **Monitoreo del Procesamiento**

### Logs del Backend

Observa los logs del backend para ver el progreso:

```
[DocumentProcessingService] Iniciando procesamiento de documento: factura.pdf
[MistralOCRService] Iniciando OCR para archivo tipo: application/pdf
[MistralOCRService] OCR completado. Texto extraído: 1243 caracteres
[GeminiClassifierService] Clasificación completada: Factura (confianza: 0.92)
[GeminiClassifierService] Extracción completada: 5 campos extraídos
[GoogleDriveService] File uploaded to Drive: factura.pdf (1abc123xyz...)
[DocumentProcessingService] ✅ Documento procesado exitosamente: 123
```

### Verificar en Base de Datos

```sql
-- Conectar a PostgreSQL
psql -h localhost -U postgres -d onai_ocr

-- Ver documentos procesados
SELECT 
  id, 
  filename, 
  document_type_id, 
  confidence_score,
  status,
  created_at 
FROM documents 
ORDER BY created_at DESC;

-- Ver datos extraídos de un documento
SELECT 
  id,
  filename,
  extracted_data 
FROM documents 
WHERE id = 123;
```

---

## 🎉 **¡Listo para Probar!**

Sigue esta guía paso a paso y podrás probar el pipeline completo de procesamiento de documentos con IA.

Si encuentras problemas, revisa la sección de Troubleshooting o consulta la documentación adicional en `backend/tests/README.md`.

---

**¿Necesitas ayuda adicional?**
- Backend: `backend/tests/README.md`
- Google Drive: `backend/GOOGLE_DRIVE_SETUP.md`
- API Endpoints: `backend/tests/API-TESTS.md`

