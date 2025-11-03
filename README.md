# 🚀 ONAI OCR - Sistema Avanzado de Procesamiento de Documentos

Sistema full-stack de procesamiento inteligente de documentos con:
- ✅ OCR multimodal (Mistral + Pixtral)
- ✅ Clasificación automática con IA (Gemini 2.5 Flash)
- ✅ **Homologación avanzada de campos** (consolida nombres diferentes)
- ✅ **Re-extracción con schema unificado** (100% de consistencia)
- ✅ Integración con Google Drive
- ✅ Inferencia de tipos desde documentos de ejemplo (2-10 archivos)
- ✅ Chat AI para consultas (RAG) - *En desarrollo*

## 📁 Estructura del Proyecto

```
8. ONAI OCR/
├── frontend/          # Next.js 16 - Interfaz de usuario
├── backend/           # NestJS - API REST
├── docker-compose.yml # Orquestación de servicios
└── .env.docker        # Variables de entorno para Docker
```

## ✨ Características Destacadas

### 🤖 Homologación Avanzada de Campos
Cuando subes múltiples documentos del mismo tipo:
1. **Extrae campos** de cada documento independientemente
2. **Agrupa equivalentes** (ej: `seller_name` + `issuing_company` → `vendedor_nombre`)
3. **Re-extrae con schema unificado** garantizando 100% de consistencia
4. **Resultado:** Todos los documentos del mismo tipo tienen EXACTAMENTE los mismos campos

### 🔍 Fusión Inteligente de Tipos
- Detecta tipos similares automáticamente
- Ejemplo: "Orden de Retiro" + "Orden de Despacho / Retiro" → "Orden de Retiro"
- Usa análisis semántico con Gemini

### 📄 Inferencia de Tipos desde Ejemplos
- Sube 2-10 documentos de ejemplo
- La IA identifica tipos automáticamente
- Consolida campos comunes
- Crea tipos de documento listos para usar

### 🎯 Parser JSON Robusto
- Tolera errores comunes de Gemini
- Reintentos automáticos con limpieza agresiva
- Logs detallados para debugging

## 🛠️ Tecnologías

### Frontend
- **Next.js 16** (App Router)
- **React 19**
- **TailwindCSS**
- **shadcn/ui**
- **TypeScript**
- **Axios** (con timeout de 15 minutos para procesos largos)

### Backend
- **NestJS** (Framework modular)
- **TypeORM** (ORM para PostgreSQL)
- **PostgreSQL 15** (Base de datos)
- **JWT Authentication** (Passport)
- **Mistral AI** (OCR: `mistral-ocr-latest`, Vision: `pixtral-12b-2409`)
- **Google Gemini** (Clasificación y extracción: `gemini-2.5-flash`)
- **Google Drive API** (OAuth 2.0 para almacenamiento)

### Infraestructura
- **Docker & Docker Compose**
- **PostgreSQL 15** (Alpine)
- **Traefik** (Reverse proxy - Dokploy)
- **Dokploy** (Deployment automation)

## 🚀 Inicio Rápido

### Opción 1: Con Docker (Recomendado)

1. **Levantar PostgreSQL:**
```bash
docker-compose up -d postgres
```

2. **Verificar que PostgreSQL esté corriendo:**
```bash
docker-compose ps
```

3. **Ver logs de PostgreSQL:**
```bash
docker-compose logs -f postgres
```

### Opción 2: Desarrollo Local

#### Backend
```bash
cd backend
pnpm install
pnpm run start:dev
```

#### Frontend
```bash
cd frontend
pnpm install
pnpm dev
```

## 📚 Documentación

- [Backend README](./backend/README.md) - Documentación del API
- [Frontend README](./frontend/README.md) - Documentación del frontend

## 🔗 URLs de Desarrollo

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000/api
- **PostgreSQL:** localhost:5432

## 📝 Variables de Entorno

### Para Docker Compose
Editar `.env.docker` con tus configuraciones.

### Para Backend Local
Editar `backend/.env` con tus configuraciones.

### Para Frontend Local
Crear `frontend/.env.local` con:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

## 🐳 Comandos Docker Útiles

```bash
# Levantar todos los servicios
docker-compose up -d

# Levantar solo PostgreSQL
docker-compose up -d postgres

# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f postgres

# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (⚠️ elimina datos)
docker-compose down -v

# Reconstruir imágenes
docker-compose build

# Reconstruir y levantar
docker-compose up -d --build
```

## 📊 Base de Datos

### Estructura de Tablas

#### `users`
- id (PK)
- email (unique)
- password (hash)
- name
- created_at, updated_at

#### `documents`
- id (PK)
- user_id (FK)
- filename
- file_type
- google_drive_link
- extracted_data (JSONB)
- status
- created_at, updated_at

## 🔐 Autenticación

El sistema usa JWT para autenticación. Todos los endpoints (excepto login/register) requieren un token válido.

## 🧪 Testing

```bash
# Backend
cd backend
pnpm run test

# Frontend
cd frontend
pnpm test
```

## 📦 Despliegue en Producción

### 🌐 Dominio
- **Producción:** https://ocr.onaiconsulting.cl
- **DNS:** Cloudflare
- **Hosting:** VPS Hostinger

### 🚀 Stack de Producción
- **Dokploy:** Gestor de aplicaciones (como Vercel para VPS)
- **Traefik:** Reverse proxy con SSL automático (Let's Encrypt)
- **PostgreSQL:** Base de datos persistente
- **GitHub:** CI/CD automático (push → deploy)

### 📋 Checklist de Despliegue
- [ ] 1. Crear Dockerfiles (backend + frontend)
- [ ] 2. Configurar `docker-compose.yml` optimizado
- [ ] 3. Subir código a GitHub (`https://github.com/DanCabVar/onai-ocr-app`)
- [ ] 4. Configurar DNS en Cloudflare (`ocr.onaiconsulting.cl → IP VPS`)
- [ ] 5. Crear aplicación en Dokploy
- [ ] 6. Configurar variables de entorno en Dokploy
- [ ] 7. Trigger primer deploy
- [ ] 8. Ejecutar migraciones de BD
- [ ] 9. Probar aplicación en producción

Ver guía completa en: `QUICK_START_GUIDE.md` (backend)

## 🤝 Contribución

Este es un proyecto privado. Para contribuir, contacta al equipo de desarrollo.

## 📄 Licencia

Propietario: ONAI

