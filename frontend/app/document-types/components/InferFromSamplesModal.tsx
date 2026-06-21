"use client"

import { useState, useCallback } from 'react'
import { X, Upload, FileText, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { documentTypeInferenceService } from '@/app/services/document-type-inference.service'

interface InferFromSamplesModalProps {
  isOpen: boolean
  onClose: () => void
  onJobStarted: (jobId: string, fileCount: number) => void
}

export function InferFromSamplesModal({
  isOpen,
  onClose,
  onJobStarted,
}: InferFromSamplesModalProps) {
  const { toast } = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadSamples, setUploadSamples] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetModal = useCallback(() => {
    setFiles([])
    setIsDragging(false)
    setUploadSamples(true)
    setIsSubmitting(false)
  }, [])

  const handleClose = useCallback(() => {
    if (isSubmitting) {
      return
    }
    resetModal()
    onClose()
  }, [isSubmitting, onClose, resetModal])

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

  const addFiles = useCallback((newFiles: File[]) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
    const maxSize = 10 * 1024 * 1024

    const validFiles = newFiles.filter((file) => {
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

    setFiles((prev) => {
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
  }, [toast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleProcess = async () => {
    if (files.length < 2) {
      toast({
        title: 'Archivos insuficientes',
        description: 'Se requieren al menos 2 documentos',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSubmitting(true)
      const job = await documentTypeInferenceService.startInferenceJob(files, uploadSamples)

      toast({
        title: 'Análisis iniciado',
        description: `Se enviaron ${files.length} documento(s) para inferencia`,
      })

      onJobStarted(job.jobId, files.length)
      resetModal()
      onClose()
    } catch (error: any) {
      toast({
        title: 'Error al iniciar análisis',
        description: error?.message || 'No fue posible iniciar la inferencia',
        variant: 'destructive',
      })
      setIsSubmitting(false)
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

        <div className="flex-1 overflow-y-auto space-y-6">
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
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                Seleccionar archivos
              </Button>
            </div>
          </div>

          {files.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">
                  Documentos seleccionados ({files.length}/10)
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => setFiles([])}
                >
                  Limpiar todo
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
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
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {files.length > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/20">
              <input
                type="checkbox"
                id="upload-samples"
                checked={uploadSamples}
                disabled={isSubmitting}
                onChange={(e) => setUploadSamples(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="upload-samples" className="text-sm cursor-pointer">
                <p className="font-medium mb-1">Guardar documentos en el sistema</p>
                <p className="text-xs text-muted-foreground">
                  Los documentos se procesarán como documentos reales y estarán disponibles en el sistema
                </p>
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="outline" disabled={isSubmitting} onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleProcess}
            disabled={files.length < 2 || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {isSubmitting ? 'Iniciando...' : 'Analizar y Crear Tipos'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
