# 🎨 Frontend: Nuevo Tipo a partir de Documentos

## 📋 Resumen

Implementación del frontend para la funcionalidad de creación automática de tipos de documento usando IA.

---

## 🎯 Componentes Implementados

### **1. Servicio de Inferencia**
**Archivo:** `frontend/app/services/document-type-inference.service.ts`

```typescript
// Método principal
inferFromSamples(files: File[], uploadSamples: boolean): Promise<InferFromSamplesResponse>
```

**Funcionalidades:**
- ✅ Envío de hasta 10 archivos al backend
- ✅ Timeout de 5 minutos
- ✅ Validaciones (mínimo 2, máximo 10 archivos)
- ✅ Manejo de token JWT

---

### **2. Modal Principal**
**Archivo:** `frontend/app/document-types/components/InferFromSamplesModal.tsx`

**Estados del Modal:**

#### **Estado 1: UPLOAD** (Subir archivos)
- 📤 Zona de drag & drop
- 📋 Lista de archivos seleccionados
- ❌ Eliminar archivos individuales
- ☑️ Opción: "Subir ejemplos a Drive"

#### **Estado 2: PROCESSING** (Procesando)
- ⏳ Spinner animado
- 📊 Barra de progreso (10% → 100%)
- ✅ Lista de pasos:
  - Identificando tipos...
  - Extrayendo campos...
  - Consolidando schemas...
  - Creando tipos...

#### **Estado 3: SUCCESS** (Éxito)
- ✅ Mensaje de éxito
- 📄 Lista de tipos creados con:
  - Nombre y descripción
  - Cantidad de campos
  - Cantidad de documentos
  - Primeros 5 campos consolidados

#### **Estado 4: ERROR** (Error)
- ❌ Mensaje de error
- 🔄 Botón "Reintentar"

---

### **3. Integración en Página de Tipos**
**Archivo:** `frontend/app/document-types/page.tsx`

**Cambios:**
- ✅ Nuevo botón: "Nuevo tipo a partir de documentos"
- ✅ Importación del modal
- ✅ Estado para controlar el modal
- ✅ Callback `onSuccess` que recarga la lista

---

## 🎨 UI/UX

### **Zona de Upload**
```
┌──────────────────────────────────────┐
│         📤 Arrastra aquí             │
│    o haz clic para seleccionar       │
│                                      │
│ PDF, PNG, JPG • Max 10 • 10MB       │
│                                      │
│    [Seleccionar archivos]            │
└──────────────────────────────────────┘
```

### **Lista de Archivos**
```
Documentos seleccionados (3/10)

┌──────────────────────────────────────┐
│ 📄 orden_compra_1.pdf         [X]    │
│    2.45 MB                           │
├──────────────────────────────────────┤
│ 📄 orden_compra_2.pdf         [X]    │
│    1.89 MB                           │
├──────────────────────────────────────┤
│ 📄 factura_1.pdf              [X]    │
│    3.12 MB                           │
└──────────────────────────────────────┘
```

### **Progreso**
```
🔄 Analizando documentos...
    Esto puede tomar 2-3 minutos

[████████████████░░░░] 85%

✅ Identificando tipos de documento...
✅ Extrayendo campos...
✅ Consolidando schemas...
⏳ Creando tipos de documento...
```

### **Resultado**
```
✅ ¡Tipos creados exitosamente!
   Se crearon 2 tipo(s) de documento

┌──────────────────────────────────────┐
│ 📁 Orden de Compra                   │
│                                      │
│ Tipo creado automáticamente...      │
│                                      │
│ Campos: 18  Documentos: 7  ID: #15  │
│                                      │
│ Campos consolidados (primeros 5):    │
│ • Número de Orden (numero_orden)     │
│ • Fecha de Emisión (fecha_emision)   │
│ • Proveedor (proveedor) [Req]        │
│ • Monto Total (monto_total)          │
│ • Dirección (direccion) [Req]        │
│ ... y 13 más                         │
└──────────────────────────────────────┘
```

---

## 🔧 Validaciones

### **Frontend:**
- ✅ Mínimo 2 archivos
- ✅ Máximo 10 archivos
- ✅ Solo PDF, PNG, JPG, JPEG
- ✅ Máximo 10MB por archivo
- ✅ Toast de error si archivo no válido

### **Backend:**
- ✅ Validación de tipos MIME
- ✅ Validación de tamaños
- ✅ Timeout de 5 minutos

---

## 📦 Archivos Creados/Modificados

```
frontend/
├── app/
│   ├── services/
│   │   └── document-type-inference.service.ts  ← NUEVO ✅
│   └── document-types/
│       ├── components/
│       │   └── InferFromSamplesModal.tsx       ← NUEVO ✅
│       └── page.tsx                            (modificado ✅)
└── INFER_FROM_SAMPLES_FRONTEND.md             ← NUEVO ✅
```

---

## 🚀 Cómo Usar

### **Paso 1: Ir a "Tipos de Documento"**
```
http://localhost:3000/document-types
```

### **Paso 2: Click en botón**
```
[✨ Nuevo tipo a partir de documentos]
```

### **Paso 3: Arrastrar documentos**
- Arrastra 2-10 archivos PDF/PNG/JPG
- O haz clic en "Seleccionar archivos"

### **Paso 4: (Opcional) Subir ejemplos**
- Marca: ☑️ "Subir documentos de ejemplo a Google Drive"

### **Paso 5: Procesar**
```
[✨ Analizar y Crear Tipos]
```

### **Paso 6: Esperar**
- ⏱️ Progreso en tiempo real (2-3 minutos)

### **Paso 7: Ver Resultados**
- ✅ Lista de tipos creados
- 📊 Campos consolidados
- 📁 Carpetas en Drive

---

## 🧪 Escenarios de Prueba

### **Escenario 1: Documentos Similares**
**Input:**
- 5 órdenes de compra (algunas en inglés)

**Resultado Esperado:**
- 1 tipo: "Orden de Compra"
- ~15-20 campos consolidados
- Campos homologados (numero_orden = order_number)

---

### **Escenario 2: Documentos Mixtos**
**Input:**
- 3 órdenes de compra
- 2 facturas
- 2 órdenes de despacho

**Resultado Esperado:**
- 3 tipos creados
- Cada uno con sus campos específicos

---

### **Escenario 3: Error de Validación**
**Input:**
- Solo 1 archivo

**Resultado Esperado:**
- ❌ Toast: "Se requieren al menos 2 archivos"
- Modal permanece abierto

---

### **Escenario 4: Archivo No Válido**
**Input:**
- 2 PDFs + 1 DOCX

**Resultado Esperado:**
- ❌ Toast: "archivo.docx: Solo se permiten PDF, PNG, JPG"
- El DOCX no se agrega
- PDFs sí se agregan

---

## 🎯 Flujo Completo (Diagrama)

```
Usuario abre modal
        ↓
Arrastra 5 archivos
        ↓
Click "Analizar"
        ↓
Estado: PROCESSING
        ↓
[Llamada al backend]
        ↓
Progreso: 10% → 100%
        ↓
Backend procesa 5 docs
        ↓
Identifica 2 tipos
        ↓
Consolida campos
        ↓
Crea en BD y Drive
        ↓
Estado: SUCCESS
        ↓
Muestra 2 tipos creados
        ↓
Usuario click "Cerrar"
        ↓
Lista de tipos se recarga
        ↓
Nuevos tipos aparecen ✨
```

---

## ⚡ Performance

### **Tiempos:**
- Upload archivos: ~1 segundo
- Procesamiento: 2-3 minutos (depende de cantidad)
- Render de resultados: instantáneo

### **Optimizaciones:**
- ✅ Progress bar simula progreso mientras espera
- ✅ Timeout de 5 minutos
- ✅ Sin bloqueo de UI durante procesamiento

---

## 🐛 Manejo de Errores

### **Error 1: Token Inválido**
```javascript
Toast: "No hay token de autenticación"
```

### **Error 2: Backend Error**
```javascript
Toast: "Error al procesar documentos"
Descripción: [mensaje del servidor]
```

### **Error 3: Timeout**
```javascript
Toast: "La solicitud tardó demasiado"
Descripción: "Intenta con menos archivos"
```

---

## 📝 Notas Técnicas

### **Drag & Drop:**
- Implementado con eventos nativos
- `onDragEnter`, `onDragOver`, `onDrop`
- Feedback visual cuando arrastra

### **File Input:**
- Input oculto con `accept` filter
- Trigger programático con `getElementById().click()`

### **Progress Simulation:**
- Aumenta de 10% a 90% automáticamente
- Salta a 100% cuando backend responde
- Usa `setInterval` para suavizar

### **State Management:**
- Estados: 'upload' | 'processing' | 'success' | 'error'
- Reset completo al cerrar modal

---

## ✅ Checklist de Implementación

**Backend:**
- [x] Servicio de inferencia
- [x] Endpoint REST
- [x] Validaciones
- [x] DTOs

**Frontend:**
- [x] Servicio API
- [x] Modal completo
- [x] Zona de upload
- [x] Vista de progreso
- [x] Vista de resultados
- [x] Botón en página
- [x] Integración

**Testing:**
- [ ] Probar con documentos reales
- [ ] Validar errores
- [ ] Verificar flujo completo

---

**Última actualización:** 2 de noviembre, 2025

