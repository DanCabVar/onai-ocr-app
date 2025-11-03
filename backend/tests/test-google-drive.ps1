# Script de Prueba - Google Drive Integration
# Requiere que el backend esté ejecutándose

$BaseUrl = "http://localhost:4000/api"
$TestEmail = "test@example.com"
$TestPassword = "password123"

Write-Host "`n===================================" -ForegroundColor Cyan
Write-Host "PRUEBA - GOOGLE DRIVE INTEGRATION" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

# Función para realizar peticiones
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Token = $null,
        [object]$Body = $null
    )
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    
    try {
        $params = @{
            Uri = "$BaseUrl$Endpoint"
            Method = $Method
            Headers = $headers
        }
        
        if ($Body) {
            $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        return $response
    } catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $reader.BaseStream.Position = 0
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response: $responseBody" -ForegroundColor Yellow
        }
        return $null
    }
}

# Paso 1: Login
Write-Host "1. Iniciando sesión..." -ForegroundColor Yellow
$loginResponse = Invoke-ApiRequest -Method POST -Endpoint "/auth/login" -Body @{
    email = $TestEmail
    password = $TestPassword
}

if (-not $loginResponse) {
    Write-Host "Error: No se pudo iniciar sesión. Verifica las credenciales." -ForegroundColor Red
    exit 1
}

$Token = $loginResponse.accessToken
Write-Host "Sesión iniciada correctamente" -ForegroundColor Green
Write-Host "Token: $($Token.Substring(0, 20))..." -ForegroundColor Gray

# Paso 2: Verificar estado de autenticación con Google
Write-Host "`n2. Verificando estado de Google Drive..." -ForegroundColor Yellow
$statusResponse = Invoke-ApiRequest -Method GET -Endpoint "/google/status"

if ($statusResponse) {
    Write-Host "Estado: $($statusResponse.message)" -ForegroundColor $(if ($statusResponse.authenticated) { "Green" } else { "Yellow" })
    
    if (-not $statusResponse.authenticated) {
        Write-Host "`nPara autenticar con Google Drive, abre en tu navegador:" -ForegroundColor Cyan
        Write-Host "http://localhost:4000/api/google/auth" -ForegroundColor White
        Write-Host "`nPresiona Enter después de completar la autenticación..." -ForegroundColor Yellow
        Read-Host
        
        # Verificar de nuevo
        $statusResponse = Invoke-ApiRequest -Method GET -Endpoint "/google/status"
        if (-not $statusResponse.authenticated) {
            Write-Host "Error: Aún no estás autenticado con Google Drive" -ForegroundColor Red
            exit 1
        }
    }
}

# Paso 3: Crear un tipo de documento (esto debería crear una carpeta en Drive)
Write-Host "`n3. Creando tipo de documento..." -ForegroundColor Yellow
$newDocumentType = @{
    name = "Facturas Test"
    description = "Tipo de documento de prueba para Google Drive"
    fields = @(
        @{
            name = "numero_factura"
            label = "Número de Factura"
            type = "string"
            required = $true
            description = "Número único de la factura"
        },
        @{
            name = "fecha"
            label = "Fecha"
            type = "date"
            required = $true
        },
        @{
            name = "total"
            label = "Total"
            type = "number"
            required = $true
        }
    )
}

$createResponse = Invoke-ApiRequest -Method POST -Endpoint "/document-types" -Token $Token -Body $newDocumentType

if ($createResponse) {
    Write-Host "Tipo de documento creado correctamente" -ForegroundColor Green
    Write-Host "ID: $($createResponse.id)" -ForegroundColor Gray
    Write-Host "Nombre: $($createResponse.name)" -ForegroundColor Gray
    
    if ($createResponse.googleDriveFolderId) {
        Write-Host "Google Drive Folder ID: $($createResponse.googleDriveFolderId)" -ForegroundColor Green
        Write-Host "Folder Path: $($createResponse.folderPath)" -ForegroundColor Green
    } else {
        Write-Host "Advertencia: No se creó carpeta en Google Drive" -ForegroundColor Yellow
    }
}

# Paso 4: Listar tipos de documento
Write-Host "`n4. Listando tipos de documento..." -ForegroundColor Yellow
$listResponse = Invoke-ApiRequest -Method GET -Endpoint "/document-types" -Token $Token

if ($listResponse) {
    Write-Host "Total de tipos: $($listResponse.Count)" -ForegroundColor Green
    foreach ($type in $listResponse) {
        Write-Host "`n  - $($type.name)" -ForegroundColor White
        Write-Host "    ID: $($type.id)" -ForegroundColor Gray
        if ($type.googleDriveFolderId) {
            Write-Host "    Drive Folder: $($type.googleDriveFolderId)" -ForegroundColor Green
        }
    }
}

# Paso 5: Listar archivos en la carpeta raíz de Drive
Write-Host "`n5. Listando archivos en la carpeta raíz de Google Drive..." -ForegroundColor Yellow
$filesResponse = Invoke-ApiRequest -Method GET -Endpoint "/google/files"

if ($filesResponse) {
    Write-Host "Carpeta ID: $($filesResponse.folderId)" -ForegroundColor Gray
    Write-Host "Total de archivos/carpetas: $($filesResponse.filesCount)" -ForegroundColor Green
    
    if ($filesResponse.files -and $filesResponse.files.Count -gt 0) {
        foreach ($file in $filesResponse.files) {
            $icon = if ($file.mimeType -eq "application/vnd.google-apps.folder") { "[FOLDER]" } else { "[FILE]" }
            Write-Host "  $icon $($file.name) - ID: $($file.id)" -ForegroundColor White
        }
    }
}

Write-Host "`n===================================" -ForegroundColor Cyan
Write-Host "PRUEBAS COMPLETADAS" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

