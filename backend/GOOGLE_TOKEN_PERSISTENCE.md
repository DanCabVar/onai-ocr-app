# 💾 Persistencia de Tokens de Google Drive

## 📋 Resumen

Se ha implementado un sistema de persistencia de tokens OAuth de Google Drive en PostgreSQL, eliminando la necesidad de re-autenticarse en cada reinicio del backend.

---

## ✅ Lo que se implementó

### **1. Nueva Tabla: `google_tokens`**

Tabla en PostgreSQL para almacenar los tokens de acceso y refresh de Google Drive:

```sql
CREATE TABLE google_tokens (
  id SERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at BIGINT,           -- Timestamp en milisegundos
  scope TEXT,
  token_type VARCHAR DEFAULT 'Bearer',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Características:**
- Solo almacena **un token global** (no por usuario)
- Guarda tanto `access_token` como `refresh_token`
- Registra cuándo expira el token
- Se actualiza automáticamente cuando se refresca

---

### **2. GoogleTokenService**

Servicio para gestionar los tokens en la base de datos:

**Métodos:**
- `saveTokens()` - Guarda o actualiza tokens
- `getToken()` - Obtiene el token guardado
- `isTokenExpired()` - Verifica si el token expiró
- `deleteToken()` - Elimina el token

---

### **3. GoogleAuthService mejorado**

**Implementa `OnModuleInit`:**
- Al iniciar el módulo, carga automáticamente los tokens guardados
- Si el token expiró, intenta refrescarlo automáticamente
- Si no puede refrescar, elimina el token y pide re-autenticación

**Métodos modificados:**
- `getTokensFromCode()` - Ahora guarda en BD después de obtener tokens
- `refreshAccessToken()` - Guarda tokens actualizados en BD
- `loadTokensFromDatabase()` - Carga tokens al iniciar (privado)

---

## 🚀 Cómo Funciona

### **Flujo de Autenticación (Primera vez)**

1. Usuario visita `/api/google/auth`
2. Autoriza con Google
3. Backend recibe código y lo intercambia por tokens
4. **✨ Tokens se guardan en PostgreSQL**
5. Backend puede usar Google Drive

### **Flujo al Reiniciar el Backend**

1. Backend inicia
2. `GoogleAuthService` se inicializa
3. **✨ Carga tokens automáticamente desde PostgreSQL**
4. Verifica si el token expiró:
   - **Si NO expiró:** Usa el token cargado
   - **Si expiró y hay refresh_token:** Refresca automáticamente y guarda
   - **Si expiró y NO hay refresh_token:** Elimina token y pide re-autenticación

---

## 🔄 Refresh Automático de Tokens

Los tokens de Google Drive tienen una duración limitada (típicamente 1 hora). El sistema maneja esto automáticamente:

### **Al cargar tokens al inicio:**
```typescript
// Si el token expiró
if (tokenExpirado && hayRefreshToken) {
  // Refresca automáticamente
  const nuevoToken = await refreshAccessToken();
  // Guarda el nuevo token en BD
  await guardarEnBD(nuevoToken);
}
```

### **Buffer de seguridad:**
- Se considera "expirado" si le quedan menos de 5 minutos
- Esto evita que el token expire en medio de una operación

---

## 📊 Ejemplo de Datos en BD

```sql
SELECT * FROM google_tokens;
```

**Resultado:**
```
id | access_token              | refresh_token           | expires_at    | scope                           | created_at
---+---------------------------+-------------------------+---------------+---------------------------------+------------
1  | ya29.a0AfB_byC...         | 1//0gK8X...             | 1730592847000 | https://www.googleapis.com/... | 2025-11-02
```

---

## 🧪 Cómo Probar

### **Prueba 1: Autenticar y verificar persistencia**

```powershell
# 1. Autenticar (primera vez)
# Visita en navegador: http://localhost:4000/api/google/auth

# 2. Verificar que se guardó en BD
# Conéctate a PostgreSQL y ejecuta:
SELECT id, 
       LEFT(access_token, 20) as token_preview, 
       expires_at, 
       created_at 
FROM google_tokens;

# 3. Crear un tipo de documento desde el frontend
# Debería crear carpeta en Drive exitosamente

# 4. Reiniciar el backend
# Detén el backend (Ctrl+C) y reinicia:
cd backend
pnpm run start:dev

# 5. Verificar en logs
# Deberías ver:
# [GoogleAuthService] Tokens cargados desde base de datos

# 6. Crear otro tipo de documento
# Debería funcionar SIN re-autenticarte
```

### **Prueba 2: Refresh automático (simulado)**

```sql
-- Modificar manualmente el expires_at para que esté en el pasado
UPDATE google_tokens 
SET expires_at = (EXTRACT(EPOCH FROM NOW()) * 1000) - 3600000 
WHERE id = 1;

-- Reiniciar el backend
-- Debería refrescar automáticamente y actualizar expires_at
```

### **Prueba 3: Verificar logs detallados**

Al reiniciar el backend, verás logs como:

**Si hay token válido:**
```
[GoogleAuthService] OAuth2 client initialized
[GoogleAuthService] Tokens cargados desde base de datos
```

**Si el token expiró pero se refrescó:**
```
[GoogleAuthService] OAuth2 client initialized
[GoogleAuthService] Token expirado, intentando refrescar...
[GoogleAuthService] Access token refreshed and saved to database
[GoogleAuthService] Token refrescado exitosamente
```

**Si no hay tokens guardados:**
```
[GoogleAuthService] OAuth2 client initialized
[GoogleAuthService] No hay tokens guardados en la base de datos
```

---

## 🔒 Seguridad

### **Almacenamiento de Tokens**

✅ **Buenas prácticas implementadas:**
- Tokens se guardan en PostgreSQL (no en archivos)
- Conexión a BD está protegida por credenciales
- Los tokens no se exponen en logs (solo se menciona que existen)

⚠️ **Consideraciones adicionales (para producción):**

1. **Encriptación de tokens:**
   ```typescript
   // Opción: Encriptar access_token antes de guardar
   const encryptedToken = encrypt(accessToken, ENCRYPTION_KEY);
   await saveToDatabase(encryptedToken);
   ```

2. **Variables de entorno:**
   - Nunca subir `.env` a Git
   - Usar secrets manager en producción (AWS Secrets, Azure Key Vault, etc.)

3. **HTTPS obligatorio:**
   - En producción, usar HTTPS para todos los endpoints
   - Evita que tokens se intercepten

---

## 🛠️ Comandos Útiles

### **Ver tokens en BD**

```sql
-- Ver todos los tokens
SELECT * FROM google_tokens;

-- Ver solo si hay token válido
SELECT id, 
       CASE WHEN expires_at > (EXTRACT(EPOCH FROM NOW()) * 1000) 
            THEN 'Válido' 
            ELSE 'Expirado' 
       END as estado,
       to_timestamp(expires_at / 1000) as expira_en
FROM google_tokens;
```

### **Eliminar token manualmente**

```sql
-- Forzar re-autenticación eliminando el token
DELETE FROM google_tokens;
```

### **Verificar estado desde API**

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/google/status" -Method GET
```

---

## 📝 Archivos Modificados/Creados

### **Nuevos archivos:**
```
backend/
├── src/
│   ├── database/entities/
│   │   └── google-token.entity.ts          (NUEVO)
│   └── google-drive/services/
│       └── google-token.service.ts         (NUEVO)
└── GOOGLE_TOKEN_PERSISTENCE.md            (NUEVO)
```

### **Archivos modificados:**
```
backend/src/
├── google-drive/
│   ├── google-drive.module.ts             (Importa GoogleToken y GoogleTokenService)
│   └── services/
│       └── google-auth.service.ts         (Implementa OnModuleInit, carga tokens)
└── app.module.ts                          (Registra GoogleToken entity)
```

---

## 🚨 Troubleshooting

### **Error: "No hay tokens guardados en la base de datos"**

**Causa:** Primera vez que se usa el sistema o se eliminó el token.

**Solución:** Autenticar visitando `http://localhost:4000/api/google/auth`

---

### **Error: "Token expirado y no hay refresh token"**

**Causa:** El refresh token no se guardó o se perdió.

**Solución:** 
1. Eliminar token de BD: `DELETE FROM google_tokens;`
2. Re-autenticar: `http://localhost:4000/api/google/auth`

---

### **Error: "Error refreshing access token"**

**Causa:** El refresh token también expiró o fue revocado.

**Solución:**
1. Eliminar token de BD
2. Re-autenticar con Google

---

### **Los tokens no se guardan**

**Verificar:**
1. ¿La tabla `google_tokens` existe?
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'google_tokens';
   ```

2. ¿TypeORM sincronizó las tablas?
   - Verifica `synchronize: true` en `app.module.ts`
   - Reinicia el backend

3. ¿Hay errores en los logs del backend?
   - Busca mensajes de `GoogleTokenService`

---

## 🎯 Próximas Mejoras (Opcional)

### **1. Tokens por usuario**

Actualmente hay un token global. Se podría implementar tokens individuales por usuario:

```typescript
// Modificar google-token.entity.ts
@Entity('google_tokens')
export class GoogleToken {
  // ... campos existentes
  
  @Column({ name: 'user_id', nullable: true })
  userId: number;
  
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
```

### **2. Encriptación de tokens**

Agregar encriptación AES-256 para los tokens:

```typescript
import * as crypto from 'crypto';

function encryptToken(token: string): string {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  return cipher.update(token, 'utf8', 'hex') + cipher.final('hex');
}
```

### **3. Rotación automática de tokens**

Implementar rotación periódica de tokens cada X días.

---

## ✅ Beneficios

✅ **No más re-autenticación** en cada reinicio
✅ **Refresh automático** de tokens
✅ **Más robusto** para producción
✅ **Mejor experiencia** de usuario
✅ **Logs detallados** para debugging

---

## 📚 Recursos

- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [TypeORM Docs](https://typeorm.io/)
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)

---

¿Necesitas más información o quieres implementar alguna mejora adicional? 🚀

