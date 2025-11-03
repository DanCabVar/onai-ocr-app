# 🚀 Comandos para Configurar Git y GitHub

## ✅ Paso 1: Verificar archivos que se van a subir

```powershell
git status
```

**Verifica que NO veas:**
- ❌ `.env` o archivos con contraseñas
- ❌ `node_modules/`
- ❌ `dist/` o `build/`
- ❌ `credentials.json` o `token.json`

---

## ✅ Paso 2: Agregar todos los archivos al staging

```powershell
git add .
```

---

## ✅ Paso 3: Verificar lo que se agregó

```powershell
git status
```

**Deberías ver:**
- ✅ `backend/` (código fuente)
- ✅ `frontend/` (código fuente)
- ✅ `.gitignore`
- ✅ `README.md`
- ✅ Archivos de configuración (package.json, tsconfig.json, etc.)

---

## ✅ Paso 4: Crear el primer commit

```powershell
git commit -m "Initial commit: ONAI OCR full-stack application with advanced field homologation"
```

---

## ✅ Paso 5: Configurar la rama principal (main)

```powershell
git branch -M main
```

---

## ✅ Paso 6: Conectar con el repositorio de GitHub

```powershell
git remote add origin https://github.com/DanCabVar/onai-ocr-app.git
```

---

## ✅ Paso 7: Verificar la conexión

```powershell
git remote -v
```

**Deberías ver:**
```
origin  https://github.com/DanCabVar/onai-ocr-app.git (fetch)
origin  https://github.com/DanCabVar/onai-ocr-app.git (push)
```

---

## ✅ Paso 8: Hacer el primer push

```powershell
git push -u origin main
```

**Nota:** Te pedirá autenticación de GitHub. Opciones:
1. **GitHub CLI** (recomendado): `gh auth login`
2. **Personal Access Token**: Crea uno en GitHub → Settings → Developer Settings → Personal Access Tokens
3. **SSH**: Configura una clave SSH en GitHub

---

## 🔐 Si te pide credenciales

### Opción A: Personal Access Token (más fácil)

1. Ve a: https://github.com/settings/tokens
2. Click en "Generate new token (classic)"
3. Scopes necesarios:
   - ✅ `repo` (acceso completo)
4. Copia el token (se muestra solo una vez)
5. Cuando Git pida contraseña, pega el token

### Opción B: GitHub CLI (recomendado)

```powershell
# Instalar GitHub CLI (si no lo tienes)
winget install GitHub.cli

# Autenticar
gh auth login
```

---

## ✅ Paso 9: Verificar que se subió correctamente

Ve a: https://github.com/DanCabVar/onai-ocr-app

Deberías ver todos tus archivos ahí.

---

## 📋 Comandos Resumen (Ejecuta en orden)

```powershell
# 1. Verificar
git status

# 2. Agregar todos los archivos
git add .

# 3. Commit
git commit -m "Initial commit: ONAI OCR full-stack application with advanced field homologation"

# 4. Cambiar rama a main
git branch -M main

# 5. Conectar con GitHub
git remote add origin https://github.com/DanCabVar/onai-ocr-app.git

# 6. Push
git push -u origin main
```

---

## 🔄 Comandos para Futuros Cambios

Una vez configurado, para subir cambios futuros:

```powershell
# Ver qué cambió
git status

# Agregar cambios
git add .

# Commit con mensaje descriptivo
git commit -m "Feature: descripción del cambio"

# Push
git push
```

---

## ⚠️ IMPORTANTE: Antes de Hacer Push

### ✅ Verifica que estos archivos NO estén en el repo:

```powershell
# Ver lo que se va a subir
git status

# Si ves alguno de estos, NO hagas push:
```

❌ **Archivos peligrosos:**
- `.env` (contiene API keys y secretos)
- `backend/.env`
- `frontend/.env.local`
- `credentials.json`
- `token.json`
- `google-credentials.json`

### 🚨 Si accidentalmente agregaste un .env:

```powershell
# Remover del staging (antes de commit)
git reset HEAD .env
git reset HEAD backend/.env

# Agregar al .gitignore si no está
echo ".env" >> .gitignore
echo "backend/.env" >> .gitignore

# Commit del .gitignore actualizado
git add .gitignore
git commit -m "Update .gitignore to exclude .env files"
```

---

## ✅ Checklist Final Antes de Push

- [ ] `.gitignore` está en la raíz
- [ ] Ningún archivo `.env` está en staging
- [ ] `node_modules/` no está en staging
- [ ] Solo código fuente y configs en staging
- [ ] README.md está incluido
- [ ] Has hecho commit

Si todo está ✅, entonces:

```powershell
git push -u origin main
```

---

## 🎉 ¡Listo!

Una vez que hagas push, tu código estará en GitHub y podrás:
1. ✅ Conectarlo con Dokploy para deploy automático
2. ✅ Colaborar con otros desarrolladores
3. ✅ Tener backups automáticos
4. ✅ Versionar todos tus cambios

---

**Ejecuta los comandos en el orden indicado.** Si tienes algún error, avísame y te ayudo a resolverlo. 🚀

