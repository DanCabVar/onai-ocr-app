"use client"

import { useState } from "react"
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { documentsService } from "@/lib/api/documents.service"
import { cn } from "@/lib/utils"

interface UploadDocumentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadSuccess: () => void
}

type UploadStage = "idle" | "uploading" | "ocr" | "classification" | "extraction" | "success" | "error"

export default function UploadDocumentModal({ open, onOpenChange, onUploadSuccess }: UploadDocumentModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [stage, setStage] = useState<UploadStage>("idle")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [result, setResult] = useState<any>(null)
  const { toast } = useToast()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"]
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de archivo no válido",
          description: "Solo se permiten archivos PDF, PNG, JPG y WEBP",
          variant: "destructive",
        })
        return
      }

      // Validar tamaño (10MB)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        toast({
          title: "Archivo muy grande",
          description: "El tamaño máximo permitido es 10MB",
          variant: "destructive",
        })
        return
      }

      setSelectedFile(file)
      setStage("idle")
      setErrorMessage("")
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    try {
      setStage("uploading")
      setErrorMessage("")

      // Simular progreso de las etapas
      const stages: UploadStage[] = ["uploading", "ocr", "classification", "extraction"]
      let currentStageIndex = 0

      const progressInterval = setInterval(() => {
        currentStageIndex++
        if (currentStageIndex < stages.length) {
          setStage(stages[currentStageIndex])
        }
      }, 2000) // Cambiar etapa cada 2 segundos (simulación visual)

      // Hacer la subida real
      const response = await documentsService.upload(selectedFile)

      clearInterval(progressInterval)

      setStage("success")
      setResult(response)

      toast({
        title: "Documento procesado exitosamente",
        description: response.message,
      })

      // Emitir evento personalizado para que otras partes de la app lo escuchen
      window.dispatchEvent(new CustomEvent('documentUploaded', { detail: response }))

      // Esperar un poco antes de cerrar
      setTimeout(() => {
        onUploadSuccess()
        handleClose()
      }, 2000)
    } catch (error: any) {
      setStage("error")
      setErrorMessage(error.response?.data?.message || error.message || "Error al procesar el documento")
      toast({
        title: "Error al procesar documento",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setStage("idle")
    setErrorMessage("")
    setResult(null)
    onOpenChange(false)
  }

  const getStageInfo = (currentStage: UploadStage) => {
    const stages = {
      idle: { label: "Selecciona un archivo", icon: Upload, color: "text-muted-foreground" },
      uploading: { label: "Subiendo archivo...", icon: Loader2, color: "text-blue-500" },
      ocr: { label: "Extrayendo texto (OCR)...", icon: Loader2, color: "text-purple-500" },
      classification: { label: "Clasificando documento...", icon: Loader2, color: "text-orange-500" },
      extraction: { label: "Extrayendo datos...", icon: Loader2, color: "text-green-500" },
      success: { label: "¡Procesamiento completo!", icon: CheckCircle2, color: "text-green-600" },
      error: { label: "Error en el procesamiento", icon: AlertCircle, color: "text-red-600" },
    }
    return stages[currentStage]
  }

  const stageInfo = getStageInfo(stage)
  const Icon = stageInfo.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subir Documento</DialogTitle>
          <DialogDescription>
            El documento será procesado automáticamente con OCR, clasificación y extracción de datos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Input */}
          {stage === "idle" && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 hover:border-primary transition-colors">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center cursor-pointer"
              >
                <Upload className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Haz clic para seleccionar</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, WEBP (máx. 10MB)</p>
              </label>
            </div>
          )}

          {/* Selected File */}
          {selectedFile && stage === "idle" && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileText className="h-8 w-8 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Progress Indicator */}
          {stage !== "idle" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <Icon className={cn("h-6 w-6", stageInfo.color, stage !== "success" && stage !== "error" && "animate-spin")} />
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", stageInfo.color)}>{stageInfo.label}</p>
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground truncate">{selectedFile.name}</p>
                  )}
                </div>
              </div>

              {/* Progress Steps */}
              <div className="space-y-2">
                {["uploading", "ocr", "classification", "extraction"].map((step, index) => {
                  const stepStages: UploadStage[] = ["uploading", "ocr", "classification", "extraction"]
                  const currentIndex = stepStages.indexOf(stage as any)
                  const isCompleted = currentIndex > index || stage === "success"
                  const isCurrent = currentIndex === index
                  
                  return (
                    <div key={step} className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          isCompleted ? "bg-green-500" : isCurrent ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
                        )}
                      />
                      <p
                        className={cn(
                          "text-xs",
                          isCompleted ? "text-green-600" : isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                        )}
                      >
                        {step === "uploading" && "Subiendo archivo"}
                        {step === "ocr" && "Extracción de texto (OCR)"}
                        {step === "classification" && "Clasificación del documento"}
                        {step === "extraction" && "Extracción de datos"}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Error Message */}
              {stage === "error" && errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
                </div>
              )}

              {/* Success Details */}
              {stage === "success" && result && (
                <div className="space-y-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    {result.wasClassified ? "Clasificado correctamente" : "Guardado en carpeta 'Otros'"}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Confianza: {(result.document.confidenceScore * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={stage !== "idle" && stage !== "error" && stage !== "success"}>
              {stage === "success" ? "Cerrar" : "Cancelar"}
            </Button>
            {stage === "idle" && selectedFile && (
              <Button onClick={handleUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Subir y Procesar
              </Button>
            )}
            {stage === "error" && (
              <Button onClick={handleUpload}>
                Reintentar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

