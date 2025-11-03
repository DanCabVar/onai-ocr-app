# run-cascade-migration.ps1
# Script para ejecutar la migración de CASCADE DELETE

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "MIGRACIÓN: Agregar CASCADE DELETE" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Leer variables del archivo .env
Write-Host "[INFO] Leyendo configuración desde .env..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] No se encontró el archivo .env" -ForegroundColor Red
    exit 1
}

# Leer el archivo .env y extraer las variables de conexión
$envContent = Get-Content ".env" -Raw
$dbHost = if ($envContent -match 'DB_HOST=(.+)') { $Matches[1].Trim() } else { 'localhost' }
$dbPort = if ($envContent -match 'DB_PORT=(.+)') { $Matches[1].Trim() } else { '5432' }
$dbUser = if ($envContent -match 'DB_USERNAME=(.+)') { $Matches[1].Trim() } else { 'postgres' }
$dbPassword = if ($envContent -match 'DB_PASSWORD=(.+)') { $Matches[1].Trim() } else { '' }
$dbName = if ($envContent -match 'DB_NAME=(.+)') { $Matches[1].Trim() } else { 'onai_ocr' }

Write-Host "[INFO] Configuración de Base de Datos:" -ForegroundColor Cyan
Write-Host "  Host: $dbHost" -ForegroundColor White
Write-Host "  Puerto: $dbPort" -ForegroundColor White
Write-Host "  Usuario: $dbUser" -ForegroundColor White
Write-Host "  Base de Datos: $dbName" -ForegroundColor White
Write-Host ""

# Construir la cadena de conexión
$env:PGPASSWORD = $dbPassword

Write-Host "[INFO] Ejecutando migración SQL..." -ForegroundColor Yellow
Write-Host ""

try {
    # Ejecutar el archivo SQL usando psql
    $result = & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "MIGRATION_CASCADE_DELETE.sql" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Green
        Write-Host "✅ MIGRACIÓN EXITOSA" -ForegroundColor Green
        Write-Host "=========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Ahora los documentos se eliminarán automáticamente" -ForegroundColor Green
        Write-Host "cuando elimines un tipo de documento." -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "=========================================" -ForegroundColor Red
        Write-Host "❌ ERROR EN LA MIGRACIÓN" -ForegroundColor Red
        Write-Host "=========================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Detalles del error:" -ForegroundColor Yellow
        Write-Host $result -ForegroundColor Red
        Write-Host ""
        Write-Host "Por favor, ejecuta manualmente el archivo:" -ForegroundColor Yellow
        Write-Host "  MIGRATION_CASCADE_DELETE.sql" -ForegroundColor White
        Write-Host ""
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host "❌ ERROR: No se pudo ejecutar psql" -ForegroundColor Red
    Write-Host "=========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Asegúrate de tener PostgreSQL instalado y" -ForegroundColor Yellow
    Write-Host "psql disponible en el PATH del sistema." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternativamente, ejecuta manualmente:" -ForegroundColor Yellow
    Write-Host "  psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f MIGRATION_CASCADE_DELETE.sql" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Limpiar la variable de entorno
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-Host "Presiona Enter para salir..."
Read-Host

