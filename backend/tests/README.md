# 🧪 Tests / Scripts de Prueba

Esta carpeta contiene todos los scripts y archivos necesarios para probar los endpoints del backend.

## 📂 Contenido

### 1. `API-TESTS.md`
Documentación completa con ejemplos de `curl` y comandos PowerShell para probar cada endpoint manualmente.

**Uso:**
- Lee la documentación
- Copia y pega los comandos en tu terminal
- Ajusta los parámetros según sea necesario

---

### 2. `thunder-collection.json`
Colección de Thunder Client para VS Code con todos los endpoints configurados.

**Uso:**
1. Instala Thunder Client en VS Code
2. Abre Thunder Client (icono de rayo ⚡)
3. Click en "Collections" → "⋮" → "Import"
4. Selecciona `thunder-collection.json`
5. Ejecuta los requests en orden:
   - Register/Login (para obtener token)
   - Get Profile
   - List Documents
   - Etc.

**Variables de entorno:**
- Crea una variable `{{token}}` en Thunder Client Env
- Copia el token de la respuesta de Register/Login
- Úsalo en los demás endpoints

---

### 3. `test-endpoints.ps1`
Script automatizado de PowerShell que prueba todos los endpoints principales.

**Uso:**
```powershell
# Ejecutar desde la raíz del proyecto backend
cd tests
.\test-endpoints.ps1
```

**Qué hace:**
- ✅ Registra un usuario de prueba
- ✅ Hace login
- ✅ Obtiene el perfil del usuario
- ✅ Lista documentos
- ✅ Prueba errores (sin token, credenciales incorrectas)
- ✅ Devuelve un token JWT válido para más pruebas

**Salida:**
Al final del script obtendrás un token JWT que puedes usar para pruebas manuales.

---

### 4. `test-document-types.ps1`
Script automatizado para probar la gestión de tipos de documento.

**Uso:**
```powershell
cd tests
.\test-document-types.ps1
```

**Qué hace:**
- ✅ Login
- ✅ Crea tipos de documento
- ✅ Lista tipos de documento
- ✅ Obtiene tipo específico
- ✅ Actualiza tipo de documento
- ✅ Prueba validaciones

---

### 5. `test-google-drive.ps1`
Script automatizado para probar la integración con Google Drive.

**Uso:**
```powershell
cd tests
.\test-google-drive.ps1
```

**Prerequisitos:**
- ⚠️ Debes autenticarte con Google Drive primero visitando: `http://localhost:4000/api/google/auth`
- ⚠️ Configura las variables de entorno de Google en `backend/.env` (ver `GOOGLE_DRIVE_SETUP.md`)

**Qué hace:**
- ✅ Verifica estado de autenticación con Google Drive
- ✅ Crea un tipo de documento (crea carpeta en Drive automáticamente)
- ✅ Lista carpetas en Google Drive
- ✅ Muestra IDs y paths de carpetas creadas

---

### 6. `test-document-upload.ps1` ⭐ NUEVO
Script completo para probar el pipeline de procesamiento de documentos con IA.

**Uso:**
```powershell
cd tests
.\test-document-upload.ps1
```

**⚠️ IMPORTANTE - Antes de ejecutar:**
1. Edita el script y cambia `$TestFile` con la ruta a tu archivo de prueba (PDF o imagen)
2. Asegúrate de tener las API keys configuradas en `backend/.env`:
   - `GOOGLE_AI_API_KEY` (Gemini)
   - `MISTRAL_API_KEY` (Mistral OCR)
3. Autentica con Google Drive visitando: `http://localhost:4000/api/google/auth`

**Qué hace:**
- ✅ Autentica al usuario
- ✅ Verifica tipos de documento disponibles
- ✅ Verifica conexión con Google Drive
- ✅ Sube el documento y ejecuta el pipeline completo:
  - 🔍 Extracción de texto con **Mistral OCR** (mistral-ocr-latest)
  - 🤖 Clasificación de documento con **Gemini 2.5 Flash**
  - 📊 Extracción de datos estructurados con **Gemini**
  - ☁️ Subida a Google Drive
  - 💾 Guardado en PostgreSQL
- ✅ Muestra el resultado detallado con datos extraídos
- ✅ Verifica el documento en la base de datos

**Output esperado:**
```
========================================
PROCESAMIENTO EXITOSO
========================================

Resultado:
  - ID del documento: 123
  - Nombre archivo: factura-2024.pdf
  - Clasificado: True
  - Confianza: 92.5%
  - Carpeta Otros creada: False
  - Mensaje: Documento clasificado como "Factura" con 92.5% de confianza

Datos extraídos:
{
  "numero_factura": "F-2024-001",
  "fecha": "2024-11-01",
  "monto_total": 1500.50,
  "cliente": "Empresa XYZ S.A."
}
```

---

## 🚀 Inicio Rápido

### Opción 1: Script Automatizado (Recomendado)
```powershell
cd backend/tests
.\test-endpoints.ps1
```

### Opción 2: Thunder Client
1. Importa `thunder-collection.json`
2. Ejecuta "Register"
3. Copia el token
4. Prueba los demás endpoints

### Opción 3: Manual (curl/PowerShell)
Lee `API-TESTS.md` y ejecuta los comandos manualmente.

---

### 7. `test-delete-document.ps1` ⭐ NUEVO
Script interactivo de PowerShell que permite eliminar documentos de la base de datos.

**Uso:**
```powershell
# Ejecutar desde la raíz del proyecto backend
cd tests
.\test-delete-document.ps1
```

**Qué hace:**
- ✅ Hace login con el usuario de prueba
- ✅ Lista todos los documentos del usuario
- ✅ Te permite seleccionar cuál eliminar
- ✅ Solicita confirmación antes de eliminar
- ✅ Elimina el documento de la **base de datos**
- ⚠️ **NO elimina el archivo de Google Drive** (por seguridad)

**Nota importante:**
- El archivo en Google Drive **NO se elimina automáticamente**
- Esto es por seguridad, para evitar pérdida accidental de datos
- Puedes eliminarlo manualmente desde Google Drive si lo deseas

---

### 8. `quick-test-otros.ps1` + `PRUEBA-OTROS-REGENERABLE.md` 🔥 NUEVO
Script y documentación completa para probar el **flujo "Otros" regenerable**.

**Uso:**
```powershell
# 1. Edita el script y cambia las credenciales
cd tests
notepad quick-test-otros.ps1  # Cambia $email y $password

# 2. Ejecuta el script
.\quick-test-otros.ps1
```

**Qué hace:**
- ✅ Lista todos los documentos y tipos
- ✅ Te permite eliminar documentos y el tipo "Otros"
- ✅ Te guía para probar la recreación automática de "Otros"

**Lee la documentación completa:** [`PRUEBA-OTROS-REGENERABLE.md`](./PRUEBA-OTROS-REGENERABLE.md)

**Flujo de prueba:**
1. Eliminar documentos asociados a "Otros"
2. Eliminar el tipo "Otros"
3. Subir un documento sin clasificación desde el frontend
4. ✅ "Otros" se recrea automáticamente con carpeta en Google Drive
5. ✅ Los datos se guardan con `extractedData` e `inferredData`

---

## 📝 Endpoints Disponibles

### Autenticación (Públicos)
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Ver perfil (protegido)

### Tipos de Documento (Protegidos)
- `POST /api/document-types` - Crear tipo de documento
- `GET /api/document-types` - Listar tipos de documento
- `GET /api/document-types/:id` - Obtener tipo específico
- `PUT /api/document-types/:id` - Actualizar tipo de documento
- `DELETE /api/document-types/:id` - Eliminar tipo de documento

### Google Drive (Públicos/Protegidos)
- `GET /api/google/auth` - Iniciar flujo OAuth (público)
- `GET /api/google/callback` - Callback OAuth (público)
- `GET /api/google/status` - Verificar estado de autenticación (público)
- `GET /api/google/files` - Listar carpeta raíz (público)
- `GET /api/google/files/:folderId` - Listar carpeta específica (público)

### Documentos (Protegidos) ⭐ CON IA
- `POST /api/documents/upload` - **Pipeline completo**: OCR + Clasificación + Extracción + Google Drive + PostgreSQL
- `GET /api/documents` - Listar documentos procesados
- `GET /api/documents/:id` - Obtener documento por ID con datos extraídos
- `DELETE /api/documents/:id` - Eliminar documento de BD (⚠️ no elimina de Google Drive)

### Chat RAG (Protegido)
- `POST /api/chat/query` - Enviar consulta

---

## ⚠️ Notas Importantes

- **IA Integrada:** El procesamiento de documentos ahora usa IA directamente (Gemini + Mistral OCR) - ¡no necesitas n8n!
- **API Keys requeridas:** Configura `GOOGLE_AI_API_KEY` y `MISTRAL_API_KEY` en `backend/.env` para el procesamiento con IA
- **Google Drive:** Para usar la integración con Google Drive, primero debes autenticarte visitando `http://localhost:4000/api/google/auth`
- **Variables de entorno:** Configura `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_DRIVE_ROOT_FOLDER_ID` en `backend/.env`
- **Base de datos:** Asegúrate de que PostgreSQL esté corriendo (usa `docker-compose up -d postgres`)
- **Modelos de IA usados:**
  - OCR: `mistral-ocr-latest` (Mistral AI) + `pixtral-12b-latest` (fallback solo para imágenes)
  - Clasificación/Extracción: `gemini-2.5-flash` (Google AI)
  - **Nuevo**: Sistema de OCR inteligente con Vision para imágenes con layouts complejos
  - **Nota**: Vision solo funciona con imágenes (JPEG, PNG, WEBP), NO con PDFs

---

## 🔧 Troubleshooting

### Error: "Cannot connect to PostgreSQL"
```bash
# Verificar que PostgreSQL esté corriendo
docker-compose ps

# Iniciar PostgreSQL si está detenido
docker-compose up -d postgres
```

### Error: "Unauthorized"
- Verifica que estés usando el token correcto
- El token debe ir en el header: `Authorization: Bearer <token>`
- Los tokens expiran en 7 días

### Error: "GOOGLE_AI_API_KEY no está configurada"
- Configura la API key de Gemini en `backend/.env`
- Obtén tu API key en: https://aistudio.google.com/app/apikey

### Error: "MISTRAL_API_KEY no está configurada"
- Configura la API key de Mistral en `backend/.env`
- Obtén tu API key en: https://console.mistral.ai/
- **Nuevo**: Agrega también `MISTRAL_VISION_MODEL=pixtral-12b-latest` para layouts complejos

### Error: "Usuario no autenticado con Google Drive"
- Visita `http://localhost:4000/api/google/auth` para autenticarte
- Completa el flujo de OAuth 2.0
- Los tokens se guardan automáticamente en PostgreSQL

---

## 📚 Documentación Adicional

- [Backend README](../README.md) - Documentación general del backend
- [API Endpoints](./API-TESTS.md) - Documentación detallada de endpoints

