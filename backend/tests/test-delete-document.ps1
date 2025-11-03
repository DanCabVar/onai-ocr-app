# Script para eliminar documentos desde PowerShell
# =====================================================

# Configuración
$BackendUrl = "http://localhost:4000/api"
$TestUserEmail = "testuser@example.com"
$TestUserPassword = "password123"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST: ELIMINAR DOCUMENTO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- PASO 1: Login ---
Write-Host "--- PASO 1: Logueando usuario ---" -ForegroundColor Yellow
try {
    $loginBody = @{
        email = $TestUserEmail
        password = $TestUserPassword
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$BackendUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody

    $token = $loginResponse.access_token
    Write-Host "[OK] Login exitoso. Token obtenido." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Fallo en login." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
Write-Host ""

# --- PASO 2: Listar documentos ---
Write-Host "--- PASO 2: Listando documentos del usuario ---" -ForegroundColor Yellow
try {
    $documentsResponse = Invoke-RestMethod -Uri "$BackendUrl/documents" -Method Get -Headers @{ Authorization = "Bearer $token" }
    
    Write-Host "[OK] Documentos encontrados: $($documentsResponse.length)" -ForegroundColor Green
    
    if ($documentsResponse.length -eq 0) {
        Write-Host "[INFO] No hay documentos para eliminar." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host ""
    Write-Host "Lista de documentos:" -ForegroundColor White
    Write-Host "-------------------" -ForegroundColor White
    
    $index = 1
    foreach ($doc in $documentsResponse) {
        Write-Host "[$index] ID: $($doc.id) | Archivo: $($doc.filename) | Tipo: $($doc.documentTypeName)" -ForegroundColor White
        $index++
    }
    
} catch {
    Write-Host "[ERROR] Fallo al listar documentos." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
Write-Host ""

# --- PASO 3: Seleccionar documento a eliminar ---
Write-Host "--- PASO 3: Selecciona el documento a eliminar ---" -ForegroundColor Yellow
$documentId = Read-Host "Ingresa el ID del documento que quieres eliminar (o 0 para cancelar)"

if ($documentId -eq "0" -or [string]::IsNullOrWhiteSpace($documentId)) {
    Write-Host "[INFO] Operacion cancelada." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "[ADVERTENCIA] Estas a punto de eliminar el documento con ID: $documentId" -ForegroundColor Red
$confirm = Read-Host "Estas seguro? (SI/NO)"

if ($confirm -ne "SI") {
    Write-Host "[INFO] Operacion cancelada." -ForegroundColor Yellow
    exit 0
}

# --- PASO 4: Eliminar documento ---
Write-Host ""
Write-Host "--- PASO 4: Eliminando documento ---" -ForegroundColor Yellow
try {
    $deleteResponse = Invoke-RestMethod -Uri "$BackendUrl/documents/$documentId" -Method Delete -Headers @{ Authorization = "Bearer $token" }
    
    Write-Host "[OK] Documento eliminado exitosamente." -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "        DOCUMENTO ELIMINADO" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Resultado:" -ForegroundColor White
    Write-Host "  - Mensaje: $($deleteResponse.message)" -ForegroundColor White
    Write-Host "  - Advertencia: $($deleteResponse.warning)" -ForegroundColor Yellow
    Write-Host "  - Archivo eliminado: $($deleteResponse.document.filename)" -ForegroundColor White
    Write-Host "  - Google Drive File ID: $($deleteResponse.document.googleDriveFileId)" -ForegroundColor White
    Write-Host ""
    Write-Host "[INFO] Recuerda que el archivo en Google Drive NO fue eliminado." -ForegroundColor Yellow
    Write-Host "[INFO] Puedes eliminarlo manualmente desde: $($deleteResponse.document.googleDriveLink)" -ForegroundColor Yellow
    
} catch {
    Write-Host "[ERROR] Fallo al eliminar el documento." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $errorBody = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorBody)
        $responseContent = $reader.ReadToEnd()
        Write-Host "Detalle del error del servidor: $responseContent" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PRUEBA COMPLETADA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

