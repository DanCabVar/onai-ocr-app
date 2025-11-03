# ONAI OCR Backend

Backend API para el sistema de procesamiento de documentos ONAI OCR.

## 🛠️ Tecnologías

- **NestJS** - Framework de Node.js
- **TypeORM** - ORM para PostgreSQL
- **PostgreSQL** - Base de datos
- **JWT** - Autenticación
- **Axios** - Cliente HTTP para n8n
- **Bcrypt** - Hash de contraseñas

## 📋 Requisitos Previos

- Node.js 18+ 
- PostgreSQL 14+
- pnpm (gestor de paquetes)

## 🚀 Instalación

1. Instalar dependencias:
```bash
pnpm install
```

2. Configurar variables de entorno:
   - Copiar `.env.example` a `.env`
   - Actualizar las credenciales de PostgreSQL
   - Actualizar las URLs de los webhooks de n8n
   - Cambiar el JWT_SECRET en producción

3. Crear la base de datos PostgreSQL:
```sql
CREATE DATABASE onai_ocr;
```

4. Las tablas se crearán automáticamente al iniciar la aplicación (TypeORM synchronize: true)

## 🏃 Ejecutar la Aplicación

### Modo desarrollo
```bash
pnpm run start:dev
```

### Modo producción
```bash
pnpm run build
pnpm run start:prod
```

## 📚 API Endpoints

### Autenticación (Públicos)
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Login de usuario
- `GET /api/auth/profile` - Obtener perfil (protegido)

### Documentos (Protegidos - Requieren JWT)
- `POST /api/documents/upload` - Subir documento (multipart/form-data)
- `GET /api/documents` - Listar documentos del usuario
- `GET /api/documents/:id` - Obtener documento específico

### Chat RAG (Protegido - Requiere JWT)
- `POST /api/chat/query` - Enviar consulta al agente RAG

## 🔐 Autenticación

Todos los endpoints protegidos requieren un token JWT en el header:
```
Authorization: Bearer <token>
```

## 🗄️ Estructura de Base de Datos

### Tabla: users
- id (PK)
- email (unique)
- password (hash)
- name
- created_at
- updated_at

### Tabla: documents
- id (PK)
- user_id (FK -> users)
- filename
- file_type
- google_drive_link
- extracted_data (JSONB)
- status
- created_at
- updated_at

## 🔗 Integración con n8n

El backend actúa como proxy seguro para los webhooks de n8n:

1. **Webhook de Procesamiento** (`N8N_WEBHOOK_PROCESS`):
   - Recibe el archivo binario
   - Procesa con OCR (Mistral)
   - Clasifica con GPT-4
   - Extrae datos con GPT-4
   - Sube a Google Drive
   - Guarda en PostgreSQL

2. **Webhook RAG** (`N8N_WEBHOOK_RAG`):
   - Recibe la pregunta del usuario
   - Convierte a SQL con GPT-4
   - Ejecuta consulta en PostgreSQL
   - Formatea respuesta con GPT-4

## ⚠️ Notas Importantes

- `synchronize: true` en TypeORM está activado para desarrollo. **DESACTIVAR en producción**.
- Cambiar `JWT_SECRET` a un valor seguro en producción.
- Las URLs de n8n deben ser actualizadas con las reales.
- El límite de subida de archivos es 10MB.

## 🧪 Testing

```bash
# Tests unitarios
pnpm run test

# Tests e2e
pnpm run test:e2e

# Coverage
pnpm run test:cov
```

## 📝 Variables de Entorno

Ver `.env.example` para la lista completa de variables requeridas.

## 🧪 Testing de Endpoints

Ver la carpeta [tests/](./tests/) para scripts y documentación de pruebas:
- `tests/test-endpoints.ps1` - Script automatizado de pruebas
- `tests/API-TESTS.md` - Documentación completa de endpoints
- `tests/thunder-collection.json` - Colección de Thunder Client
- `tests/README.md` - Guía de uso de las pruebas

