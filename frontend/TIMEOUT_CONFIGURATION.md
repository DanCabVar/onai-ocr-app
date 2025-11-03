# ⏱️ Configuración de Timeout - Frontend

## 📊 Configuración Actual

### Servicio: `document-type-inference.service.ts`

```typescript
timeout: 900000  // 15 minutos (900,000 ms)
```

**Razón:** El proceso de "Nuevo tipo a partir de documentos" con 10 archivos puede tardar:
- **Clasificación:** ~2 min (10 archivos en paralelo)
- **Homologación de tipos:** ~30 seg (1 llamada Gemini)
- **Extracción inicial:** ~3 min (10 archivos)
- **Consolidación de campos:** ~1 min (2 tipos)
- **Re-extracción:** ~4 min (10 archivos con schema fijo)
- **Subida a Drive + BD:** ~1 min (I/O)

**Total estimado:** ~12 minutos para 10 documentos  
**Margen de seguridad:** 15 minutos timeout

---

## 🕐 Tiempos Estimados por Cantidad de Archivos

| Archivos | Tiempo Real Estimado | Mensaje al Usuario | Timeout |
|----------|----------------------|--------------------|---------|
| 1-2 | 2-4 minutos | "2-4 minutos" | 15 min |
| 3-4 | 4-6 minutos | "4-6 minutos" | 15 min |
| 5-6 | 6-8 minutos | "6-8 minutos" | 15 min |
| 7-8 | 8-10 minutos | "8-10 minutos" | 15 min |
| 9-10 | 10-12 minutos | "10-12 minutos" | 15 min |

---

## 🔧 Cómo Cambiar el Timeout

Si en el futuro necesitas ajustar el timeout:

### **Archivo:** `frontend/app/services/document-type-inference.service.ts`

```typescript
// Línea 73
timeout: 900000, // 15 minutos

// Para aumentar a 20 minutos:
timeout: 1200000, // 20 minutos

// Para aumentar a 30 minutos:
timeout: 1800000, // 30 minutos
```

**Nota:** No olvides también actualizar los mensajes de tiempo estimado en `InferFromSamplesModal.tsx`.

---

## ⚠️ Limitaciones

### Axios Timeout
- **Máximo recomendado:** 30 minutos (1,800,000 ms)
- **Razón:** Timeouts muy largos pueden causar problemas de memoria en el navegador

### Vercel (si despliegas ahí)
- **Timeout máximo:** 10 segundos (plan gratuito)
- **Timeout máximo:** 60 segundos (plan Pro)
- **Timeout máximo:** 300 segundos / 5 minutos (plan Enterprise)

Si despliegas en Vercel, este proceso NO funcionará porque excede los límites. Deberás:
1. Usar un VPS (como planeas con Dokploy)
2. O dividir el proceso en chunks más pequeños con polling

---

## 🚀 Configuración para Producción

### Recomendaciones:

1. **VPS/Servidor Propio:**
   ```typescript
   timeout: 900000 // 15 minutos OK ✅
   ```

2. **Vercel/Serverless:**
   ```typescript
   // NO FUNCIONARÁ ❌
   // Debes implementar:
   // - Procesamiento en background (queue)
   // - Endpoint de polling para verificar estado
   // - WebSockets para notificaciones en tiempo real
   ```

3. **Plataforma Gestionada (Railway, Render, Fly.io):**
   ```typescript
   timeout: 900000 // 15 minutos OK ✅
   // Verificar límites específicos de la plataforma
   ```

---

## 🐛 Troubleshooting

### Error: "timeout of 900000ms exceeded"

**Causas posibles:**
1. Backend está procesando más de 15 minutos
2. Backend se crasheó y no respondió
3. Conexión de red inestable

**Soluciones:**
```typescript
// 1. Aumentar timeout
timeout: 1200000 // 20 minutos

// 2. Reducir cantidad de documentos procesados
if (files.length > 10) {
  throw new Error('Máximo 10 archivos');
}

// 3. Implementar chunking (procesar de 5 en 5)
const chunkSize = 5;
for (let i = 0; i < files.length; i += chunkSize) {
  const chunk = files.slice(i, i + chunkSize);
  await processChunk(chunk);
}
```

---

## 📊 Comparativa de Timeouts

| Servicio | Timeout Actual | Proceso |
|----------|----------------|---------|
| **inferFromSamples** | 15 min | Procesamiento completo de 10 docs |
| **uploadDocument** | Default (30 seg) | Subir 1 documento |
| **createDocumentType** | Default (30 seg) | Crear tipo manual |
| **getDocuments** | Default (30 seg) | Listar documentos |

**Nota:** Solo `inferFromSamples` necesita timeout largo porque es el único proceso intensivo con IA.

---

## ✅ Estado Actual

- ✅ **Timeout:** 15 minutos
- ✅ **Mensaje dinámico:** Ajustado a "10-12 minutos" para 10 archivos
- ✅ **Sin errores de linting**
- ⏳ **Pendiente:** Probar con datos reales

---

## 🔄 Historial de Cambios

| Fecha | Timeout | Razón |
|-------|---------|-------|
| Nov 3, 2025 | 5 min | Configuración inicial |
| Nov 3, 2025 | 10 min | Ajuste para 10 documentos |
| Nov 3, 2025 | **15 min** | **Margen de seguridad extra** |

---

**Reinicia el frontend (`F5`) para aplicar los cambios.** 🚀

El timeout ahora es de **15 minutos**, suficiente incluso si el proceso se demora más de lo esperado.

