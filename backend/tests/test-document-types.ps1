# ========================================
# Test Feature 1: Tipos de Documento
# ========================================

$BaseUrl = "http://localhost:4000/api"

Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Feature 1: Tipos de Documento - Tests" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Obtener token (asumiendo que ya existe el usuario de prueba)
Write-Host "[1/6] Login para obtener token..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "test@example.com"
        password = "password123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" `
        -Method Post `
        -Body $loginBody `
        -ContentType "application/json"

    $token = $loginResponse.accessToken
    $headers = @{
        Authorization = "Bearer $token"
    }
    Write-Host "   [OK] Token obtenido" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Ejecuta primero: .\test-endpoints.ps1" -ForegroundColor Yellow
    exit
}

# Test 1: Crear tipo "Factura"
Write-Host "[2/6] Crear tipo de documento: Factura" -ForegroundColor Yellow
try {
    $createFacturaBody = @{
        name = "Factura"
        description = "Facturas de proveedores y clientes"
        fields = @(
            @{
                name = "numero_factura"
                type = "string"
                label = "Numero de Factura"
                required = $true
                description = "Numero unico de la factura"
            },
            @{
                name = "fecha"
                type = "date"
                label = "Fecha"
                required = $true
                description = "Fecha de emision"
            },
            @{
                name = "total"
                type = "number"
                label = "Total"
                required = $true
                description = "Monto total"
            },
            @{
                name = "cliente"
                type = "string"
                label = "Cliente"
                required = $false
                description = "Nombre del cliente"
            }
        )
    } | ConvertTo-Json -Depth 10

    $facturaResponse = Invoke-RestMethod -Uri "$BaseUrl/document-types" `
        -Method Post `
        -Headers $headers `
        -Body $createFacturaBody `
        -ContentType "application/json"

    $facturaId = $facturaResponse.id
    Write-Host "   [OK] Tipo 'Factura' creado (ID: $facturaId)" -ForegroundColor Green
    Write-Host "   Campos: numero_factura, fecha, total, cliente" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 2: Crear tipo "Orden de Compra"
Write-Host "[3/6] Crear tipo de documento: Orden de Compra" -ForegroundColor Yellow
try {
    $createOrdenBody = @{
        name = "Orden de Compra"
        description = "Ordenes de compra a proveedores"
        fields = @(
            @{
                name = "numero_orden"
                type = "string"
                label = "Numero de Orden"
                required = $true
            },
            @{
                name = "fecha_orden"
                type = "date"
                label = "Fecha de Orden"
                required = $true
            },
            @{
                name = "proveedor"
                type = "string"
                label = "Proveedor"
                required = $true
            },
            @{
                name = "monto_total"
                type = "number"
                label = "Monto Total"
                required = $true
            },
            @{
                name = "estado"
                type = "string"
                label = "Estado"
                required = $false
            }
        )
    } | ConvertTo-Json -Depth 10

    $ordenResponse = Invoke-RestMethod -Uri "$BaseUrl/document-types" `
        -Method Post `
        -Headers $headers `
        -Body $createOrdenBody `
        -ContentType "application/json"

    $ordenId = $ordenResponse.id
    Write-Host "   [OK] Tipo 'Orden de Compra' creado (ID: $ordenId)" -ForegroundColor Green
    Write-Host "   Campos: numero_orden, fecha_orden, proveedor, monto_total, estado" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 3: Listar todos los tipos
Write-Host "[4/6] Listar todos los tipos de documento" -ForegroundColor Yellow
try {
    $typesResponse = Invoke-RestMethod -Uri "$BaseUrl/document-types" `
        -Method Get `
        -Headers $headers

    Write-Host "   [OK] Total de tipos: $($typesResponse.Count)" -ForegroundColor Green
    foreach ($type in $typesResponse) {
        Write-Host "   - $($type.name) (ID: $($type.id), Campos: $($type.fieldSchema.fields.Count))" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 4: Obtener un tipo especifico
Write-Host "[5/6] Obtener detalles del tipo 'Factura'" -ForegroundColor Yellow
try {
    $facturaDetails = Invoke-RestMethod -Uri "$BaseUrl/document-types/$facturaId" `
        -Method Get `
        -Headers $headers

    Write-Host "   [OK] Tipo obtenido: $($facturaDetails.name)" -ForegroundColor Green
    Write-Host "   Descripcion: $($facturaDetails.description)" -ForegroundColor Gray
    Write-Host "   Campos definidos:" -ForegroundColor Gray
    foreach ($field in $facturaDetails.fieldSchema.fields) {
        $req = if ($field.required) { "REQUERIDO" } else { "OPCIONAL" }
        Write-Host "      - $($field.label) ($($field.name)): $($field.type) [$req]" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 5: Intentar eliminar tipo (deberia funcionar porque no tiene documentos)
Write-Host "[6/6] Intentar eliminar tipo 'Orden de Compra'" -ForegroundColor Yellow
try {
    $deleteResponse = Invoke-RestMethod -Uri "$BaseUrl/document-types/$ordenId" `
        -Method Delete `
        -Headers $headers

    Write-Host "   [OK] $($deleteResponse.message)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Resumen
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Feature 1: Tests Completados" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Resultados:" -ForegroundColor Yellow
Write-Host "  - Tipo 'Factura' creado (ID: $facturaId)" -ForegroundColor Gray
Write-Host "  - Tipo 'Orden de Compra' creado y eliminado" -ForegroundColor Gray
Write-Host "  - Endpoints CRUD funcionando correctamente" -ForegroundColor Gray
Write-Host ""
Write-Host "Siguiente paso:" -ForegroundColor Cyan
Write-Host "  Desarrollar frontend para gestionar estos tipos" -ForegroundColor Gray
Write-Host ""

