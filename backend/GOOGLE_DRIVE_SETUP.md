# Google Drive OAuth 2.0 - Configuración

## Variables de Entorno

Agrega estas variables a tu archivo `backend/.env`:

```env
# Google Drive OAuth 2.0 Configuration
GOOGLE_CLIENT_ID=778343470164-rqd780nhdehqfh4esvd9u92ehnp1scdo.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret-aqui
GOOGLE_REDIRECT_URI=http://localhost:4000/api/google/callback
GOOGLE_SCOPES=https://www.googleapis.com/auth/drive.file,https://www.googleapis.com/auth/drive.metadata.readonly

# Google Drive Root Folder
GOOGLE_DRIVE_ROOT_FOLDER_ID=tu-folder-id-aqui
```

## URIs de Redirección en Google Cloud Console

Asegúrate de tener estos URIs configurados en tu OAuth Client:

```
http://localhost:4000/api/google/callback
http://localhost:3000/api/auth/google/callback
```

## Flujo de Autenticación

1. Usuario visita: `http://localhost:4000/api/google/auth`
2. Se redirige a Google para autorizar
3. Google redirige a: `http://localhost:4000/api/google/callback`
4. Backend guarda el token de acceso
5. Backend puede crear carpetas en Drive

## Endpoints Disponibles

- `GET /api/google/auth` - Inicia el flujo OAuth
- `GET /api/google/callback` - Callback de Google
- `GET /api/google/status` - Verifica si está autenticado

