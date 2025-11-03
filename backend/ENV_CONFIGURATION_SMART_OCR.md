# ⚙️ Configuración del archivo .env para Smart OCR

## 🚀 Variables a agregar

Agrega estas líneas a tu archivo `backend/.env`:

```env
# ============================================
# SMART OCR CONFIGURATION
# ============================================

# Mistral AI - OCR Inteligente
MISTRAL_API_KEY=szBkLaxMAcHNwuUeDHAdVJt4MEHsEnfQ
MISTRAL_OCR_MODEL=mistral-ocr-latest          # OCR estándar (rápido, económico)
MISTRAL_VISION_MODEL=pixtral-12b-latest        # Vision multimodal (fallback)
```

---

## 📝 Instrucciones

1. Abre el archivo `backend/.env`
2. Busca la sección de Mistral (o agrégala después de la sección de Google AI)
3. Agrega las 3 líneas de configuración
4. **Ya tienes tu API key**: `szBkLaxMAcHNwuUeDHAdVJt4MEHsEnfQ`
5. Guarda el archivo
6. Reinicia el backend

---

## 🔄 Reiniciar el Backend

```bash
# Si el backend está corriendo, detenlo con Ctrl+C
# Luego inicia de nuevo:
cd backend
pnpm run start:dev
```

---

## ✅ Verificar que funciona

Cuando subas el documento de nuevo, deberías ver en los logs:

```
🔍 Intentando OCR estándar...
📊 Calidad OCR: 5/30 líneas con valores (16.7%)
⚠️  OCR estándar insuficiente. Usando Vision (Pixtral)...
Iniciando extracción con Vision (Pixtral)...
✅ Vision OCR completado: 850 caracteres
```

Y en el frontend, los campos ahora deberían tener valores.

---

## 💰 Costos

- **OCR estándar** (`mistral-ocr-latest`): ~$0.001 por página
- **Pixtral Vision** (`pixtral-12b-latest`): ~$0.005 por página

El sistema usa OCR estándar primero (más barato). Solo usa Pixtral si es necesario.

**Estimado**: 80% de documentos usarán solo OCR estándar.

---

## ❓ FAQ

### ¿Cuándo se usa Pixtral Vision?

Automáticamente cuando el OCR estándar captura menos del 20% de valores (números, emails, montos, fechas).

### ¿Puedo desactivar Pixtral?

Sí, comenta o elimina la línea `MISTRAL_VISION_MODEL` del `.env`. El sistema usará solo OCR estándar.

### ¿Funciona con mis documentos actuales?

Sí, no necesitas subir nada de nuevo. El sistema se adapta automáticamente.

### ¿Necesito una cuenta especial de Mistral?

No, tu API key actual funciona con ambos modelos.


