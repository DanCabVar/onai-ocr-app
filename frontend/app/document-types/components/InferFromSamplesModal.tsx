"use client"

import { useState, useCallback } from 'react'
import { X, Upload, FileText, Loader2, CheckCircle2, AlertCircle, Sparkles, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { documentTypeInferenceService, CreatedDocumentType } from '@/app/services/document-type-inference.service'

interface InferFromSamplesModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type ModalState = 'upload' | 'processing' | 'success' | 'error'

export function InferFromSamplesModal({ isOpen, onClose, onSuccess }: InferFromSamplesModalProps) {
  const { toast } = useToast()
  const [state, setState] = useState<ModalState>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadSamples, setUploadSamples] = useState(false)
  const [progress, setProgress] = useState(0)
  const [createdTypes, setCreatedTypes] = useState<CreatedDocumentType[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  // Reset modal
  const resetModal = useCallback(() => {
    setState('upload')
    setFiles([])
    setProgress(0)
    setCreatedTypes([])
    setErrorMessage('')
    setUploadSamples(false)
  }, [])

  // Handle close
  const handleClose = useCallback(() => {
    resetModal()
    onClose()
  }, [onClose, resetModal])

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [])

  // Add files with validation
  const addFiles = (newFiles: File[]) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    const maxSize = 10 * 1024 * 1024 // 10MB

    const validFiles = newFiles.filter(file => {
      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Archivo no permitido',
          description: `${file.name}: Solo se permiten PDF, PNG, JPG`,
          variant: 'destructive',
        })
        return false
      }

      if (file.size > maxSize) {
        toast({
          title: 'Archivo muy grande',
          description: `${file.name}: Máximo 10MB por archivo`,
          variant: 'destructive',
        })
        return false
      }

      return true
    })

    setFiles(prev => {
      const combined = [...prev, ...validFiles]
      if (combined.length > 10) {
        toast({
          title: 'Demasiados archivos',
          description: 'Máximo 10 archivos permitidos',
          variant: 'destructive',
        })
        return combined.slice(0, 10)
      }
      return combined
    })
  }

  // Handle file input
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  // Remove file
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Calcular tiempo estimado según cantidad de archivos
  const getEstimatedTime = (fileCount: number): string => {
    if (fileCount <= 2) return '2-4 minutos'
    if (fileCount <= 4) return '4-6 minutos'
    if (fileCount <= 6) return '6-8 minutos'
    if (fileCount <= 8) return '8-10 minutos'
    return '10-12 minutos' // 9-10 archivos
  }

  // Process files
  const handleProcess = async () => {
    if (files.length < 2) {
      toast({
        title: 'Archivos insuficientes',
        description: 'Se requieren al menos 2 documentos',
        variant: 'destructive',
      })
      return
    }

    setState('processing')
    setProgress(10)

    try {
      // Simular progreso mientras se procesa
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90))
      }, 2000)

      const result = await documentTypeInferenceService.inferFromSamples(files, uploadSamples)

      clearInterval(progressInterval)
      setProgress(100)

      setCreatedTypes(result.createdTypes)
      setState('success')

      toast({
        title: 'Tipos creados exitosamente',
        description: `${result.totalTypesCreated} tipo(s) de documento creado(s)`,
      })

      // No cerramos automáticamente - el usuario cierra cuando esté listo

    } catch (error: any) {
      setProgress(0)
      setState('error')
      const errorMsg = error.response?.data?.message || error.message || 'Error desconocido'
      setErrorMessage(errorMsg)

      toast({
        title: 'Error al procesar documentos',
        description: errorMsg,
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Crear Tipos desde Documentos
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* ESTADO: UPLOAD */}
          {state === 'upload' && (
            <div className="space-y-6">
              {/* Zona de upload */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium mb-2">
                    Arrastra documentos aquí o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    PDF, PNG, JPG • Máximo 10 archivos • 10MB por archivo
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-input"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    Seleccionar archivos
                  </Button>
                </div>
              </div>

              {/* Lista de archivos */}
              {files.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">
                      Documentos seleccionados ({files.length}/10)
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiles([])}
                    >
                      Limpiar todo
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20"
                      >
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Opción: Subir ejemplos a Drive */}
              {files.length > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/20">
                  <input
                    type="checkbox"
                    id="upload-samples"
                    checked={uploadSamples}
                    onChange={(e) => setUploadSamples(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="upload-samples" className="text-sm cursor-pointer">
                    <p className="font-medium mb-1">Guardar documentos en Drive y Base de Datos</p>
                    <p className="text-xs text-muted-foreground">
                      Los documentos se procesarán como documentos reales y estarán disponibles en el sistema
                    </p>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ESTADO: PROCESSING */}
          {state === 'processing' && (
            <div className="py-12 space-y-6">
              <div className="text-center">
                <Loader2 className="h-16 w-16 mx-auto mb-4 text-primary animate-spin" />
                <h3 className="text-lg font-semibold mb-2">Analizando documentos...</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Esto puede tomar {getEstimatedTime(files.length)}. Por favor espera.
                </p>
              </div>

              <div className="space-y-3">
                <Progress value={progress} className="h-2" />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {progress >= 20 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <span>Identificando tipos de documento...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {progress >= 50 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4" />
                    )}
                    <span className={progress < 50 ? 'text-muted-foreground' : ''}>
                      Extrayendo campos...
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {progress >= 70 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4" />
                    )}
                    <span className={progress < 70 ? 'text-muted-foreground' : ''}>
                      Consolidando schemas...
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {progress >= 90 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4" />
                    )}
                    <span className={progress < 90 ? 'text-muted-foreground' : ''}>
                      Creando tipos de documento...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ESTADO: SUCCESS */}
          {state === 'success' && (
            <div className="py-8 space-y-6">
              <div className="text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-semibold mb-2">¡Proceso completado exitosamente!</h3>
                <p className="text-sm text-muted-foreground">
                  {createdTypes.length === 0 
                    ? 'Los tipos ya existían, pero los documentos se agregaron correctamente'
                    : `Se procesaron ${createdTypes.length} tipo(s) de documento`}
                </p>
              </div>

              {createdTypes.length > 0 && (
                <div className="space-y-4">
                  {createdTypes.map((type) => (
                  <div
                    key={type.id}
                    className="p-4 rounded-lg border border-border bg-muted/20"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-base">{type.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {type.description}
                        </p>
                      </div>
                      <Folder className="h-5 w-5 text-primary flex-shrink-0" />
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Campos</p>
                        <p className="font-medium">{type.fieldCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Documentos</p>
                        <p className="font-medium">{type.sampleDocumentCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ID</p>
                        <p className="font-medium">#{type.id}</p>
                      </div>
                    </div>

                    {type.fields.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">
                          Campos consolidados (primeros 5):
                        </p>
                        <div className="space-y-1">
                          {type.fields.slice(0, 5).map((field, idx) => (
                            <p key={idx} className="text-xs font-mono">
                              • {field.label} ({field.name})
                              {field.required && (
                                <span className="text-green-600 ml-1">[Req]</span>
                              )}
                            </p>
                          ))}
                          {type.fields.length > 5 && (
                            <p className="text-xs text-muted-foreground">
                              ... y {type.fields.length - 5} más
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ESTADO: ERROR */}
          {state === 'error' && (
            <div className="py-12 text-center">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-semibold mb-2">Error al procesar</h3>
              <p className="text-sm text-muted-foreground mb-6">{errorMessage}</p>
              <Button onClick={() => setState('upload')}>Reintentar</Button>
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          {state === 'upload' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleProcess}
                disabled={files.length < 2}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Analizar y Crear Tipos
              </Button>
            </>
          )}

          {state === 'success' && (
            <Button onClick={() => {
              onSuccess() // Recargar la lista de tipos de documento
              handleClose() // Cerrar el modal
            }}>
              Cerrar y Actualizar Lista
            </Button>
          )}

          {state === 'error' && (
            <Button variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

