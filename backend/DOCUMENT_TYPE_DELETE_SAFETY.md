# 🛡️ Seguridad en Eliminación de Tipos de Documento

## 📋 Resumen

Se ha implementado un sistema de seguridad completo para la eliminación de tipos de documento, con advertencias claras sobre las consecuencias en la base de datos y Google Drive.

---

## ✅ Lo que se implementó

### 1. **Backend - Validaciones mejoradas**

#### `backend/src/document-types/document-types.service.ts`

**Antes:**
- ✅ Validaba si hay documentos asociados
- ❌ No mencionaba Google Drive
- ❌ No advertía sobre la carpeta

**Ahora:**
- ✅ Validada si hay documentos asociados (con mensaje mejorado)
- ✅ Advierte sobre la carpeta de Google Drive
- ✅ La carpeta NO se elimina automáticamente (seguridad)
- ✅ Retorna información de la carpeta para eliminación manual
- ✅ Logs detallados en el servidor

**Respuesta del endpoint DELETE:**
```json
{
  "message": "Tipo de documento 'Facturas' eliminado exitosamente.",
  "warning": "NOTA: La carpeta en Google Drive no será eliminada por seguridad. Puedes eliminarla manualmente si lo deseas.",
  "googleDriveFolderId": "1abc123xyz...",
  "folderPath": "https://drive.google.com/drive/folders/1abc123xyz..."
}
```

---

### 2. **Frontend - Advertencias visuales**

#### `frontend/app/document-types/page.tsx`

**Antes:**
- ❌ Confirmación simple: "¿Está seguro?"
- ❌ No mencionaba consecuencias

**Ahora:**
- ✅ Advertencia detallada con información específica
- ✅ Menciona base de datos y Google Drive
- ✅ Indica que la carpeta NO se eliminará automáticamente
- ✅ Muestra warning del backend después de eliminar

**Mensaje de confirmación:**
```
¿Está seguro de eliminar el tipo "Facturas"?

⚠️ IMPORTANTE:
• Los datos en la base de datos serán eliminados
• La conexión con Google Drive se perderá
• La carpeta en Google Drive NO será eliminada (puedes eliminarla manualmente si lo deseas)

Esta acción no se puede deshacer.
```

---

### 3. **Endpoint para eliminar carpetas manualmente**

#### `DELETE /api/google/folder/:folderId`

Si el usuario decide eliminar la carpeta de Google Drive manualmente, puede usar este endpoint:

**Parámetros:**
- `folderId` (path) - ID de la carpeta a eliminar
- `checkEmpty` (query, opcional) - Si es `true`, verifica que la carpeta esté vacía

**Ejemplo 1: Eliminar solo si está vacía**
```bash
DELETE http://localhost:4000/api/google/folder/1abc123xyz?checkEmpty=true
```

**Ejemplo 2: Eliminar sin verificar (forzar)**
```bash
DELETE http://localhost:4000/api/google/folder/1abc123xyz
```

**Respuesta exitosa:**
```json
{
  "message": "Carpeta eliminada exitosamente de Google Drive",
  "folderId": "1abc123xyz..."
}
```

**Respuesta error (carpeta no vacía):**
```json
{
  "message": "La carpeta contiene 5 archivo(s). Elimínalos primero antes de eliminar la carpeta.",
  "error": true
}
```

---

## 🔒 Políticas de Seguridad

### **¿Por qué NO se elimina la carpeta automáticamente?**

1. **Prevención de pérdida de datos** 
   - La carpeta puede contener documentos importantes
   - Puede haber archivos que aún no están en la base de datos

2. **Reversibilidad**
   - Si se elimina un tipo por error, los archivos siguen en Drive
   - Puedes recrear el tipo y reconectar la carpeta

3. **Auditoría**
   - El administrador puede revisar qué había en la carpeta antes de eliminarla
   - Permite hacer backup manual si es necesario

4. **Separación de responsabilidades**
   - La base de datos es una cosa
   - Google Drive es otra
   - El usuario decide qué hacer con cada uno

---

## 📝 Flujo Completo de Eliminación

### **Escenario 1: Eliminar tipo sin documentos**

1. Usuario hace clic en **Eliminar** (icono de basura)
2. Frontend muestra advertencia detallada
3. Usuario confirma
4. Backend:
   - Verifica que no tenga documentos
   - Elimina el tipo de la BD
   - NO elimina la carpeta de Drive
   - Retorna warning con ID de carpeta
5. Frontend muestra toast con mensaje de éxito y warning
6. Usuario decide manualmente si eliminar la carpeta de Drive

### **Escenario 2: Intentar eliminar tipo CON documentos**

1. Usuario hace clic en **Eliminar**
2. Frontend muestra advertencia
3. Usuario confirma
4. Backend:
   - Detecta que tiene documentos asociados
   - **Rechaza la eliminación**
   - Retorna error: "No se puede eliminar porque tiene X documento(s) asociado(s)"
5. Frontend muestra error en toast

---

## 🧪 Cómo Probar

### **Prueba 1: Eliminar tipo sin documentos**

```powershell
# 1. Login
$token = "tu-jwt-token"
$headers = @{ "Authorization" = "Bearer $token" }

# 2. Eliminar tipo (ID = 4)
$response = Invoke-RestMethod `
  -Uri "http://localhost:4000/api/document-types/4" `
  -Method DELETE `
  -Headers $headers

# Verificar respuesta
$response.message    # "Tipo eliminado exitosamente"
$response.warning    # "NOTA: La carpeta en Google Drive no será eliminada..."
$response.googleDriveFolderId  # ID de la carpeta
```

### **Prueba 2: Eliminar carpeta de Drive manualmente**

```powershell
# Usar el googleDriveFolderId de la respuesta anterior
$folderId = "1uofQJWxoYTJeJvuj9NYYd33QAqm1TuxO"

# Opción A: Eliminar solo si está vacía
Invoke-RestMethod `
  -Uri "http://localhost:4000/api/google/folder/$folderId?checkEmpty=true" `
  -Method DELETE

# Opción B: Eliminar de todos modos (forzar)
Invoke-RestMethod `
  -Uri "http://localhost:4000/api/google/folder/$folderId" `
  -Method DELETE
```

### **Prueba 3: Intentar eliminar tipo CON documentos**

Esto debería fallar con un mensaje claro:

```powershell
# Intentar eliminar tipo que tiene documentos
Invoke-RestMethod `
  -Uri "http://localhost:4000/api/document-types/1" `
  -Method DELETE `
  -Headers $headers

# Error esperado:
# "No se puede eliminar el tipo de documento 'Factura' 
#  porque tiene 3 documento(s) asociado(s). 
#  Elimina primero los documentos asociados."
```

---

## 🔧 Configuración Adicional (Opcional)

### **Opción: Eliminar carpeta automáticamente**

Si quieres que la carpeta SÍ se elimine automáticamente, modifica:

```typescript
// backend/src/document-types/document-types.service.ts
async remove(id: number, user: User) {
  // ... código existente ...

  // AGREGAR ESTO antes de eliminar de BD:
  if (documentType.googleDriveFolderId) {
    try {
      await this.googleDriveService.deleteFile(
        documentType.googleDriveFolderId,
        true, // Verificar que esté vacía
      );
      this.logger.log(`Carpeta de Drive eliminada: ${documentType.googleDriveFolderId}`);
    } catch (error) {
      this.logger.error(`No se pudo eliminar carpeta de Drive: ${error.message}`);
      // Continuar de todos modos
    }
  }

  // ... resto del código ...
}
```

⚠️ **ADVERTENCIA:** Esto eliminará la carpeta automáticamente. Solo habilítalo si estás seguro.

---

## 📊 Endpoints Actualizados

### **Document Types**
- `DELETE /api/document-types/:id` 
  - ✅ Mejorado con advertencias
  - ✅ Retorna info de Google Drive
  - ✅ NO elimina carpeta de Drive

### **Google Drive**
- `DELETE /api/google/folder/:folderId`
  - ✨ **NUEVO**
  - Elimina carpeta manualmente
  - Opcional: verificar que esté vacía

---

## 🎯 Próximos Pasos Recomendados

1. **Interfaz mejorada en Frontend (Feature 2B)**
   - Mostrar carpetas de Drive en "Rutas de Archivos"
   - Botón para eliminar carpetas desde la UI
   - Visualización de qué carpetas están "huérfanas"

2. **Script de limpieza**
   - Detectar carpetas en Drive sin tipo asociado
   - Sugerir eliminación o reasignación

3. **Archivado en vez de eliminación**
   - Agregar campo `archived` en DocumentType
   - En vez de eliminar, marcar como archivado
   - Ocultar en la UI pero mantener en BD

---

## 📚 Documentación Relacionada

- [GOOGLE_DRIVE_QUICKSTART.md](./GOOGLE_DRIVE_QUICKSTART.md) - Guía de integración
- [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md) - Configuración OAuth
- [tests/README.md](./tests/README.md) - Scripts de prueba

---

## ✅ Checklist de Seguridad

- [x] Validación de documentos asociados
- [x] Advertencia clara en frontend
- [x] Mensaje descriptivo de consecuencias
- [x] Carpeta de Drive NO se elimina automáticamente
- [x] Endpoint para eliminación manual de carpetas
- [x] Verificación de carpeta vacía (opcional)
- [x] Logs detallados en servidor
- [x] Información de carpeta en respuesta
- [x] Manejo de errores apropiado
- [x] Documentación completa

---

¿Necesitas ayuda adicional o quieres implementar alguna mejora? 🚀

