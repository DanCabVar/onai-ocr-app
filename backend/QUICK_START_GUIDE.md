# 🚀 Guía Rápida - Sistema de Homologación Avanzado

## ✅ ¿Qué se implementó?

Se mejoró el sistema de "Nuevo tipo a partir de documentos" con:

1. ✅ **Homologación de nombres de tipos** - Fusiona automáticamente tipos similares
   - Ejemplo: "Orden de Retiro" + "Orden de Despacho / Retiro" → "Orden de Retiro"

2. ✅ **Homologación de campos** - Agrupa campos equivalentes
   - Ejemplo: `seller_name` + `issuing_company_name` + `supplier_name` → `vendedor_nombre_empresa`

3. ✅ **Re-extracción con schema unificado** - Garantiza campos idénticos
   - Todos los documentos del mismo tipo tendrán EXACTAMENTE los mismos campos

---

## 🎯 Resultado Final

### ANTES (Problema):
```
8 documentos "Orden de Compra":
  ❌ Doc 1: [seller_name, seller_rut, order_date, ...]
  ❌ Doc 2: [issuing_company_name, vendor_name, ...]
  ❌ Doc 3: [supplier_name, order_number, ...]
  ❌ Cada documento tiene campos DIFERENTES
```

### AHORA (Solución):
```
8 documentos "Orden de Compra":
  ✅ Doc 1: [vendedor_nombre_empresa, vendedor_rut, fecha_orden, ...]
  ✅ Doc 2: [vendedor_nombre_empresa, vendedor_rut, fecha_orden, ...]
  ✅ Doc 3: [vendedor_nombre_empresa, vendedor_rut, fecha_orden, ...]
  ✅ TODOS los documentos tienen los MISMOS campos
```

---

## 🧪 Cómo Probar

### Paso 1: Preparar Entorno
```powershell
# Asegúrate de estar en la carpeta backend
cd backend

# Reiniciar el backend para aplicar cambios
pnpm run start:dev
```

### Paso 2: Refrescar Frontend
```
1. Abre el navegador
2. Presiona F5 o Ctrl+R para recargar (actualizar timeout a 10 minutos)
```

### Paso 3: Subir Documentos
```
1. Ve a "Tipos de Documento"
2. Click en "Nuevo tipo a partir de documentos"
3. Sube 10 documentos:
   - 8 Orden de Compra (diferentes proveedores)
   - 1 Orden de Despacho / Retiro
   - 1 Orden de Retiro
4. Marca checkbox "Guardar documentos en Drive y Base de Datos"
5. Click "Procesar"
6. Espera 8-10 minutos (el mensaje mostrará el tiempo estimado)
```

### Paso 4: Verificar Resultados
```
Resultado esperado:

✅ 2 tipos creados (no 3):
   1. "Orden de Compra" (8 documentos)
   2. "Orden de Retiro" (2 documentos fusionados)

✅ Cada tipo tiene un schema consolidado:
   - Orden de Compra: ~20 campos únicos
   - Orden de Retiro: ~15 campos únicos

✅ Todos los documentos del mismo tipo tienen EXACTAMENTE los mismos campos
```

---

## 📋 Logs a Observar

En la terminal del backend, verás logs como:

```
🚀 Iniciando inferencia de tipos desde 10 documentos de ejemplo
🔍 Clasificando 10 documentos...
   ✅ OC_Ausin.pdf: "Orden de Compra"
   ✅ OC_Caceres.pdf: "Orden de Compra"
   ...
   ✅ Retiro_001.pdf: "Orden de Despacho / Retiro"
   ✅ Retiro_002.pdf: "Orden de Retiro"

🔀 Homologando 2 nombres de tipos nuevos...    ← NUEVO
   🔗 Gemini detectó 1 fusión(es)              ← NUEVO
   🔀 Fusionando: Orden de Despacho / Retiro, Orden de Retiro → "Orden de Retiro"

📦 Procesando grupo "Orden de Compra" (8 documentos)...
   📊 Extrayendo campos de 8 documentos...
      ✅ Extraídos 22 campos de "OC_Ausin.pdf"
      ✅ Extraídos 18 campos de "OC_Caceres.pdf"
      ...

   🔧 Consolidando campos de 8 documentos...    ← NUEVO
   ✅ Schema consolidado: 20 campos únicos      ← NUEVO

   🔄 Re-extrayendo datos con schema consolidado...  ← NUEVO
      📄 Re-extrayendo: OC_Ausin.pdf
      ✅ Re-extracción completada para OC_Ausin.pdf
      ...
   ✅ Re-extracción completada: 8 documentos procesados

   📂 Creando carpeta en Google Drive...
   💾 Guardando tipo en base de datos...
   ✅ Tipo "Orden de Compra" creado (ID: 1)

   📤 Subiendo 8 documentos con datos unificados...
      ✅ "OC_Ausin.pdf" guardado (ID: 1)
      ...

🎉 Proceso completado: 2 tipo(s) procesado(s)
```

---

## 🔍 Verificación en Base de Datos

### Consulta 1: Ver documentos de "Orden de Compra"
```sql
SELECT 
  id,
  filename,
  jsonb_array_length(extracted_data->'fields') as num_fields,
  (extracted_data->'fields'->0->>'name') as first_field_name,
  (extracted_data->'fields'->1->>'name') as second_field_name
FROM documents
WHERE document_type_id = 1  -- ID del tipo "Orden de Compra"
ORDER BY id;
```

**Resultado esperado:** Todos tienen el mismo `num_fields` y los mismos nombres de campos

### Consulta 2: Ver campos únicos por tipo
```sql
SELECT DISTINCT
  jsonb_array_elements(extracted_data->'fields')->>'name' as field_name
FROM documents
WHERE document_type_id = 1
ORDER BY field_name;
```

**Resultado esperado:** Lista de ~20 campos consistentes (ej: `vendedor_nombre_empresa`, `vendedor_rut`, `fecha_orden`, etc.)

---

## ⚠️ Troubleshooting

### Problema 1: Timeout después de 5 minutos
**Causa:** Frontend no actualizó el timeout  
**Solución:** Presiona `F5` para recargar la página del frontend

### Problema 2: No se fusionan tipos similares
**Causa:** Gemini no detectó la similitud  
**Solución:** Revisar logs, puede ser que los nombres sean realmente diferentes

### Problema 3: Campos siguen siendo diferentes
**Causa:** Re-extracción falló  
**Solución:** Revisar logs del backend, verificar que dice "Re-extracción completada"

### Problema 4: Error de compilación
**Causa:** Posible conflicto de tipos TypeScript  
**Solución:**
```powershell
cd backend
pnpm run build
```
Si hay errores, revisar `document-type-inference.service.ts`

---

## 📞 Soporte

Si encuentras problemas:

1. **Revisar logs del backend** - Busca mensajes de error
2. **Verificar la base de datos** - Ejecuta las consultas SQL de arriba
3. **Revisar Google Drive** - Confirma que los archivos se subieron
4. **Leer documentación completa** - `ADVANCED_FIELD_HOMOLOGATION.md`

---

## 📚 Documentación Completa

- **Sistema completo:** `ADVANCED_FIELD_HOMOLOGATION.md`
- **Resumen de implementación:** `IMPLEMENTATION_SUMMARY.md`
- **Esta guía:** `QUICK_START_GUIDE.md`

---

**¡Listo para probar!** 🚀

Reinicia el backend (`pnpm run start:dev`) y sube tus documentos.

