# 🧪 Pruebas de API - ONAI OCR Backend

## 📋 Requisitos
- Backend corriendo en http://localhost:4000
- PostgreSQL corriendo (Docker o local)

## 🔐 1. Autenticación

### 1.1 Registrar Usuario
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"password123\",\"name\":\"Usuario Test\"}"
```

**Respuesta esperada:**
```json
{
  "user": {
    "id": 1,
    "email": "test@example.com",
    "name": "Usuario Test"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 1.2 Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"password123\"}"
```

**Respuesta esperada:**
```json
{
  "user": {
    "id": 1,
    "email": "test@example.com",
    "name": "Usuario Test"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

⚠️ **Importante:** Guarda el `accessToken` para usarlo en las siguientes peticiones.

### 1.3 Obtener Perfil (Protegido)
```bash
# Reemplaza YOUR_TOKEN con el token obtenido en login/register
curl -X GET http://localhost:4000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Respuesta esperada:**
```json
{
  "id": 1,
  "email": "test@example.com",
  "name": "Usuario Test",
  "createdAt": "2024-11-01T18:30:00.000Z"
}
```

---

## 📄 2. Documentos

### 2.1 Subir Documento (Protegido)
```bash
# Reemplaza YOUR_TOKEN y ajusta la ruta del archivo
curl -X POST http://localhost:4000/api/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/ruta/a/tu/archivo.pdf"
```

**Para Windows PowerShell:**
```powershell
# Crear un archivo de prueba primero
"Test PDF Content" | Out-File -FilePath "test-document.pdf" -Encoding UTF8

# Subir el archivo
$token = "YOUR_TOKEN"
$headers = @{
    "Authorization" = "Bearer $token"
}
Invoke-RestMethod -Uri "http://localhost:4000/api/documents/upload" `
  -Method Post `
  -Headers $headers `
  -Form @{file = Get-Item -Path "test-document.pdf"}
```

**Respuesta esperada:**
```json
{
  "status": "success",
  "message": "Archivo procesado exitosamente",
  "document": {
    "id": 1,
    "filename": "test-document.pdf",
    "fileType": "Factura",
    "status": "completed",
    "googleDriveLink": "https://drive.google.com/...",
    "extractedData": {
      "fecha": "2024-01-15",
      "numero": "INV-001",
      "cliente": "Cliente Test"
    }
  }
}
```

⚠️ **Nota:** Si el webhook de n8n no está configurado, recibirás un error 500. Esto es normal por ahora.

### 2.2 Listar Documentos (Protegido)
```bash
curl -X GET http://localhost:4000/api/documents \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Respuesta esperada:**
```json
[
  {
    "id": 1,
    "filename": "test-document.pdf",
    "fileType": "Factura",
    "googleDriveLink": "https://drive.google.com/...",
    "extractedData": { },
    "status": "completed",
    "createdAt": "2024-11-01T18:35:00.000Z",
    "updatedAt": "2024-11-01T18:35:00.000Z"
  }
]
```

### 2.3 Obtener Documento por ID (Protegido)
```bash
# Reemplaza 1 con el ID del documento
curl -X GET http://localhost:4000/api/documents/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 💬 3. Chat / RAG

### 3.1 Enviar Query (Protegido)
```bash
curl -X POST http://localhost:4000/api/chat/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"¿Cuántos documentos he subido?\"}"
```

**Respuesta esperada:**
```json
{
  "response": "Has subido un total de 3 documentos...",
  "executedQuery": "SELECT COUNT(*) FROM documents WHERE user_id = 1",
  "timestamp": "2024-11-01T18:40:00.000Z"
}
```

⚠️ **Nota:** Si el webhook de n8n no está configurado, recibirás un error 500. Esto es normal por ahora.

---

## ❌ Pruebas de Errores

### Sin Token (401 Unauthorized)
```bash
curl -X GET http://localhost:4000/api/documents
```

**Respuesta esperada:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### Email Duplicado (409 Conflict)
```bash
# Intenta registrar el mismo email dos veces
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"password123\"}"
```

**Respuesta esperada:**
```json
{
  "statusCode": 409,
  "message": "El email ya está registrado"
}
```

### Credenciales Inválidas (401)
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"wrongpassword\"}"
```

**Respuesta esperada:**
```json
{
  "statusCode": 401,
  "message": "Credenciales inválidas"
}
```

---

## 🎯 Flujo Completo de Prueba

1. ✅ **Register** → Obtener token
2. ✅ **Get Profile** → Verificar autenticación
3. ✅ **Upload Document** → Subir archivo
4. ✅ **List Documents** → Ver documentos
5. ✅ **Get Document by ID** → Ver detalles
6. ✅ **Chat Query** → Consultar documentos

---

## 📝 Notas Importantes

- **n8n webhooks:** Los endpoints de upload y chat fallarán si n8n no está configurado. Esto es esperado.
- **Tokens JWT:** Expiran en 7 días (configurable en `.env`)
- **CORS:** Está habilitado para `http://localhost:3000`
- **Validaciones:** Todos los endpoints tienen validación de datos

