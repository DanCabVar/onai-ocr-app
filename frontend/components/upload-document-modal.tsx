"use client"

import { useState, useCallback, useRef } from "react"
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle, X, FileUp,
  Image as ImageIcon, Clock, Ban, CheckCheck, ArrowRight
} from "lucide-react"
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
import { documentsService, BatchDocumentResult } from "@/lib/api/documents.service"
import { cn } from "@/lib/utils"

interface UploadDocumentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadSuccess: () => void
}

type ModalStep = "select" | "uploading" | "confirming" | "results"

type FileItemStatus = "queued" | "uploading" | "ocr" | "classifying" | "completed" | "pending_confirmation" | "error"

interface FileItem {
  file: File
  id: string
  status: FileItemStatus
  error?: string
  result?: BatchDocumentResult
}

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

const STATUS_CONFIG: Record<FileItemStatus, { icon: string; label: string; color: string }> = {
  queued: { icon: "⏳", label: "En cola", color: "text-muted-foreground" },
  uploading: { icon: "🔄", label: "Subiendo...", color: "text-blue-500" },
  ocr: { icon: "🔄", label: "Procesando OCR...", color: "text-purple-500" },
  classifying: { icon: "🔄", label: "Clasificando...", color: "text-orange-500" },
  completed: { icon: "✅", label: "Completado", color: "text-green-600" },
  pending_confirmation: { icon: "⚠️", label: "Requiere confirmación", color: "text-yellow-600" },
  error: { icon: "❌", label: "Error", color: "text-red-600" },
}

export default function UploadDocumentModal({ open, onOpenChange, onUploadSuccess }: UploadDocumentModalProps) {
  const [step, setStep] = useState<ModalStep>("select")
  const [fileItems, setFileItems] = useState<FileItem[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [pendingDocs, setPendingDocs] = useState<BatchDocumentResult[]>([])
  const [pendingActions, setPendingActions] = useState<Record<number, { action: "confirm" | "cancel"; typeName?: string }>>({})
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [completedResults, setCompletedResults] = useState<BatchDocumentResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const validateFile = useCallback((file: File): boolean => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Tipo de archivo no válido",
        description: `${file.name}: Solo PDF, PNG, JPG y WEBP`,
        variant: "destructive",
      })
      return false
    }
    if (file.size > MAX_SIZE) {
      toast({
        title: "Archivo muy grande",
        description: `${file.name}: Máximo 10MB`,
        variant: "destructive",
      })
      return false
    }
    return true
  }, [toast])

  const addFiles = useCallback((files: File[]) => {
    const validFiles = files.filter(f => validateFile(f))
    if (validFiles.length === 0) return

    setFileItems(prev => {
      const newItems: FileItem[] = validFiles.map(file => ({
        file,
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        status: "queued" as FileItemStatus,
      }))
      return [...prev, ...newItems]
    })
  }, [validateFile])

  const removeFile = useCallback((id: string) => {
    setFileItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      addFiles(Array.from(files))
    }
    // Reset so same files can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

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
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      addFiles(Array.from(files))
    }
  }, [addFiles])

  const handleUpload = async () => {
    if (fileItems.length === 0) return

    setStep("uploading")

    // Set all files to uploading state initially
    setFileItems(prev => prev.map(item => ({ ...item, status: "uploading" as FileItemStatus })))

    try {
      const files = fileItems.map(item => item.file)

      // Simulate individual file status progression
      const simulateProgress = () => {
        let currentIndex = 0
        const interval = setInterval(() => {
          setFileItems(prev => {
            const updated = [...prev]
            // Progress simulation: cycle through states
            if (currentIndex < updated.length) {
              const stages: FileItemStatus[] = ["ocr", "classifying"]
              const stageIndex = Math.floor((Date.now() / 1500) % stages.length)
              updated[currentIndex] = { ...updated[currentIndex], status: stages[stageIndex] }
              if (stageIndex === stages.length - 1 && currentIndex < updated.length - 1) {
                currentIndex++
              }
            }
            return updated
          })
        }, 1500)
        return interval
      }

      const progressInterval = simulateProgress()

      const response = await documentsService.uploadBatch(files, (percent) => {
        setUploadPercent(percent)
      })

      clearInterval(progressInterval)

      // Update file items with actual results
      setFileItems(prev => prev.map((item, index) => {
        const result = response.results[index]
        if (!result) return { ...item, status: "error" as FileItemStatus, error: "Sin resultado" }
        return {
          ...item,
          status: result.status === "completed" ? "completed" as FileItemStatus
            : result.status === "pending_confirmation" ? "pending_confirmation" as FileItemStatus
            : "error" as FileItemStatus,
          error: result.error,
          result,
        }
      }))

      setCompletedResults(response.results.filter(r => r.status === "completed"))

      // Check if there are pending confirmations
      const pending = response.results.filter(r => r.status === "pending_confirmation")
      if (pending.length > 0) {
        setPendingDocs(pending)
        // Initialize actions as "confirm" for all
        const actions: Record<number, { action: "confirm" | "cancel"; typeName?: string }> = {}
        pending.forEach(doc => {
          if (doc.documentId) {
            actions[doc.documentId] = { action: "confirm", typeName: doc.suggestedType }
          }
        })
        setPendingActions(actions)
        setStep("confirming")
      } else {
        setStep("results")
        toast({
          title: "Lote procesado",
          description: `${response.totalSuccess} de ${response.totalProcessed} archivos procesados exitosamente`,
        })
        window.dispatchEvent(new CustomEvent("documentUploaded", { detail: response }))
      }
    } catch (error: any) {
      setFileItems(prev => prev.map(item => ({
        ...item,
        status: "error" as FileItemStatus,
        error: error.response?.data?.message || error.message || "Error al procesar",
      })))
      setStep("results")
      toast({
        title: "Error al procesar lote",
        description: error.response?.data?.message || error.message,
        variant: "destructive",
      })
    }
  }

  const togglePendingAction = (documentId: number) => {
    setPendingActions(prev => ({
      ...prev,
      [documentId]: {
        ...prev[documentId],
        action: prev[documentId].action === "confirm" ? "cancel" : "confirm",
      },
    }))
  }

  const handleConfirmAll = async () => {
    setConfirmingAll(true)
    try {
      const results: BatchDocumentResult[] = [...completedResults]

      for (const doc of pendingDocs) {
        if (!doc.documentId) continue
        const action = pendingActions[doc.documentId]
        if (!action) continue

        try {
          const response = await documentsService.confirmType(
            doc.documentId,
            action.action,
            action.action === "confirm" ? action.typeName : undefined,
          )
          results.push({
            ...doc,
            status: action.action === "confirm" ? "completed" : "error",
            error: action.action === "cancel" ? "Cancelado por el usuario" : undefined,
          })
        } catch (err: any) {
          results.push({
            ...doc,
            status: "error",
            error: err.response?.data?.message || err.message || "Error al confirmar",
          })
        }
      }

      // Update file items with confirmation results
      setFileItems(prev => prev.map(item => {
        const result = results.find(r => r.filename === item.file.name)
        if (!result) return item
        return {
          ...item,
          status: result.status === "completed" ? "completed" as FileItemStatus : "error" as FileItemStatus,
          error: result.error,
          result,
        }
      }))

      setStep("results")
      toast({
        title: "Confirmaciones procesadas",
        description: "Tipos de documento actualizados",
      })
      window.dispatchEvent(new CustomEvent("documentUploaded"))
    } catch (error: any) {
      toast({
        title: "Error al confirmar tipos",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setConfirmingAll(false)
    }
  }

  const handleClose = () => {
    if (step === "results" || step === "select") {
      setStep("select")
      setFileItems([])
      setUploadPercent(0)
      setPendingDocs([])
      setPendingActions({})
      setCompletedResults([])
      setConfirmingAll(false)
      setIsDragOver(false)
      onOpenChange(false)
    }
  }

  const isProcessing = step === "uploading"
  const completedCount = fileItems.filter(i => i.status === "completed").length
  const errorCount = fileItems.filter(i => i.status === "error").length
  const pendingCount = fileItems.filter(i => i.status === "pending_confirmation").length
  const totalCount = fileItems.length

  const globalProgress = totalCount > 0
    ? Math.round(((completedCount + errorCount + pendingCount) / totalCount) * 100)
    : 0

  const getFileIcon = (file: File) => {
    if (file.type === "application/pdf") return <FileText className="h-4 w-4" />
    return <ImageIcon className="h-4 w-4" />
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-primary">
            {step === "select" && "Subir Documentos"}
            {step === "uploading" && "Procesando Lote..."}
            {step === "confirming" && "Confirmar Tipos de Documento"}
            {step === "results" && "Resultado del Procesamiento"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Arrastra archivos o haz clic para seleccionar. Se procesarán con OCR, clasificación y extracción."}
            {step === "uploading" && `Procesando ${totalCount} archivo(s)...`}
            {step === "confirming" && "Algunos documentos no coinciden con tipos existentes. Confirma o cancela cada uno."}
            {step === "results" && `${completedCount} completado(s), ${errorCount} error(es) de ${totalCount} archivo(s).`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* === STEP: SELECT FILES === */}
          {step === "select" && (
            <>
              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200",
                  isDragOver
                    ? "border-primary bg-primary/5 scale-[1.02] shadow-lg shadow-primary/10"
                    : fileItems.length > 0
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileSelect}
                />

                {isDragOver ? (
                  <>
                    <div className="rounded-full bg-primary/10 p-4 mb-3 animate-pulse">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-primary">Suelta los archivos aquí</p>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-muted p-4 mb-3">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">
                      {fileItems.length > 0 ? "Agregar más archivos" : "Arrastra aquí o haz clic"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG, WEBP (máx. 10MB c/u)</p>
                  </>
                )}
              </div>

              {/* File List */}
              {fileItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">
                      Archivos seleccionados ({fileItems.length})
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setFileItems([])}>
                      Limpiar todo
                    </Button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {fileItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-muted/20"
                      >
                        {getFileIcon(item.file)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(item.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFile(item.id)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* === STEP: UPLOADING === */}
          {step === "uploading" && (
            <div className="space-y-4">
              {/* Global Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-primary">
                    Procesando lote ({completedCount + errorCount + pendingCount} de {totalCount})
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {uploadPercent < 100 ? `Subiendo: ${uploadPercent}%` : `${globalProgress}%`}
                  </span>
                </div>
                <Progress
                  value={uploadPercent < 100 ? uploadPercent * 0.3 : Math.max(globalProgress, 30)}
                  className="h-2 transition-all duration-500"
                />
              </div>

              {/* Per-file status list */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {fileItems.map((item) => {
                  const config = STATUS_CONFIG[item.status]
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-muted/20"
                    >
                      <span className="text-sm flex-shrink-0">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.file.name}</p>
                        <p className={cn("text-xs", config.color)}>{config.label}</p>
                      </div>
                      {(item.status === "uploading" || item.status === "ocr" || item.status === "classifying") && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                      )}
                      {item.status === "completed" && (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                      {item.status === "error" && (
                        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* === STEP: CONFIRMING NEW TYPES === */}
          {step === "confirming" && (
            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Estos documentos no coinciden con tipos existentes. La IA sugirió un tipo para cada uno.
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pendingDocs.map((doc) => {
                  const docId = doc.documentId!
                  const action = pendingActions[docId]
                  const isConfirm = action?.action === "confirm"

                  return (
                    <div
                      key={docId}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors",
                        isConfirm
                          ? "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
                          : "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
                      )}
                    >
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          Tipo sugerido: <span className="font-semibold text-primary">{doc.suggestedType}</span>
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant={isConfirm ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            if (!isConfirm) togglePendingAction(docId)
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Crear
                        </Button>
                        <Button
                          variant={!isConfirm ? "destructive" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            if (isConfirm) togglePendingAction(docId)
                          }}
                        >
                          <Ban className="h-3 w-3 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Already completed count */}
              {completedResults.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  ✅ {completedResults.length} archivo(s) ya fueron procesados correctamente.
                </p>
              )}
            </div>
          )}

          {/* === STEP: RESULTS === */}
          {step === "results" && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">{completedCount}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Completados</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-red-700 dark:text-red-400">{errorCount}</p>
                  <p className="text-xs text-red-600 dark:text-red-500">Errores</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-center">
                  <FileText className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{totalCount}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-500">Total</p>
                </div>
              </div>

              {/* Per-file results */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {fileItems.map((item) => {
                  const config = STATUS_CONFIG[item.status]
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-muted/20"
                    >
                      <span className="text-sm flex-shrink-0">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.file.name}</p>
                        {item.error && (
                          <p className="text-xs text-red-500 truncate">{item.error}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          {step === "select" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              {fileItems.length > 0 && (
                <Button onClick={handleUpload} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Subir y Procesar ({fileItems.length} archivo{fileItems.length > 1 ? "s" : ""})
                </Button>
              )}
            </>
          )}
          {step === "uploading" && (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Procesando...
            </Button>
          )}
          {step === "confirming" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  // Skip confirmations, go to results
                  setStep("results")
                  window.dispatchEvent(new CustomEvent("documentUploaded"))
                }}
              >
                Omitir
              </Button>
              <Button
                onClick={handleConfirmAll}
                disabled={confirmingAll}
                className="gap-2"
              >
                {confirmingAll ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                Confirmar Selección
              </Button>
            </>
          )}
          {step === "results" && (
            <Button onClick={() => {
              onUploadSuccess()
              handleClose()
            }}>
              Cerrar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
