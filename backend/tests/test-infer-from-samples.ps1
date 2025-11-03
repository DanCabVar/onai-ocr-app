# Script para probar el endpoint de inferencia de tipos desde documentos
# Requiere tener el token JWT y documentos de ejemplo

# Configuracion
$BASE_URL = "http://localhost:3000"
$TOKEN = "TU_TOKEN_JWT_AQUI"  # Reemplazar con tu token

# Colores para output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Info "========================================="
Write-Info "TEST: Inferir Tipos desde Documentos"
Write-Info "========================================="
Write-Host ""

# Verificar que existan archivos de ejemplo
$exampleFiles = @(
    "C:\Users\danil\Documents\test-docs\orden_compra_1.pdf",
    "C:\Users\danil\Documents\test-docs\orden_compra_2.pdf",
    "C:\Users\danil\Documents\test-docs\factura_1.pdf"
)

Write-Info "[INFO] Archivos de ejemplo esperados:"
foreach ($file in $exampleFiles) {
    if (Test-Path $file) {
        Write-Success "  [OK] $file"
    } else {
        Write-Error "  [ERROR] $file (NO ENCONTRADO)"
    }
}
Write-Host ""

# Preguntar al usuario que archivos usar
Write-Info "Deseas usar archivos personalizados? (s/N)"
$useCustomFiles = Read-Host

if ($useCustomFiles -eq "s" -or $useCustomFiles -eq "S") {
    Write-Info "Ingresa las rutas de los archivos (una por linea, presiona Enter vacio para terminar):"
    $customFiles = @()
    do {
        $file = Read-Host "Archivo"
        if ($file -ne "") {
            $customFiles += $file
        }
    } while ($file -ne "" -and $customFiles.Count -lt 10)
    $exampleFiles = $customFiles
}

# Validar que tengamos al menos 2 archivos
$validFiles = @($exampleFiles | Where-Object { Test-Path $_ })
if ($validFiles.Count -lt 2) {
    Write-Error "[ERROR] Se requieren al menos 2 archivos validos"
    Write-Info "Por favor, coloca documentos de ejemplo en las rutas especificadas"
    exit 1
}

Write-Success "[OK] Se usaran $($validFiles.Count) archivos"
Write-Host ""

# Preguntar si se deben subir los documentos de ejemplo a Drive
Write-Info "Deseas subir los documentos de ejemplo a Google Drive? (s/N)"
$uploadSamples = Read-Host
$uploadSamplesParam = if ($uploadSamples -eq "s" -or $uploadSamples -eq "S") { "true" } else { "false" }

Write-Host ""
Write-Info "[INFO] Enviando documentos al backend..."
Write-Info "        Esto puede tomar 2-3 minutos..."
Write-Host ""

# Preparar la solicitud multipart/form-data
$uri = "$BASE_URL/document-types/infer-from-samples?uploadSamples=$uploadSamplesParam"
$headers = @{
    "Authorization" = "Bearer $TOKEN"
}

# Construir el cuerpo multipart usando System.Net.Http
Add-Type -AssemblyName System.Net.Http

$httpClient = New-Object System.Net.Http.HttpClient
$httpClient.DefaultRequestHeaders.Add("Authorization", "Bearer $TOKEN")

$multipartContent = New-Object System.Net.Http.MultipartFormDataContent

foreach ($file in $validFiles) {
    $fileStream = [System.IO.File]::OpenRead($file)
    $fileName = [System.IO.Path]::GetFileName($file)
    $fileContent = New-Object System.Net.Http.StreamContent($fileStream)
    $fileContent.Headers.ContentType = New-Object System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream")
    $multipartContent.Add($fileContent, "files", $fileName)
}

# Hacer la solicitud
try {
    Write-Info "[INFO] Procesando..."
    $response = $httpClient.PostAsync($uri, $multipartContent).Result
    $responseContent = $response.Content.ReadAsStringAsync().Result
    
    # Cerrar streams
    $multipartContent.Dispose()
    $httpClient.Dispose()
    
    if ($response.IsSuccessStatusCode) {
        $result = $responseContent | ConvertFrom-Json
        
        Write-Success "========================================="
        Write-Success "[EXITO] Tipos creados exitosamente"
        Write-Success "========================================="
        Write-Host ""
        
        Write-Info "[INFO] Resumen:"
        Write-Host "  * Documentos procesados: $($result.totalDocumentsProcessed)"
        Write-Host "  * Tipos creados: $($result.totalTypesCreated)"
        Write-Host ""
        
        Write-Info "[INFO] Tipos de documento creados:"
        foreach ($type in $result.createdTypes) {
            Write-Host ""
            Write-Success "  [TIPO] $($type.name)"
            Write-Host "     ID: $($type.id)"
            Write-Host "     Descripcion: $($type.description)"
            Write-Host "     Campos: $($type.fieldCount)"
            Write-Host "     Documentos de ejemplo: $($type.sampleDocumentCount)"
            Write-Host "     Carpeta Drive: $($type.folderPath)"
            
            if ($type.fields.Count -gt 0) {
                Write-Info "     Campos consolidados:"
                foreach ($field in $type.fields | Select-Object -First 5) {
                    $requiredText = if ($field.required) { "[REQUERIDO]" } else { "[OPCIONAL]" }
                    Write-Host "       * $($field.label) ($($field.name)) - $($field.type) $requiredText"
                }
                if ($type.fields.Count -gt 5) {
                    Write-Host "       ... y $($type.fields.Count - 5) campos mas"
                }
            }
        }
    } else {
        Write-Error "========================================="
        Write-Error "[ERROR] Error en la solicitud"
        Write-Error "========================================="
        Write-Host ""
        Write-Error "Status Code: $($response.StatusCode)"
        Write-Host ""
        Write-Info "Respuesta del servidor:"
        Write-Host $responseContent
    }
    
} catch {
    Write-Error "========================================="
    Write-Error "[ERROR] Excepcion en la solicitud"
    Write-Error "========================================="
    Write-Host ""
    Write-Error "Mensaje: $($_.Exception.Message)"
    Write-Host ""
    
    if ($_.Exception.InnerException) {
        Write-Info "Detalles:"
        Write-Host $_.Exception.InnerException.Message
    }
}

Write-Host ""
Write-Info "========================================="
Write-Info "Test completado"
Write-Info "========================================="
