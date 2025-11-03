# 🚀 Guía de Despliegue con Dokploy

## 📋 Pre-requisitos

1. ✅ Servidor con Dokploy instalado
2. ✅ Dominio configurado apuntando a tu servidor
3. ✅ API Keys de Google AI y Mistral AI
4. ✅ Credenciales OAuth de Google Cloud

---

## 🔧 Paso 1: Preparar el Repositorio

### 1.1 Asegúrate de que todo esté commiteado

```bash
git add .
git commit -m "Preparar para despliegue con Docker"
git push origin main
```

### 1.2 Verifica que los archivos Docker estén presentes

- ✅ `backend/Dockerfile`
- ✅ `backend/.dockerignore`
- ✅ `frontend/Dockerfile`
- ✅ `frontend/.dockerignore`
- ✅ `docker-compose.yml`

---

## 🎯 Paso 2: Crear Proyecto en Dokploy

### 2.1 Acceder a Dokploy

1. Accede a tu panel de Dokploy: `https://tu-servidor:3000`
2. Click en **"New Project"**
3. Nombre: `onai-ocr-app`

### 2.2 Conectar Repositorio

1. Click en **"Add Service"** → **"Docker Compose"**
2. Conecta tu repositorio Git (GitHub/GitLab/Gitea)
3. Selecciona la rama: `main`
4. Path del docker-compose: `./docker-compose.yml`

---

## 🔐 Paso 3: Configurar Variables de Entorno

En Dokploy, ve a **Environment Variables** y agrega:

### Base de Datos
```
DB_USER=postgres
DB_PASSWORD=TU_PASSWORD_SEGURA_AQUI
DB_NAME=onai_ocr
DB_PORT=5432
```

### JWT
```
JWT_SECRET=TU_SECRET_MUY_LARGO_Y_COMPLEJO_AQUI_12345678901234567890
JWT_EXPIRATION=7d
```

### URLs (Actualiza con tu dominio)
```
BACKEND_PORT=4000
FRONTEND_PORT=3000
FRONTEND_URL=https://tu-dominio.com
NEXT_PUBLIC_API_URL=https://tu-dominio.com/api
```

### Google Drive OAuth
```
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REDIRECT_URI=https://tu-dominio.com/api/google/callback
GOOGLE_SCOPES=https://www.googleapis.com/auth/drive.file,https://www.googleapis.com/auth/drive
```

### Google AI (Gemini)
```
GOOGLE_AI_API_KEY=tu_google_ai_api_key
GEMINI_MODEL=gemini-2.0-flash-exp
CLASSIFICATION_CONFIDENCE_THRESHOLD=0.7
```

### Mistral AI
```
MISTRAL_API_KEY=tu_mistral_api_key
MISTRAL_OCR_MODEL=mistral-ocr-latest
MISTRAL_VISION_MODEL=pixtral-12b-latest
```

### Opcional
```
OTHERS_FOLDER_NAME=Otros Documentos
OTHERS_FOLDER_DESCRIPTION=Documentos sin clasificación automática
```

---

## 🌐 Paso 4: Configurar Dominios

### 4.1 En Dokploy

1. Ve a **Domains**
2. Agrega tu dominio: `tu-dominio.com`
3. Configura:
   - **Service**: `frontend` (puerto 3000)
   - **Enable HTTPS**: ✅ (Dokploy genera certificado SSL automáticamente)

4. Agrega subdominio API:
   - **Domain**: `tu-dominio.com/api`
   - **Service**: `backend` (puerto 4000)
   - **Path**: `/api`

### 4.2 En Google Cloud Console

1. Ve a: https://console.cloud.google.com/
2. Selecciona tu proyecto
3. Ve a **APIs & Services** → **Credentials**
4. Edita tu OAuth 2.0 Client ID
5. Agrega en **Authorized redirect URIs**:
   ```
   https://tu-dominio.com/api/google/callback
   ```

---

## 🚀 Paso 5: Desplegar

### 5.1 Build y Deploy

1. En Dokploy, click en **"Deploy"**
2. Dokploy ejecutará:
   ```bash
   docker-compose build
   docker-compose up -d
   ```

3. Espera 5-10 minutos para el primer build

### 5.2 Verificar Logs

1. Ve a **Logs** en Dokploy
2. Verifica que los 3 servicios estén corriendo:
   - ✅ `postgres` - Healthy
   - ✅ `backend` - Running
   - ✅ `frontend` - Running

---

## ✅ Paso 6: Verificar Funcionamiento

### 6.1 Verificar Backend

```bash
curl https://tu-dominio.com/api/auth/login
```

Debería responder con un error de validación (esperado sin credenciales)

### 6.2 Verificar Frontend

Abre en navegador: `https://tu-dominio.com`

Deberías ver la página de login/registro

### 6.3 Verificar PostgreSQL

En Dokploy, ejecuta en el contenedor `postgres`:

```bash
psql -U postgres -d onai_ocr -c "\dt"
```

Deberías ver las tablas: `users`, `documents`, `document_types`, `google_tokens`

---

## 🔄 Actualizaciones Futuras

### Actualizar la aplicación:

1. Haz commit de tus cambios:
   ```bash
   git add .
   git commit -m "Actualización"
   git push origin main
   ```

2. En Dokploy, click en **"Redeploy"**

3. Dokploy reconstruirá solo lo que cambió (Docker layers cacheadas)

---

## 🐛 Troubleshooting

### Backend no arranca

**Síntoma**: Backend en estado "unhealthy"

**Solución**:
1. Verifica logs: `docker-compose logs backend`
2. Verifica que todas las variables de entorno estén configuradas
3. Asegúrate de que PostgreSQL esté healthy primero

### Frontend no conecta con Backend

**Síntoma**: Errores de CORS o 404

**Solución**:
1. Verifica `NEXT_PUBLIC_API_URL` apunte a tu dominio
2. Verifica que `FRONTEND_URL` en backend coincida
3. Reconstruye el frontend: `docker-compose build frontend`

### Error de OAuth Google

**Síntoma**: "redirect_uri_mismatch"

**Solución**:
1. Verifica `GOOGLE_REDIRECT_URI` en las variables de entorno
2. Agrega esa misma URL en Google Cloud Console
3. Reinicia el backend

### Base de datos pierde datos

**Síntoma**: Los datos desaparecen al reiniciar

**Solución**:
1. Verifica que el volumen `postgres_data` esté persistiendo
2. En Dokploy, asegúrate de que los volúmenes estén habilitados
3. No uses `docker-compose down -v` en producción

---

## 📊 Monitoreo

### Ver logs en tiempo real:

```bash
# Todos los servicios
docker-compose logs -f

# Solo backend
docker-compose logs -f backend

# Solo frontend
docker-compose logs -f frontend

# Solo postgres
docker-compose logs -f postgres
```

### Ver estado de servicios:

```bash
docker-compose ps
```

### Ver uso de recursos:

```bash
docker stats
```

---

## 🔒 Seguridad en Producción

1. ✅ Usa contraseñas fuertes para DB_PASSWORD
2. ✅ Genera un JWT_SECRET único y complejo
3. ✅ Nunca subas el archivo `.env` a Git
4. ✅ Configura firewall para cerrar puertos innecesarios
5. ✅ Usa HTTPS (Dokploy lo hace automáticamente con Let's Encrypt)
6. ✅ Mantén actualizadas las dependencias
7. ✅ Haz backups regulares de PostgreSQL

---

## 💾 Backup de Base de Datos

### Crear backup:

```bash
docker-compose exec postgres pg_dump -U postgres onai_ocr > backup_$(date +%Y%m%d).sql
```

### Restaurar backup:

```bash
docker-compose exec -T postgres psql -U postgres onai_ocr < backup_20250103.sql
```

---

## 🎉 ¡Listo!

Tu aplicación ONAI OCR está desplegada y lista para usar en producción con Dokploy. 🚀

Para soporte, consulta:
- Documentación de Dokploy: https://docs.dokploy.com
- Docker Compose: https://docs.docker.com/compose/

