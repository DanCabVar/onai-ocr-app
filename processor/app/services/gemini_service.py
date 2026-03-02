"""Gemini AI service for document classification, field extraction, and schema consolidation.

All LLM calls go through the rate limiter and have retry logic for 429 errors.
"""

from __future__ import annotations

import base64
import json
import logging
import re
from pathlib import Path

from google import generativeai as genai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import settings
from app.models.schemas import (
    ConsolidatedField,
    ConsolidatedSchema,
    DocumentClassification,
    FieldWithValue,
)
from app.utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

# Shared rate limiter for all Gemini calls
_rate_limiter = RateLimiter(
    rpm_limit=settings.gemini_rpm_limit,
    min_delay=settings.gemini_delay_between_calls,
)


class GeminiRateLimitError(Exception):
    """Raised when Gemini returns 429."""


def _parse_json(text: str) -> dict:
    """Robustly extract JSON from a Gemini response."""
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise ValueError("No JSON found in response")
    raw = match.group(0)
    # Fix trailing commas
    raw = re.sub(r",(\s*[}\]])", r"\1", raw)
    # Remove comments
    raw = re.sub(r"//.*$", "", raw, flags=re.MULTILINE)
    return json.loads(raw)


def _get_model():
    genai.configure(api_key=settings.google_ai_api_key)
    return genai.GenerativeModel(settings.gemini_model)


def _make_retry():
    """Standard retry decorator for Gemini calls."""
    return retry(
        retry=retry_if_exception_type((GeminiRateLimitError, Exception)),
        stop=stop_after_attempt(settings.max_retries),
        wait=wait_exponential(multiplier=settings.retry_base_delay, min=10, max=120),
        before_sleep=lambda retry_state: logger.warning(
            f"Retrying Gemini call (attempt {retry_state.attempt_number})..."
        ),
    )


# ---------------------------------------------------------------------------
# 1. Classify + Extract fields (Vision) — single document
# ---------------------------------------------------------------------------
async def classify_and_extract_fields(
    file_path: str, mime_type: str
) -> DocumentClassification:
    """Classify a document and extract its fields in a SINGLE LLM call.

    This is the key optimisation: the original code made TWO separate calls
    (classify, then extract fields) using the same prompt.  We combine them.
    """
    await _rate_limiter.acquire()

    model = _get_model()
    file_bytes = Path(file_path).read_bytes()
    b64 = base64.b64encode(file_bytes).decode()

    prompt = """Eres un experto analista de documentos. Analiza esta imagen/PDF y determina:
1. QUE TIPO de documento es (ej: "Certificado Medico", "Factura", "Contrato", etc.)
2. Un RESUMEN breve del documento EN ESPANOL (1-2 lineas)
3. Los CAMPOS CLAVE mas importantes que se encuentran en el documento

**INSTRUCCIONES:**
1. Identifica el tipo de documento basandote en su contenido y estructura visual
2. Extrae entre 3 y 20 campos clave (los mas importantes del documento)
3. Para cada campo:
   - name: snake_case en espanol
   - type: string | number | date | boolean | array
   - label: Etiqueta legible en espanol
   - required: true si es fundamental
   - description: Breve descripcion (max 100 chars)
   - value: Valor real extraido del documento

**IMPORTANTE - Observa visualmente:**
- Analiza el LAYOUT completo (columnas, tablas, secciones)
- Busca valores en posiciones cercanas a las etiquetas
- Para montos: extrae el numero sin simbolos

**FORMATO DE RESPUESTA (JSON):**
{
  "inferred_type": "Nombre del tipo de documento",
  "summary": "Resumen breve EN ESPANOL",
  "confidence": 0.95,
  "key_fields": [
    {
      "name": "nombre_campo",
      "type": "string",
      "label": "Etiqueta",
      "required": true,
      "description": "Descripcion",
      "value": "valor extraido"
    }
  ]
}

Responde SOLO con el JSON."""

    try:
        response = model.generate_content(
            [{"inline_data": {"data": b64, "mime_type": mime_type}}, prompt]
        )
        data = _parse_json(response.text)

        fields = [
            FieldWithValue(
                name=f.get("name", "unknown"),
                type=f.get("type", "string"),
                label=f.get("label", ""),
                required=f.get("required", False),
                description=f.get("description", ""),
                value=f.get("value"),
            )
            for f in data.get("key_fields", [])
        ]

        return DocumentClassification(
            filename=Path(file_path).name,
            inferred_type=data.get("inferred_type", "Documento Desconocido"),
            summary=data.get("summary", ""),
            fields=fields,
            confidence=data.get("confidence", 0.0),
        )
    except Exception as e:
        if "429" in str(e) or "quota" in str(e).lower():
            raise GeminiRateLimitError(str(e)) from e
        raise


# ---------------------------------------------------------------------------
# 2. Homologate type names
# ---------------------------------------------------------------------------
async def homologate_type_names(
    new_type_names: list[str],
) -> dict[str, str]:
    """Given a list of inferred type names, merge semantically equivalent ones.

    Returns a mapping: original_name -> canonical_name.
    """
    if len(new_type_names) <= 1:
        return {n: n for n in new_type_names}

    await _rate_limiter.acquire()
    model = _get_model()

    types_list = "\n".join(f'{i+1}. "{n}"' for i, n in enumerate(new_type_names))
    prompt = f"""Eres un experto en clasificacion de documentos.

Tengo estos tipos de documentos NUEVOS identificados:
{types_list}

**TAREA:** Agrupa los tipos SEMANTICAMENTE EQUIVALENTES (mismo tipo, nombres diferentes).

**INSTRUCCIONES:**
1. Identifica grupos de tipos REALMENTE equivalentes
2. Para cada grupo, elige el nombre MAS CLARO Y ESPECIFICO en espanol
3. SE CONSERVADOR: solo agrupa si estas seguro
4. Si un tipo no tiene equivalentes, creale su propio grupo

**FORMATO (JSON):**
{{
  "merges": [
    {{
      "canonical_name": "Nombre definitivo",
      "variants": ["nombre1", "nombre2"]
    }}
  ]
}}

Si NO hay equivalentes: {{"merges": []}}

Responde SOLO con el JSON."""

    try:
        result = model.generate_content(prompt)
        data = _parse_json(result.text)

        mapping: dict[str, str] = {n: n for n in new_type_names}

        for merge in data.get("merges", []):
            canonical = merge.get("canonical_name", "")
            for variant in merge.get("variants", []):
                if variant in mapping:
                    mapping[variant] = canonical

        return mapping
    except Exception:
        logger.warning("Homologation failed, using original names")
        return {n: n for n in new_type_names}


# ---------------------------------------------------------------------------
# 3. Consolidate fields across multiple documents of the same type
# ---------------------------------------------------------------------------
async def consolidate_fields(
    type_name: str,
    doc_classifications: list[DocumentClassification],
) -> ConsolidatedSchema:
    """Merge field lists from multiple documents into a unified schema."""
    await _rate_limiter.acquire()
    model = _get_model()

    docs_desc = ""
    for i, doc in enumerate(doc_classifications):
        fields_str = "\n".join(
            f'  - {f.name} ({f.type}): "{f.label}"'
            + (" [REQUERIDO]" if f.required else "")
            for f in doc.fields
        )
        docs_desc += f"\nDOCUMENTO {i+1} ({doc.filename}):\n{fields_str}\n"

    prompt = f"""Eres un experto en diseno de schemas de datos.

Tengo {len(doc_classifications)} documentos tipo "{type_name}" con estos campos:
{docs_desc}

**TAREA:** Consolida en UN SOLO SCHEMA definitivo para "{type_name}".

**INSTRUCCIONES:**
1. Identificar campos equivalentes (mismo concepto, nombres diferentes)
2. Elegir mejor nombre (snake_case, espanol, descriptivo)
3. Tipo: string | number | date | boolean | array
4. required: true si aparece en >=50% de documentos
5. Maximo 20 campos, ordenados por importancia

**FORMATO (JSON):**
{{
  "typeDescription": "Descripcion breve del tipo",
  "consolidatedFields": [
    {{
      "name": "nombre_campo",
      "type": "string",
      "label": "Etiqueta",
      "required": true,
      "description": "Descripcion",
      "frequency": 0.85
    }}
  ]
}}

Responde SOLO con el JSON."""

    try:
        result = model.generate_content(prompt)
        data = _parse_json(result.text)

        fields = [
            ConsolidatedField(
                name=f["name"],
                type=_normalize_field_type(f.get("type", "string")),
                label=f.get("label", f["name"]),
                required=f.get("required", False),
                description=f.get("description", ""),
                frequency=f.get("frequency", 1.0),
            )
            for f in data.get("consolidatedFields", [])
        ]

        return ConsolidatedSchema(
            type_name=type_name,
            description=data.get("typeDescription", f'Tipo "{type_name}"'),
            fields=fields,
        )
    except Exception as e:
        if "429" in str(e) or "quota" in str(e).lower():
            raise GeminiRateLimitError(str(e)) from e
        raise


# ---------------------------------------------------------------------------
# 4. Re-extract data using a unified schema (Vision)
# ---------------------------------------------------------------------------
async def extract_with_schema(
    file_path: str,
    mime_type: str,
    type_name: str,
    schema_fields: list[ConsolidatedField],
) -> dict:
    """Extract structured data from a document using a predefined schema."""
    await _rate_limiter.acquire()
    model = _get_model()

    file_bytes = Path(file_path).read_bytes()
    b64 = base64.b64encode(file_bytes).decode()

    fields_desc = "\n".join(
        f"- {f.label} ({f.name}): tipo {f.type}, "
        f"{'obligatorio' if f.required else 'opcional'}"
        f"{' - ' + f.description if f.description else ''}"
        for f in schema_fields
    )

    fields_template = ",\n    ".join(
        f'{{"name": "{f.name}", "type": "{f.type}", "label": "{f.label}", '
        f'"required": {str(f.required).lower()}, '
        f'"description": "{f.description}", "value": null}}'
        for f in schema_fields
    )

    prompt = f"""Eres un experto en extraccion de datos de documentos.
Analiza esta imagen/PDF y extrae:
1. Un RESUMEN breve EN ESPANOL (1-2 lineas)
2. Los valores de los campos solicitados

**TIPO DE DOCUMENTO:** {type_name}

**CAMPOS A EXTRAER:**
{fields_desc}

**INSTRUCCIONES:**
- Extrae SOLO los campos solicitados
- Si un campo no se encuentra, usa null
- Fechas en formato ISO 8601 (YYYY-MM-DD)
- Numeros sin simbolos de moneda
- Observa el LAYOUT visual completo

**FORMATO (JSON):**
{{
  "summary": "Resumen EN ESPANOL",
  "fields": [
    {fields_template}
  ]
}}

Responde SOLO con el JSON."""

    try:
        response = model.generate_content(
            [{"inline_data": {"data": b64, "mime_type": mime_type}}, prompt]
        )
        return _parse_json(response.text)
    except Exception as e:
        if "429" in str(e) or "quota" in str(e).lower():
            raise GeminiRateLimitError(str(e)) from e
        raise


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _normalize_field_type(t: str) -> str:
    t = t.lower().strip()
    if t in ("number", "integer", "float", "currency"):
        return "number"
    if t in ("date", "datetime", "timestamp"):
        return "date"
    if t in ("boolean", "bool"):
        return "boolean"
    if t in ("array", "list"):
        return "array"
    return "string"
