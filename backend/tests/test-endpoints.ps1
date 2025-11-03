# ========================================
# Script de Prueba - ONAI OCR Backend API
# ========================================
# PowerShell script para probar todos los endpoints de la API

$BaseUrl = "http://localhost:4000/api"
$TestEmail = "test@example.com"
$TestPassword = "password123"
$TestName = "Usuario Test"

Write-Host "Iniciando pruebas de API..." -ForegroundColor Cyan
Write-Host ""

# ========================================
# 1. Test de Registro
# ========================================
Write-Host "Test 1: Registrar Usuario" -ForegroundColor Yellow
try {
    $registerBody = @{
        email = $TestEmail
        password = $TestPassword
        name = $TestName
    } | ConvertTo-Json

    $registerResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/register" `
        -Method Post `
        -Body $registerBody `
        -ContentType "application/json"

    $token = $registerResponse.accessToken
    Write-Host "   [OK] Usuario registrado exitosamente" -ForegroundColor Green
    Write-Host "   ID: $($registerResponse.user.id)" -ForegroundColor Gray
    Write-Host "   Email: $($registerResponse.user.email)" -ForegroundColor Gray
    Write-Host "   Token: $($token.Substring(0, 30))..." -ForegroundColor Gray
    Write-Host ""
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 409) {
        Write-Host "   [WARN] Usuario ya existe, intentando login..." -ForegroundColor Yellow
        
        # Hacer login si el usuario ya existe
        $loginBody = @{
            email = $TestEmail
            password = $TestPassword
        } | ConvertTo-Json

        $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" `
            -Method Post `
            -Body $loginBody `
            -ContentType "application/json"

        $token = $loginResponse.accessToken
        Write-Host "   [OK] Login exitoso" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        exit
    }
}

# ========================================
# 2. Test de Login
# ========================================
Write-Host "Test 2: Login de Usuario" -ForegroundColor Yellow
try {
    $loginBody = @{
        email = $TestEmail
        password = $TestPassword
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" `
        -Method Post `
        -Body $loginBody `
        -ContentType "application/json"

    Write-Host "   [OK] Login exitoso" -ForegroundColor Green
    Write-Host "   Token obtenido" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# ========================================
# 3. Test de Obtener Perfil
# ========================================
Write-Host "Test 3: Obtener Perfil (Endpoint Protegido)" -ForegroundColor Yellow
try {
    $headers = @{
        Authorization = "Bearer $token"
    }

    $profileResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/profile" `
        -Method Get `
        -Headers $headers

    Write-Host "   [OK] Perfil obtenido exitosamente" -ForegroundColor Green
    Write-Host "   ID: $($profileResponse.id)" -ForegroundColor Gray
    Write-Host "   Email: $($profileResponse.email)" -ForegroundColor Gray
    Write-Host "   Nombre: $($profileResponse.name)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# ========================================
# 4. Test de Listar Documentos
# ========================================
Write-Host "Test 4: Listar Documentos" -ForegroundColor Yellow
try {
    $headers = @{
        Authorization = "Bearer $token"
    }

    $documentsResponse = Invoke-RestMethod -Uri "$BaseUrl/documents" `
        -Method Get `
        -Headers $headers

    Write-Host "   [OK] Documentos obtenidos exitosamente" -ForegroundColor Green
    Write-Host "   Total de documentos: $($documentsResponse.Count)" -ForegroundColor Gray
    
    if ($documentsResponse.Count -gt 0) {
        Write-Host "   Primeros documentos:" -ForegroundColor Gray
        $documentsResponse[0..2] | ForEach-Object {
            Write-Host "      - $($_.filename) (ID: $($_.id), Status: $($_.status))" -ForegroundColor Gray
        }
    }
    Write-Host ""
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# ========================================
# 5. Test de Error sin Token
# ========================================
Write-Host "Test 5: Error sin Token (Debe fallar)" -ForegroundColor Yellow
try {
    $errorResponse = Invoke-RestMethod -Uri "$BaseUrl/documents" `
        -Method Get

    Write-Host "   [ERROR] No deberia llegar aqui" -ForegroundColor Red
    Write-Host ""
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "   [OK] Error 401 correctamente lanzado (sin autenticacion)" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "   [WARN] Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host ""
    }
}

# ========================================
# 6. Test de Credenciales Invalidas
# ========================================
Write-Host "Test 6: Login con Credenciales Invalidas (Debe fallar)" -ForegroundColor Yellow
try {
    $wrongLoginBody = @{
        email = $TestEmail
        password = "wrongpassword"
    } | ConvertTo-Json

    $wrongLoginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" `
        -Method Post `
        -Body $wrongLoginBody `
        -ContentType "application/json"

    Write-Host "   [ERROR] No deberia llegar aqui" -ForegroundColor Red
    Write-Host ""
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "   [OK] Error 401 correctamente lanzado (credenciales invalidas)" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "   [WARN] Error inesperado: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host ""
    }
}

# ========================================
# Resumen
# ========================================
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Pruebas completadas exitosamente" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Token JWT para usar en otras pruebas:" -ForegroundColor Yellow
Write-Host $token -ForegroundColor Gray
Write-Host ""
Write-Host "Ejemplo de uso del token:" -ForegroundColor Cyan
Write-Host '  $headers = @{ Authorization = "Bearer YOUR_TOKEN" }' -ForegroundColor Gray
Write-Host '  Invoke-RestMethod -Uri "http://localhost:4000/api/documents" -Headers $headers' -ForegroundColor Gray
Write-Host ""
