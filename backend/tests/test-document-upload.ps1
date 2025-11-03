# ========================================
# Test de Subida y Procesamiento de Documentos
# ========================================
# Este script prueba el pipeline completo:
# - OCR con Mistral
# - Clasificación con Gemini
# - Extracción de datos
# - Subida a Google Drive
# - Guardado en PostgreSQL

$BaseUrl = "http://localhost:4000/api"
$TestFile = "C:\ruta\a\tu\documento-prueba.pdf"  # CAMBIAR ESTA RUTA

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST: SUBIDA Y PROCESAMIENTO DE DOCUMENTOS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ========================================
# PASO 1: Login
# ========================================
Write-Host "[1/5] Autenticando usuario..." -ForegroundColor Yellow

$loginBody = @{
    email = "test@example.com"
    password = "Test123456"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.access_token
    Write-Host "Login exitoso. Token obtenido." -ForegroundColor Green
} catch {
    Write-Host "Error en login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ========================================
# PASO 2: Verificar tipos de documento disponibles
# ========================================
Write-Host "`n[2/5] Obteniendo tipos de documento..." -ForegroundColor Yellow

$headers = @{
    Authorization = "Bearer $token"
}

try {
    $documentTypes = Invoke-RestMethod -Uri "$BaseUrl/document-types" -Method Get -Headers $headers
    Write-Host "Tipos de documento disponibles: $($documentTypes.Length)" -ForegroundColor Green
    
    if ($documentTypes.Length -gt 0) {
        Write-Host "`nTipos:" -ForegroundColor Cyan
        foreach ($type in $documentTypes) {
            Write-Host "  - ID: $($type.id) | Nombre: $($type.name)" -ForegroundColor White
        }
    } else {
        Write-Host "ADVERTENCIA: No hay tipos de documento. El documento se guardará en 'Otros'" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error obteniendo tipos: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ========================================
# PASO 3: Verificar estado de Google Drive
# ========================================
Write-Host "`n[3/5] Verificando conexión con Google Drive..." -ForegroundColor Yellow

try {
    $driveStatus = Invoke-RestMethod -Uri "$BaseUrl/google/status" -Method Get -Headers $headers
    if ($driveStatus.authenticated) {
        Write-Host "Google Drive conectado correctamente" -ForegroundColor Green
    } else {
        Write-Host "ADVERTENCIA: Google Drive no está autenticado" -ForegroundColor Yellow
        Write-Host "Visita: http://localhost:4000/api/google/auth" -ForegroundColor Yellow
        $continue = Read-Host "¿Continuar de todos modos? (y/n)"
        if ($continue -ne "y") {
            exit 1
        }
    }
} catch {
    Write-Host "Error verificando Google Drive: $($_.Exception.Message)" -ForegroundColor Red
}

# ========================================
# PASO 4: Subir y procesar documento
# ========================================
Write-Host "`n[4/5] Subiendo y procesando documento..." -ForegroundColor Yellow
Write-Host "Archivo: $TestFile" -ForegroundColor White

# Verificar que el archivo exista
if (-not (Test-Path $TestFile)) {
    Write-Host "ERROR: El archivo no existe: $TestFile" -ForegroundColor Red
    Write-Host "Por favor, actualiza la variable `$TestFile con una ruta válida" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nEtapas del procesamiento:" -ForegroundColor Cyan
Write-Host "  1. Subiendo archivo..." -ForegroundColor White
Write-Host "  2. Extrayendo texto (OCR con Mistral)..." -ForegroundColor White
Write-Host "  3. Clasificando documento (Gemini)..." -ForegroundColor White
Write-Host "  4. Extrayendo datos estructurados..." -ForegroundColor White
Write-Host "  5. Guardando en Google Drive y PostgreSQL...`n" -ForegroundColor White

try {
    # Preparar el formulario multipart
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    
    $fileBytes = [System.IO.File]::ReadAllBytes($TestFile)
    $fileName = [System.IO.Path]::GetFileName($TestFile)
    
    $bodyLines = (
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
        "Content-Type: application/octet-stream$LF",
        [System.Text.Encoding]::UTF8.GetString($fileBytes),
        "--$boundary--$LF"
    ) -join $LF
    
    $uploadHeaders = @{
        Authorization = "Bearer $token"
        "Content-Type" = "multipart/form-data; boundary=$boundary"
    }
    
    Write-Host "Procesando... (esto puede tardar 30-60 segundos)" -ForegroundColor Yellow
    
    $uploadResponse = Invoke-RestMethod -Uri "$BaseUrl/documents/upload" -Method Post -Headers $uploadHeaders -Body $bodyLines -TimeoutSec 120
    
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "PROCESAMIENTO EXITOSO" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
    
    Write-Host "Resultado:" -ForegroundColor Cyan
    Write-Host "  - ID del documento: $($uploadResponse.document.id)" -ForegroundColor White
    Write-Host "  - Nombre archivo: $($uploadResponse.document.filename)" -ForegroundColor White
    Write-Host "  - Clasificado: $($uploadResponse.wasClassified)" -ForegroundColor White
    Write-Host "  - Confianza: $([math]::Round($uploadResponse.document.confidenceScore * 100, 1))%" -ForegroundColor White
    Write-Host "  - Carpeta Otros creada: $($uploadResponse.createdOthersFolder)" -ForegroundColor White
    Write-Host "  - Mensaje: $($uploadResponse.message)" -ForegroundColor White
    
    Write-Host "`nDatos extraídos:" -ForegroundColor Cyan
    $uploadResponse.document.extractedData | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
    
    $documentId = $uploadResponse.document.id
    
} catch {
    Write-Host "`nERROR EN EL PROCESAMIENTO:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "`nDetalles:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor White
    }
    exit 1
}

# ========================================
# PASO 5: Verificar el documento en la base de datos
# ========================================
Write-Host "`n[5/5] Verificando documento en base de datos..." -ForegroundColor Yellow

try {
    $document = Invoke-RestMethod -Uri "$BaseUrl/documents/$documentId" -Method Get -Headers $headers
    
    Write-Host "`nDocumento recuperado exitosamente:" -ForegroundColor Green
    Write-Host "  - ID: $($document.id)" -ForegroundColor White
    Write-Host "  - Nombre: $($document.filename)" -ForegroundColor White
    Write-Host "  - Tipo: $($document.documentTypeName)" -ForegroundColor White
    Write-Host "  - Google Drive ID: $($document.googleDriveFileId)" -ForegroundColor White
    Write-Host "  - Link: $($document.googleDriveLink)" -ForegroundColor White
    Write-Host "  - Estado: $($document.status)" -ForegroundColor White
    
} catch {
    Write-Host "Error recuperando documento: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST COMPLETADO" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

