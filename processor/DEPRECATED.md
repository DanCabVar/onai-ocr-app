# ⚠️ DEPRECATED — Python/LangGraph Processor

This microservice has been deprecated and consolidated into the NestJS backend.

## Why
- Used Google Drive for storage (inconsistent with the R2 migration)
- Added deployment complexity (separate Python service + Docker container)
- Duplicated logic already present in NestJS DocumentTypeInferenceService

## What was ported to NestJS
- **Unified classify+extract** → `GeminiClassifierService.classifyAndExtract()` — single LLM call
- **Rate limiting** → `AIRateLimiterService` (already existed in NestJS)
- **Batch validation** → exists in `DocumentTypesController.inferFromSamples()`
- **Field consolidation** → `DocumentTypeInferenceService.consolidateFieldsByType()`
- **Type name homologation** → `DocumentTypeInferenceService.homologateTypeNames()`

## Files kept for reference
All Python source files are preserved. Do not import or deploy this service.
The `ProcessorProxyService` has been removed from the NestJS backend.

## Removed from
- `docker-compose.yml` (processor service block)
- `DocumentTypesModule` (ProcessorProxyService provider)
- `DocumentTypesController` (processor fallback logic)
