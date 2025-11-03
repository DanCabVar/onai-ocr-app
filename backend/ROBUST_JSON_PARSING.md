# 🛠️ Parser JSON Robusto para Gemini

## 🐛 Problema Resuelto

### Error Original:
```
SyntaxError: Expected ',' or '}' after property value in JSON at position 3128 (line 89 column 33)
```

**Causa:** Gemini a veces devuelve JSON con errores de sintaxis cuando las respuestas son muy largas (especialmente en re-extracciones con muchos campos).

---

## ✅ Solución Implementada

### **1. Parser JSON Robusto (`parseGeminiJSON`)**

Nuevo método privado que intenta parsear JSON de Gemini con tolerancia a errores comunes:

```typescript
private parseGeminiJSON(response: string): any {
  try {
    // Primera tentativa: Limpieza básica
    let jsonString = extractJSON(response);
    
    // Limpiar:
    // 1. Eliminar comas antes de } o ]
    jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
    
    // 2. Eliminar saltos de línea dentro de strings
    jsonString = jsonString.replace(/("\w+":\s*"[^"]*)\n([^"]*")/g, '$1 $2');
    
    return JSON.parse(jsonString);
    
  } catch (error) {
    // Segunda tentativa: Limpieza agresiva
    // - Eliminar comentarios
    // - Limpiar caracteres problemáticos
    
    return JSON.parse(cleanedJSON);
  }
}
```

### **2. Aplicado en Todos los Métodos**

Se reemplazó `JSON.parse(jsonMatch[0])` por `this.parseGeminiJSON(response)` en:

- ✅ `classifyDocument()` - Clasificación de documentos
- ✅ `extractData()` - Extracción basada en OCR
- ✅ `extractDataWithVision()` - Extracción con visión (re-extracción)
- ✅ `inferFieldsForUnclassified()` - Inferencia de campos (texto)
- ✅ `inferFieldsForUnclassifiedWithVision()` - Inferencia de campos (visión)

---

## 🔍 Cómo Funciona

```
┌───────────────────────────────────────────────────────────┐
│ Gemini devuelve respuesta                                 │
│   "{ fields: [...], summary: 'texto' }"                   │
└───────────────────────────────────────────────────────────┘
                          ↓
┌───────────────────────────────────────────────────────────┐
│ INTENTO 1: Limpieza básica                                │
│   - Extraer JSON: {...}                                   │
│   - Eliminar comas finales antes de } o ]                 │
│   - Limpiar saltos de línea en strings                    │
│   - JSON.parse()                                          │
└───────────────────────────────────────────────────────────┘
            ↓ ✅ ÉXITO                    ❌ ERROR
┌────────────────────┐        ┌──────────────────────────────┐
│ Devolver objeto    │        │ INTENTO 2: Limpieza agresiva │
│ parseado           │        │   - Eliminar comentarios     │
│                    │        │   - Limpiar caracteres       │
└────────────────────┘        │   - JSON.parse()             │
                              └──────────────────────────────┘
                                      ↓ ✅         ↓ ❌
                              ┌────────────┐   ┌───────────┐
                              │ Devolver   │   │ Lanzar    │
                              │ objeto     │   │ error con │
                              └────────────┘   │ detalles  │
                                               └───────────┘
```

---

## 📊 Casos de Error Manejados

| Error Común | Solución |
|-------------|----------|
| `,}` o `,]` | Elimina coma extra antes de cerrar |
| Saltos de línea en strings | Reemplaza por espacio |
| Comentarios `//` o `/* */` | Los elimina |
| JSON incompleto | Detecta y reporta posición |
| JSON con texto adicional | Extrae solo el objeto `{...}` |

---

## 🧪 Ejemplo de Corrección

### Antes (Error):
```json
{
  "fields": [
    {
      "name": "vendedor_nombre",
      "value": "Comercial L&B",  // ← Coma extra
    },  // ← Problema aquí
  ],
  "summary": "Orden de compra
  con salto de línea"  // ← Problema aquí
}
```

### Después (Corregido):
```json
{
  "fields": [
    {
      "name": "vendedor_nombre",
      "value": "Comercial L&B"
    }
  ],
  "summary": "Orden de compra con salto de línea"
}
```

---

## 🚀 Cómo Usar

**No requiere cambios en el código.** El parser robusto se aplica automáticamente en todos los métodos que llaman a Gemini.

---

## 📝 Logs Mejorados

Ahora verás logs como:

```bash
# Si la primera tentativa falla:
⚠️  Primera tentativa de parseo falló: Unexpected token...
    Intentando limpieza agresiva...

# Si la segunda tentativa también falla:
❌ Parseo de JSON falló después de limpieza: ...
📋 Respuesta original (primeros 500 chars): {"fields":[...
```

Esto te permite **debuggear** qué está devolviendo Gemini cuando falla.

---

## 🎯 Beneficios

| Beneficio | Descripción |
|-----------|-------------|
| ✅ **Más robusto** | Tolera errores comunes de JSON |
| ✅ **Reintentos automáticos** | 2 niveles de limpieza |
| ✅ **Mejor debugging** | Logs detallados con respuesta original |
| ✅ **Sin cambios en API** | Transparente para el resto del código |
| ✅ **Reduce timeouts** | Menos fallos = menos reintentos HTTP |

---

## 🔧 Testing

### Test 1: Caso Normal
```bash
# Subir 10 documentos
# Esperar que se procesen sin errores de parseo
```

### Test 2: Caso Complejo
```bash
# Subir documentos con muchos campos (20+)
# Gemini devolverá JSONs largos
# Verificar que el parser robusto los maneja
```

### Test 3: Revisar Logs
```bash
# Si hay un warning de "Primera tentativa de parseo falló"
# Es normal, significa que la limpieza agresiva funcionó
# Solo es error si ambos intentos fallan
```

---

## 📦 Archivos Modificados

- ✅ `backend/src/ai-services/gemini-classifier.service.ts`
  - Añadido método `parseGeminiJSON()` (50 líneas)
  - Reemplazados 5 usos de `JSON.parse()` directo

---

## 🔄 Próximos Pasos

Si el error persiste después de este fix:

### Opción 1: Limitar longitud de respuesta
```typescript
// Reducir número máximo de campos
const maxFields = 15; // en lugar de 20
```

### Opción 2: Pedir a Gemini ser más estricto
```typescript
// Agregar al prompt:
**IMPORTANTE: Genera JSON VÁLIDO estrictamente. NO incluyas:
- Comentarios (// o /* */)
- Comas finales antes de } o ]
- Saltos de línea dentro de strings
- Texto adicional fuera del JSON
```

### Opción 3: Usar modelo más preciso
```env
# .env
GEMINI_MODEL=gemini-1.5-pro  # Más preciso pero más lento/caro
```

---

## ✅ Estado

- ✅ **Implementado** - Parser robusto funcionando
- ✅ **Compilado** - Sin errores de TypeScript
- ⏳ **Testing** - Esperando prueba del usuario

---

**Reinicia el backend y vuelve a probar con tus 10 documentos.** El error de parseo JSON debería estar resuelto. 🚀

