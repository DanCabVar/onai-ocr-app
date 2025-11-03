# ========================================
# PRUEBA RÁPIDA: Flujo "Otros" Regenerable
# ========================================

$baseUrl = "http://localhost:4000/api"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PRUEBA: Flujo 'Otros' Regenerable" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Credenciales del usuario (ajusta según tu usuario real)
$email = "test@example.com"  # CAMBIA ESTO
$password = "password123"     # CAMBIA ESTO

Write-Host "`n--- PASO 1: Login ---" -ForegroundColor Yellow
try {
    $loginBody = @{
        email = $email
        password = $password
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $token = $loginResponse.access_token
    Write-Host "[OK] Login exitoso" -ForegroundColor Green
    Write-Host "Usuario: $email" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Fallo en login." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Headers con autenticación
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "`n--- PASO 2: Listar todos los documentos ---" -ForegroundColor Yellow
try {
    $documents = Invoke-RestMethod -Uri "$baseUrl/documents" -Method Get -Headers $headers
    
    if ($documents.Count -eq 0) {
        Write-Host "[INFO] No hay documentos. Saltando eliminación." -ForegroundColor Gray
    } else {
        Write-Host "[OK] Documentos encontrados: $($documents.Count)" -ForegroundColor Green
        
        # Mostrar documentos
        Write-Host "`nLista de documentos:" -ForegroundColor Cyan
        Write-Host "-------------------" -ForegroundColor Cyan
        foreach ($doc in $documents) {
            $typeName = if ($doc.documentTypeName) { $doc.documentTypeName } else { "Sin tipo" }
            Write-Host "[ID: $($doc.id)] $($doc.filename) - Tipo: $typeName" -ForegroundColor White
        }
        
        # Preguntar cuál eliminar
        Write-Host "`n¿Quieres eliminar algún documento? (Ingresa el ID o 0 para saltar): " -ForegroundColor Yellow -NoNewline
        $docIdToDelete = Read-Host
        
        if ($docIdToDelete -ne "0" -and $docIdToDelete -ne "") {
            Write-Host "`n--- PASO 3: Eliminando documento ID $docIdToDelete ---" -ForegroundColor Yellow
            try {
                $deleteResponse = Invoke-RestMethod -Uri "$baseUrl/documents/$docIdToDelete" -Method Delete -Headers $headers
                Write-Host "[OK] Documento eliminado exitosamente" -ForegroundColor Green
                Write-Host "Mensaje: $($deleteResponse.message)" -ForegroundColor Gray
                if ($deleteResponse.warning) {
                    Write-Host "Advertencia: $($deleteResponse.warning)" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "[ERROR] No se pudo eliminar el documento" -ForegroundColor Red
                Write-Host $_.Exception.Message -ForegroundColor Red
            }
        }
    }
} catch {
    Write-Host "[ERROR] No se pudo listar documentos" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "`n--- PASO 4: Listar tipos de documento ---" -ForegroundColor Yellow
try {
    $types = Invoke-RestMethod -Uri "$baseUrl/document-types" -Method Get -Headers $headers
    
    Write-Host "[OK] Tipos de documento encontrados: $($types.Count)" -ForegroundColor Green
    
    # Mostrar tipos
    Write-Host "`nLista de tipos:" -ForegroundColor Cyan
    Write-Host "---------------" -ForegroundColor Cyan
    foreach ($type in $types) {
        Write-Host "[ID: $($type.id)] $($type.name) - Campos: $($type.fieldSchema.fields.Count)" -ForegroundColor White
    }
    
    # Buscar "Otros"
    $othersType = $types | Where-Object { $_.name -like "*Otros*" }
    
    if ($othersType) {
        Write-Host "`n[INFO] Tipo 'Otros' encontrado (ID: $($othersType.id))" -ForegroundColor Cyan
        Write-Host "¿Quieres eliminarlo para probar la recreación? (S/N): " -ForegroundColor Yellow -NoNewline
        $confirm = Read-Host
        
        if ($confirm -eq "S" -or $confirm -eq "s") {
            Write-Host "`n--- PASO 5: Eliminando tipo 'Otros' ---" -ForegroundColor Yellow
            try {
                $deleteTypeResponse = Invoke-RestMethod -Uri "$baseUrl/document-types/$($othersType.id)" -Method Delete -Headers $headers
                Write-Host "[OK] Tipo 'Otros' eliminado exitosamente" -ForegroundColor Green
                Write-Host "Mensaje: $($deleteTypeResponse.message)" -ForegroundColor Gray
                if ($deleteTypeResponse.warning) {
                    Write-Host "Advertencia: $($deleteTypeResponse.warning)" -ForegroundColor Yellow
                }
                
                Write-Host "`n✅ PERFECTO: Ahora 'Otros' ha sido eliminado." -ForegroundColor Green
                Write-Host "📋 PRÓXIMO PASO: Sube un documento desde el frontend." -ForegroundColor Cyan
                Write-Host "   El sistema debería recrear automáticamente 'Otros'." -ForegroundColor Cyan
                
            } catch {
                Write-Host "[ERROR] No se pudo eliminar el tipo 'Otros'" -ForegroundColor Red
                Write-Host $_.Exception.Message -ForegroundColor Red
                
                # Si falla por documentos asociados
                if ($_.Exception.Message -like "*documentos asociados*") {
                    Write-Host "`n⚠️  El tipo 'Otros' tiene documentos asociados." -ForegroundColor Yellow
                    Write-Host "Elimina primero todos los documentos y vuelve a intentar." -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "`n[INFO] No existe tipo 'Otros'. Perfecto para la prueba." -ForegroundColor Green
        Write-Host "📋 PRÓXIMO PASO: Sube un documento desde el frontend." -ForegroundColor Cyan
        Write-Host "   El sistema debería crear automáticamente 'Otros'." -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "[ERROR] No se pudo listar tipos de documento" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  FIN DEL TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

