"use client"

import { useState, useCallback, useRef } from "react"
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X, FileUp, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { documentsService } from "@/lib/api/documents.service"
import { cn } from "@/lib/utils"

interface UploadDocumentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadSuccess: () => void
}

type UploadStage = "idle" | "uploading" | "ocr" | "classification" | "extraction" | "success" | "error"

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const STAGE_CONFIG: Record<UploadStage, { label: string; progress: number; color: string }> = {
  idle: { label: "Selecciona un archivo", progress: 0, color: "text-muted-foreground" },
  uploading: { label: "Subiendo archivo...", progress: 15, color: "text-blue-500" },
  ocr: { label: "Extrayendo texto (OCR)...", progress: 40, color: "text-purple-500" },
  classification: { label: "Clasificando documento...", progress: 65, color: "text-orange-500" },
  extraction: { label: "Extrayendo datos...", progress: 85, color: "text-green-500" },
  success: { label: "¡Procesamiento completo!", progress: 100, color: "text-green-600" },
  error: { label: "Error en el procesamiento", progress: 0, color: "text-red-600" },
}

const STEPS: { key: UploadStage; label: string }[] = [
  { key: "uploading", label: "Subiendo archivo" },
  { key: "ocr", label: "Extracción de texto (OCR)" },
  { key: "classification", label: "Clasificación del documento" },
  { key: "extraction", label: "Extracción de datos" },
]

export default function UploadDocumentModal({ open, onOpenChange, onUploadSuccess }: UploadDocumentModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [stage, setStage] = useState<UploadStage>("idle")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [result, setResult] = useState<any>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const validateFile = useCallback((file: File): boolean => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Tipo de archivo no válido",
        description: "Solo se permiten archivos PDF, PNG, JPG y WEBP",
        variant: "destructive",
      })
      return false
    }
    if (file.size > MAX_SIZE) {
      toast({
        title: "Archivo muy grande",
        description: "El tamaño máximo permitido es 10MB",
        variant: "destructive",
      })
      return false
    }
    return true
  }, [toast])

  const selectFile = useCallback((file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file)
      setStage("idle")
      setErrorMessage("")
      setResult(null)
    }
  }, [validateFile])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) selectFile(file)
  }

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) selectFile(file)
  }, [selectFile])

  const handleUpload = async () => {
    if (!selectedFile) return

    try {
      setStage("uploading")
      setErrorMessage("")
      setUploadPercent(0)

      // Track real upload progress; once the file is fully sent we
      // simulate the server-side processing stages.
      const response = await documentsService.upload(selectedFile, (percent) => {
        setUploadPercent(percent)
      })

      // File fully uploaded — run through processing stages quickly
      // to give visual feedback (server already processed everything).
      const processingStages: UploadStage[] = ["ocr", "classification", "extraction"]
      for (const s of processingStages) {
        setStage(s)
        await new Promise((r) => setTimeout(r, 600))
      }

      setStage("success")
      setResult(response)

      toast({
        title: "Documento procesado exitosamente",
        description: response.message,
      })

      window.dispatchEvent(new CustomEvent('documentUploaded', { detail: response }))

      setTimeout(() => {
        onUploadSuccess()
        handleClose()
      }, 2500)
    } catch (error: any) {
      setStage("error")
      const msg = error.response?.data?.message || error.message || "Error al procesar el documento"
      setErrorMessage(msg)
      toast({
        title: "Error al procesar documento",
        description: msg,
        variant: "destructive",
      })
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setStage("idle")
    setErrorMessage("")
    setResult(null)
    setIsDragOver(false)
    setUploadPercent(0)
    onOpenChange(false)
  }

  const stageConfig = STAGE_CONFIG[stage]
  const isProcessing = !["idle", "success", "error"].includes(stage)
  const stageIndex = STEPS.findIndex((s) => s.key === stage)

  const getFileIcon = () => {
    if (!selectedFile) return <FileUp className="h-10 w-10" />
    if (selectedFile.type === "application/pdf") return <FileText className="h-10 w-10" />
    return <ImageIcon className="h-10 w-10" />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-primary">Subir Documento</DialogTitle>
          <DialogDescription>
            Arrastra un archivo o haz clic para seleccionar. Se procesará con OCR, clasificación y extracción.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drag & Drop Zone */}
          {stage === "idle" && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200",
                isDragOver
                  ? "border-primary bg-primary/5 scale-[1.02] shadow-lg shadow-primary/10"
                  : selectedFile
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
              />

              {isDragOver ? (
                <>
                  <div className="rounded-full bg-primary/10 p-4 mb-3 animate-pulse">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-primary">Suelta el archivo aquí</p>
                </>
              ) : selectedFile ? (
                <>
                  <div className="rounded-full bg-green-500/10 p-4 mb-3">
                    {getFileIcon()}
                  </div>
                  <p className="text-sm font-medium truncate max-w-[280px]">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Clic para cambiar
                  </p>
                </>
              ) : (
                <>
                  <div className="rounded-full bg-muted p-4 mb-3">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Arrastra aquí o haz clic</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, WEBP (máx. 10MB)</p>
                </>
              )}
            </div>
          )}

          {/* Processing Progress */}
          {stage !== "idle" && (
            <div className="space-y-4">
              {/* Overall Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className={cn("text-sm font-medium", stageConfig.color)}>{stageConfig.label}</p>
                  {isProcessing && (
                    <span className="text-xs text-muted-foreground">
                      {stage === "uploading" ? `${uploadPercent}%` : `${stageConfig.progress}%`}
                    </span>
                  )}
                </div>
                <Progress
                  value={stage === "uploading" ? Math.max(uploadPercent * 0.25, 2) : stageConfig.progress}
                  className={cn("h-2 transition-all duration-500", stage === "error" && "[&>div]:bg-red-500")}
                />
              </div>

              {/* File info */}
              {selectedFile && (
                <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">{selectedFile.name}</p>
                </div>
              )}

              {/* Step indicators */}
              <div className="space-y-2.5">
                {STEPS.map((step, index) => {
                  const isCompleted = stageIndex > index || stage === "success"
                  const isCurrent = stageIndex === index && isProcessing

                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300",
                          isCompleted
                            ? "bg-green-500 text-white"
                            : isCurrent
                              ? "bg-primary/20 border-2 border-primary"
                              : "bg-muted"
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : isCurrent ? (
                          <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-medium">{index + 1}</span>
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-sm transition-colors",
                          isCompleted ? "text-green-600 dark:text-green-400 font-medium" :
                            isCurrent ? "text-foreground font-medium" :
                              "text-muted-foreground"
                        )}
                      >
                        {step.label}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Error Message */}
              {stage === "error" && errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Success Result */}
              {stage === "success" && result && (
                <div className="space-y-2 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                      {result.wasClassified ? "Clasificado correctamente" : "Guardado en carpeta 'Otros'"}
                    </p>
                  </div>
                  {result.document?.confidenceScore !== undefined && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-green-600 dark:text-green-400">Confianza:</span>
                      <div className="flex-1">
                        <Progress value={result.document.confidenceScore * 100} className="h-1.5 [&>div]:bg-green-500" />
                      </div>
                      <span className="text-xs font-mono text-green-600 dark:text-green-400">
                        {(result.document.confidenceScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isProcessing}
            >
              {stage === "success" ? "Cerrar" : "Cancelar"}
            </Button>
            {stage === "idle" && selectedFile && (
              <Button onClick={handleUpload} className="gap-2">
                <Upload className="h-4 w-4" />
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
