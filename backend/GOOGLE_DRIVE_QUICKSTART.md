# 🚀 Google Drive Integration - Guía Rápida

## ✅ Lo que se ha implementado

### Backend (NestJS)
- ✅ Módulo completo de Google Drive con OAuth 2.0
- ✅ Servicio de autenticación (`GoogleAuthService`)
- ✅ Servicio de operaciones en Drive (`GoogleDriveService`)
- ✅ Endpoints REST para autenticación y gestión
- ✅ Integración automática: Al crear un tipo de documento se crea una carpeta en Google Drive
- ✅ Scripts de prueba automatizados

### Funcionalidades
1. **Autenticación OAuth 2.0** - El usuario autoriza la app una vez
2. **Crear carpetas automáticamente** - Al crear un tipo de documento
3. **Listar carpetas/archivos** - Explorar Google Drive desde la API
4. **Guardar IDs y paths** - En la base de datos PostgreSQL

---

## 📋 Pasos para Configurar

### 1. Agregar Variables de Entorno

Edita el archivo `backend/.env` y agrega:

```env
# Google Drive OAuth 2.0 Configuration
GOOGLE_CLIENT_ID=tu-client-id-aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret-aqui
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google/callback
GOOGLE_SCOPES=https://www.googleapis.com/auth/drive.file,https://www.googleapis.com/auth/drive.metadata.readonly

# Google Drive Root Folder
GOOGLE_DRIVE_ROOT_FOLDER_ID=tu-folder-id-aqui
```

**¿Dónde obtengo estos valores?**
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` → Los copiaste de Google Cloud Console
- `GOOGLE_REDIRECT_URI` → Debe ser exactamente `http://localhost:4000/api/google/callback`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID` → El ID de la carpeta "ONAI OCR Documents" que creaste

---

### 2. Instalar Dependencias (Ya está hecho)

```bash
cd backend
pnpm install
```

Ya se instalaron:
- `googleapis` - Cliente oficial de Google APIs
- Tipos de TypeScript para OAuth

---

### 3. Iniciar el Backend

```bash
cd backend
pnpm run start:dev
```

Deberías ver:

```
🚀 Servidor corriendo en http://localhost:4000
📚 API disponible en http://localhost:4000/api
☁️  Endpoints de Google Drive:
   - GET  http://localhost:4000/api/google/auth (Autorizar con Google)
   - GET  http://localhost:4000/api/google/callback (OAuth callback)
   - GET  http://localhost:4000/api/google/status (Verificar autenticación)
   - GET  http://localhost:4000/api/google/files (Listar carpeta raíz)
```

---

## 🔐 Autenticarse con Google Drive

### Paso 1: Visitar URL de Autorización

Abre en tu navegador:

```
http://localhost:4000/api/google/auth
```

Esto te redirigirá a Google para autorizar la aplicación.

### Paso 2: Autorizar

1. Selecciona tu cuenta de Google
2. Acepta los permisos solicitados:
   - Ver y gestionar archivos de Google Drive
3. Google te redirigirá de vuelta a: `http://localhost:4000/api/google/callback`

### Paso 3: Confirmación

Verás una página de confirmación:

```
✅ ¡Autenticación Exitosa!

Tu cuenta de Google Drive ha sido conectada correctamente.
Ahora puedes crear tipos de documento y las carpetas se crearán automáticamente.

[Ir a Tipos de Documento]
```

---

## 🧪 Probar la Integración

### Opción 1: Script Automatizado (Recomendado)

```powershell
cd backend/tests
.\test-google-drive.ps1
```

Este script:
1. ✅ Verifica el estado de autenticación
2. ✅ Crea un tipo de documento de prueba ("Facturas Test")
3. ✅ **Crea automáticamente una carpeta en Google Drive**
4. ✅ Lista las carpetas en Drive
5. ✅ Muestra IDs y paths de las carpetas creadas

### Opción 2: Thunder Client

Importa `backend/tests/thunder-collection.json` en Thunder Client y prueba:

1. **Login** → Obtén el token
2. **Google Drive - Status** → Verifica autenticación
3. **Create Document Type** → Crea un tipo (se crea carpeta automáticamente)
4. **List Document Types** → Verifica que tenga `googleDriveFolderId`
5. **Google Drive - List Root Files** → Ve las carpetas creadas

### Opción 3: Manual (curl/PowerShell)

#### Verificar estado de autenticación

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/google/status" -Method GET
```

**Respuesta esperada (autenticado):**
```json
{
  "authenticated": true,
  "hasAccessToken": true,
  "message": "Usuario autenticado con Google Drive"
}
```

#### Crear tipo de documento (crea carpeta en Drive)

```powershell
$token = "tu-jwt-token-aqui"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$body = @{
    name = "Facturas"
    description = "Facturas de clientes"
    fields = @(
        @{
            name = "numero_factura"
            label = "Número de Factura"
            type = "string"
            required = $true
        },
        @{
            name = "total"
            label = "Total"
            type = "number"
            required = $true
        }
    )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:4000/api/document-types" -Method POST -Headers $headers -Body $body
```

**Respuesta esperada:**
```json
{
  "id": 1,
  "name": "Facturas",
  "description": "Facturas de clientes",
  "fieldSchema": { ... },
  "googleDriveFolderId": "1abc123xyz...",
  "folderPath": "https://drive.google.com/drive/folders/1abc123xyz...",
  "createdAt": "2025-11-02T...",
  "updatedAt": "2025-11-02T..."
}
```

#### Listar carpetas en Google Drive

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/google/files" -Method GET
```

**Respuesta esperada:**
```json
{
  "folderId": "root-folder-id",
  "filesCount": 2,
  "files": [
    {
      "id": "1abc123xyz...",
      "name": "Facturas",
      "mimeType": "application/vnd.google-apps.folder",
      "webViewLink": "https://drive.google.com/drive/folders/1abc123xyz...",
      "createdTime": "2025-11-02T..."
    }
  ]
}
```

---

## 📊 Base de Datos

### Tabla `document_types`

La columna `google_drive_folder_id` ahora guarda el ID de la carpeta creada:

```sql
SELECT id, name, google_drive_folder_id, folder_path 
FROM document_types;
```

**Ejemplo de resultado:**
```
id | name      | google_drive_folder_id | folder_path
---+-----------+------------------------+-------------------------------------
1  | Facturas  | 1abc123xyz...          | https://drive.google.com/drive/...
```

---

## 🔍 Verificar en Google Drive

1. Ve a [Google Drive](https://drive.google.com)
2. Busca la carpeta "ONAI OCR Documents"
3. Dentro deberías ver las carpetas creadas:
   - `Facturas`
   - `Facturas Test` (si ejecutaste el script de prueba)

---

## 🐛 Troubleshooting

### Error: "Usuario no autenticado con Google Drive"

**Solución:** Visita `http://localhost:4000/api/google/auth` y autoriza la aplicación.

### Error: "Cannot find module 'googleapis'"

**Solución:**
```bash
cd backend
pnpm install googleapis
```

### Error: "Invalid redirect_uri"

**Solución:** Verifica que en Google Cloud Console hayas agregado:
```
http://localhost:4000/api/google/callback
```

### Error: "GOOGLE_DRIVE_ROOT_FOLDER_ID is undefined"

**Solución:** Asegúrate de haber configurado la variable en `backend/.env`.

### Las carpetas no se crean en Drive

**Síntomas:** Al crear un tipo de documento, `googleDriveFolderId` es `null`.

**Solución:**
1. Verifica que estés autenticado: `GET /api/google/status`
2. Revisa los logs del backend: `[GoogleDriveService] Error creating folder...`
3. Si no estás autenticado, visita `/api/google/auth`

---

## 📝 Endpoints Disponibles

### Google Drive

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/google/auth` | Inicia el flujo OAuth 2.0 |
| GET | `/api/google/callback` | Callback de Google (no llamar directamente) |
| GET | `/api/google/status` | Verifica si está autenticado |
| GET | `/api/google/files` | Lista carpeta raíz |
| GET | `/api/google/files/:folderId` | Lista carpeta específica |

### Document Types (Integrado con Drive)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/document-types` | Crea tipo + carpeta en Drive |
| GET | `/api/document-types` | Lista tipos (incluye `googleDriveFolderId`) |
| GET | `/api/document-types/:id` | Obtiene tipo específico |
| PUT | `/api/document-types/:id` | Actualiza tipo |
| DELETE | `/api/document-types/:id` | Elimina tipo |

---

## 🎯 Próximos Pasos

### Feature 2B: Visualizar Carpetas en el Frontend

Ahora que el backend está listo, el siguiente paso es crear el componente en el frontend para:

1. **Mostrar las carpetas de Google Drive** en la sección "Rutas de Archivos"
2. **Sincronizar con tipos de documento** - Mostrar qué carpeta corresponde a cada tipo
3. **Click en carpeta** → Listar documentos dentro
4. **Click en documento** → Abrir en el Visor de Documentos

¿Listo para continuar con el frontend?

---

## 📚 Recursos

- [Google Drive API Docs](https://developers.google.com/drive/api/v3/about-sdk)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Backend README](../README.md)
- [Tests README](./tests/README.md)

