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
import { documentTypesService } from "@/lib/api/document-types.service"
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
  const [pendingActions, setPendingActions] = useState<Record<number, { action: "confirm" | "assign_type" | "cancel"; typeName?: string; typeId?: number }>>({})
  const [confirmingAll, setConfirmingAll] = useState(false)
  const [availableTypes, setAvailableTypes] = useState<{ id: number; name: string }[]>([])
  const [completedResults, setCompletedResults] = useState<BatchDocumentResult[]>([])
  const [backgroundMode, setBackgroundMode] = useState(false)
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

    // Set all files to uploading state
    setFileItems(prev => prev.map(item => ({ ...item, status: "uploading" as FileItemStatus })))

    // Background / inbox mode
    if (backgroundMode) {
      try {
        const files = fileItems.map(item => item.file)
        const response = await documentsService.uploadToInbox(files, (percent) => setUploadPercent(percent))
        setFileItems(prev => prev.map(item => ({ ...item, status: "uploading" as FileItemStatus })))
        setStep("results")
        toast({ title: "En cola", description: `${files.length} archivo(s) en procesamiento. Revisa la sección Documentos.` })
        window.dispatchEvent(new CustomEvent("documentUploaded", { detail: response }))
      } catch (error: any) {
        setFileItems(prev => prev.map(item => ({ ...item, status: "error" as FileItemStatus, error: error.message })))
        setStep("results")
      }
      return
    }

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

      // Backend may respond with async mode { processing: true, documentIds: [] }
      // or sync mode { results: [...] }
      const isAsync = (response as any).processing === true || !Array.isArray((response as any).results)

      if (isAsync) {
        // Background processing — just acknowledge and close
        setFileItems(prev => prev.map(item => ({ ...item, status: "completed" as FileItemStatus })))
        setStep("results")
        toast({
          title: "Documentos recibidos",
          description: `${files.length} archivo(s) subidos. Se están procesando en segundo plano.`,
        })
        window.dispatchEvent(new CustomEvent("documentUploaded", { detail: response }))
        return
      }

      // Sync mode — handle results array
      const results: BatchDocumentResult[] = (response as any).results ?? []

      setFileItems(prev => prev.map((item, index) => {
        const result = results[index]
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

      setCompletedResults(results.filter(r => r.status === "completed"))

      // Check if there are pending confirmations
      const pending = results.filter(r => r.status === "pending_confirmation")
      if (pending.length > 0) {
        setPendingDocs(pending)
        const actions: Record<number, { action: "confirm" | "assign_type" | "cancel"; typeName?: string; typeId?: number }> = {}
        pending.forEach(doc => {
          if (doc.documentId) {
            actions[doc.documentId] = { action: "confirm", typeName: doc.suggestedType }
          }
        })
        setPendingActions(actions)
        // Cargar tipos disponibles para opción assign_type
        documentTypesService.getAll().then(types => {
          setAvailableTypes(types.map(t => ({ id: t.id, name: t.name })))
        }).catch(() => {})
        setStep("confirming")
      } else {
        setStep("results")
        toast({
          title: "Lote procesado",
          description: `${(response as any).totalSuccess ?? results.filter(r=>r.status==="completed").length} de ${(response as any).totalProcessed ?? results.length} archivos procesados exitosamente`,
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
          const apiAction = action.action === "confirm" ? "create_type" : action.action === "assign_type" ? "assign_type" : "cancel"
          const response = await documentsService.confirmType(
            doc.documentId,
            apiAction as any,
            action.action === "confirm" ? action.typeName : undefined,
            action.action === "assign_type" ? action.typeId : undefined,
          )
          results.push({
            ...doc,
            status: (action.action === "cancel") ? "error" : "completed",
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
                    Estos documentos no coinciden con ningún tipo existente. Elige qué hacer con cada uno.
                  </p>
                </div>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {pendingDocs.map((doc) => {
                  const docId = doc.documentId!
                  const action = pendingActions[docId]
                  const currentAction = action?.action ?? "confirm"

                  return (
                    <div key={docId} className="border rounded-lg p-3 space-y-2 bg-card">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm font-medium truncate flex-1">{doc.filename}</p>
                        {doc.suggestedType && (
                          <span className="text-xs text-muted-foreground">IA sugiere: <span className="font-semibold text-primary">{doc.suggestedType}</span></span>
                        )}
                      </div>

                      {/* 3 opciones */}
                      <div className="flex flex-col gap-1.5">
                        {/* Opción 1: Crear nuevo tipo */}
                        <div className={cn(
                          "border rounded-md transition-colors",
                          currentAction === "confirm" ? "border-primary bg-primary/10" : "border-border"
                        )}>
                          <button
                            onClick={() => setPendingActions(prev => ({ ...prev, [docId]: { ...prev[docId], action: "confirm" } }))}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-left w-full"
                          >
                            <CheckCircle2 className={cn("h-3.5 w-3.5 flex-shrink-0", currentAction === "confirm" ? "text-primary" : "text-muted-foreground")} />
                            <span className={cn("font-medium", currentAction === "confirm" && "text-primary")}>
                              Crear nuevo tipo con IA
                            </span>
                          </button>
                          {currentAction === "confirm" && (
                            <div className="px-3 pb-2 space-y-1.5">
                              <p className="text-xs text-muted-foreground">Nombre del tipo:</p>
                              <input
                                className="w-full text-xs border rounded px-2 py-1.5 bg-background"
                                placeholder="ej: Factura, Contrato, Boleta..."
                                value={action?.typeName || doc.suggestedType || ""}
                                onChange={e => setPendingActions(prev => ({
                                  ...prev,
                                  [docId]: { ...prev[docId], action: "confirm", typeName: e.target.value }
                                }))}
                              />
                              <p className="text-xs text-muted-foreground/70">La IA inferirá los campos desde el documento</p>
                            </div>
                          )}
                        </div>

                        {/* Opción 2: Extraer con tipo existente */}
                        <div className={cn(
                          "border rounded-md transition-colors",
                          currentAction === "assign_type" ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20" : "border-border"
                        )}>
                          <button
                            onClick={() => setPendingActions(prev => ({ ...prev, [docId]: { ...prev[docId], action: "assign_type" } }))}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-left w-full"
                          >
                            <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                            <span className={cn(currentAction === "assign_type" && "font-medium text-blue-700 dark:text-blue-400")}>
                              Extraer con tipo existente
                            </span>
                          </button>
                          {currentAction === "assign_type" && (
                            <div className="px-3 pb-2">
                              <select
                                className="w-full text-xs border rounded px-2 py-1 bg-background"
                                value={action?.typeId ?? ""}
                                onChange={e => setPendingActions(prev => ({
                                  ...prev,
                                  [docId]: { ...prev[docId], action: "assign_type", typeId: Number(e.target.value) }
                                }))}
                              >
                                <option value="">— Selecciona un tipo —</option>
                                {availableTypes.map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Opción 3: Cancelar */}
                        <button
                          onClick={() => setPendingActions(prev => ({ ...prev, [docId]: { ...prev[docId], action: "cancel" } }))}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left border transition-colors",
                            currentAction === "cancel"
                              ? "border-destructive bg-destructive/10 text-destructive font-medium"
                              : "border-border hover:bg-accent"
                          )}
                        >
                          <Ban className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>Cancelar — eliminar documento</span>
                        </button>
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
        <div className="flex flex-col gap-2 pt-4 border-t border-border">
          {step === "select" && (
            <div className="flex flex-col gap-3 w-full">
              {/* Checkbox izquierda — solo con archivos */}
              {fileItems.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none w-fit">
                  <input
                    type="checkbox"
                    checked={backgroundMode}
                    onChange={e => setBackgroundMode(e.target.checked)}
                    className="rounded"
                  />
                  <span>Procesar en segundo plano</span>
                </label>
              )}
              {/* Botones full width */}
              <div className="flex gap-2 w-full">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancelar
                </Button>
                {fileItems.length > 0 && (
                  <Button onClick={handleUpload} className="flex-1 gap-2">
                    <Upload className="h-4 w-4" />
                    {backgroundMode ? "Subir a cola" : "Subir y Procesar"} ({fileItems.length})
                  </Button>
                )}
              </div>
            </div>
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
