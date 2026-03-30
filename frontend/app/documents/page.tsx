"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Download,
  RefreshCw,
  Trash2,
  Eye,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSearch,
  CalendarDays,
  Upload,
  Ban,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { documentsService, Document, DocumentField } from "@/lib/api/documents.service"
import { documentTypesService, DocumentType } from "@/lib/api/document-types.service"

const PAGE_SIZE = 10

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          Completo
        </span>
      )
    case "processing":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">
          <Clock className="h-3 w-3 animate-spin" />
          En proceso
        </span>
      )
    case "pending_confirmation":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-400/50">
          <AlertCircle className="h-3 w-3" />
          Pendiente
        </span>
      )
    case "queued":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
          <Clock className="h-3 w-3" />
          En cola
        </span>
      )
    case "error":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
          <AlertCircle className="h-3 w-3" />
          Error
        </span>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export default function DocumentsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [documents, setDocuments] = useState<Document[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [isUnauthenticated, setIsUnauthenticated] = useState(false)
  const [availableTypes, setAvailableTypes] = useState<{ id: number; name: string }[]>([])
  const [decisionDoc, setDecisionDoc] = useState<Document | null>(null)
  const [decisionAction, setDecisionAction] = useState<"confirm" | "assign_type" | "cancel">("confirm")
  const [decisionTypeId, setDecisionTypeId] = useState<number | undefined>()
  const [decisionTypeName, setDecisionTypeName] = useState("")
  const [submittingDecision, setSubmittingDecision] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setIsUnauthenticated(false)
      const [docs, types] = await Promise.all([
        documentsService.getAll(),
        documentTypesService.getAll(),
      ])
      setDocuments(docs)
      setDocumentTypes(types)
    } catch (error: any) {
      console.error("Error loading documents:", error)
      const status = error?.response?.status || error?.status
      if (status === 401 || status === 403) {
        setIsUnauthenticated(true)
        setDocuments([])
        setDocumentTypes([])
      } else {
        toast({
          title: "Error",
          description: "No se pudieron cargar los documentos",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()

    const handler = () => loadData()
    window.addEventListener("documentUploaded", handler)
    return () => window.removeEventListener("documentUploaded", handler)
  }, [loadData])

  // Auto-refresh polling when there are queued/processing docs
  useEffect(() => {
    const hasInProgress = documents.some(d => d.status === 'queued' || d.status === 'processing')
    if (!hasInProgress) return
    const interval = setInterval(() => loadData(), 5000)
    return () => clearInterval(interval)
  }, [documents, loadData])

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        if (statusFilter !== "all" && doc.status !== statusFilter) return false
        if (typeFilter !== "all" && String(doc.documentTypeId) !== typeFilter) return false
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          return (
            doc.filename.toLowerCase().includes(q) ||
            doc.documentTypeName?.toLowerCase().includes(q) ||
            doc.extractedData?.summary?.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [documents, searchQuery, statusFilter, typeFilter])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE))
  const paginatedDocs = filteredDocs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, statusFilter, typeFilter])

  // Stats
  const stats = useMemo(() => ({
    total: documents.length,
    completed: documents.filter((d) => d.status === "completed").length,
    processing: documents.filter((d) => d.status === "processing").length,
    error: documents.filter((d) => d.status === "error").length,
    pending: documents.filter((d) => d.status === "pending_confirmation").length,
  }), [documents])

  const openDetail = async (doc: Document) => {
    // Try to fetch full detail
    try {
      const fullDoc = await documentsService.getById(doc.id)
      setSelectedDoc(fullDoc)
    } catch {
      setSelectedDoc(doc)
    }
    setDetailOpen(true)
  }

  const handleDownload = (doc: Document) => {
    if (doc.googleDriveLink) {
      window.open(doc.googleDriveLink, "_blank")
    } else {
      toast({
        title: "Sin enlace",
        description: "Este documento no tiene enlace de descarga disponible",
        variant: "destructive",
      })
    }
  }

  const handleReprocess = async (doc: Document) => {
    setActionLoading(doc.id)
    try {
      const response = await documentsService.reprocess(doc.id)
      if ((response as any).pendingConfirmation) {
        // No match found — open decision dialog
        await loadData()
        toast({ title: "Sin coincidencia", description: "No se encontró tipo. Define cómo procesar el documento." })
        await openDecision({ ...doc, status: 'pending_confirmation' })
      } else {
        toast({ title: "Re-procesado", description: `"${doc.filename}" procesado correctamente.` })
        await loadData()
      }
    } catch (err: any) {
      toast({
        title: "Error al re-procesar",
        description: err?.response?.data?.message || err.message || "No se pudo re-procesar.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const openDecision = async (doc: Document) => {
    setDecisionDoc(doc)
    setDecisionAction("confirm")
    setDecisionTypeName(doc.inferredData?.inferred_type || "")
    setDecisionTypeId(undefined)
    // Cargar tipos disponibles
    try {
      const types = await documentTypesService.getAll()
      setAvailableTypes(types.map(t => ({ id: t.id, name: t.name })))
    } catch { setAvailableTypes([]) }
  }

  const handleDecisionSubmit = async () => {
    if (!decisionDoc) return
    setSubmittingDecision(true)
    try {
      const apiAction = decisionAction === "confirm" ? "create_type" : decisionAction === "assign_type" ? "assign_type" : "cancel"
      const response = await documentsService.confirmType(
        decisionDoc.id,
        apiAction as any,
        decisionAction === "confirm" ? decisionTypeName : undefined,
        decisionAction === "assign_type" ? decisionTypeId : undefined,
      )
      if (response.lowConfidence) {
        toast({ title: "Asignado con baja confianza", description: "El documento fue asignado pero no se encontraron campos coincidentes con el esquema." })
      } else {
        toast({ title: "Documento procesado", description: response.message })
      }
      setDecisionDoc(null)
      await loadData()
    } catch (err: any) {
      toast({ title: "Error", description: err?.response?.data?.message || err.message, variant: "destructive" })
    } finally {
      setSubmittingDecision(false)
    }
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm(`¿Eliminar "${doc.filename}"? Esta acción no se puede deshacer.`)) return
    setActionLoading(doc.id)
    try {
      await documentsService.delete(doc.id)
      toast({
        title: "Documento eliminado",
        description: `"${doc.filename}" fue eliminado correctamente.`,
      })
      await loadData()
      if (selectedDoc?.id === doc.id) setSelectedDoc(null)
    } catch (err: any) {
      toast({
        title: "Error al eliminar",
        description: err?.response?.data?.message || err.message || "No se pudo eliminar el documento.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const renderFieldValue = (field: DocumentField) => {
    if (field.value === null || field.value === undefined) {
      return <span className="text-muted-foreground italic">Sin valor</span>
    }
    if (typeof field.value === "boolean") {
      return field.value ? "Sí" : "No"
    }
    if (Array.isArray(field.value)) {
      return field.value.join(", ")
    }
    return String(field.value)
  }

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold font-primary tracking-tight">Documentos</h1>
            <p className="text-sm text-muted-foreground font-secondary mt-1">
              Gestiona y consulta todos los documentos procesados
            </p>
          </div>
          <Button
            className="rounded-full gap-2"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("openUploadModal"))
            }}
          >
            <Upload className="h-4 w-4" />
            Subir Documento
          </Button>
        </div>

        {/* Unauthenticated Banner */}
        {isUnauthenticated && (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="p-6 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm font-medium text-muted-foreground">
                Inicia sesión para ver tus documentos
              </p>
              <Button
                variant="outline"
                className="mt-3 rounded-full"
                onClick={() => router.push("/login")}
              >
                Iniciar Sesión
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Queue banner — visible when docs are being processed in background */}
        {documents.some(d => d.status === 'queued' || d.status === 'processing') && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {documents.filter(d => d.status === 'queued').length > 0 && `${documents.filter(d => d.status === 'queued').length} en cola`}
                {documents.filter(d => d.status === 'queued').length > 0 && documents.filter(d => d.status === 'processing').length > 0 && ' · '}
                {documents.filter(d => d.status === 'processing').length > 0 && `${documents.filter(d => d.status === 'processing').length} procesando`}
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-400">Actualizando automáticamente cada 5s...</p>
            </div>
            <Button variant="ghost" size="sm" onClick={loadData} className="text-blue-600 hover:text-blue-700 h-7 px-2">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

                {/* Mini Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
              statusFilter === "all" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            )}
          >
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-lg font-bold font-primary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
              statusFilter === "completed" ? "border-green-500 bg-green-500/5" : "hover:bg-muted/50"
            )}
          >
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-lg font-bold font-primary">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completados</p>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter("processing")}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
              statusFilter === "processing" ? "border-orange-500 bg-orange-500/5" : "hover:bg-muted/50"
            )}
          >
            <Clock className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-lg font-bold font-primary">{stats.processing}</p>
              <p className="text-xs text-muted-foreground">En proceso</p>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter("error")}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
              statusFilter === "error" ? "border-red-500 bg-red-500/5" : "hover:bg-muted/50"
            )}
          >
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-lg font-bold font-primary">{stats.error}</p>
              <p className="text-xs text-muted-foreground">Errores</p>
            </div>
          </button>
          {stats.pending > 0 && (
            <button
              onClick={() => setStatusFilter("pending_confirmation")}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ring-1 ring-amber-400/40",
                statusFilter === "pending_confirmation" ? "border-amber-500 bg-amber-500/10" : "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100/50"
              )}
            >
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-lg font-bold font-primary text-amber-600 dark:text-amber-400">{stats.pending}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pendientes</p>
              </div>
            </button>
          )}
        </div>

        {/* Filters */}
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, tipo o contenido..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Tipo de documento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {documentTypes.map((dt) => (
                    <SelectItem key={dt.id} value={String(dt.id)}>
                      {dt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(searchQuery || statusFilter !== "all" || typeFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("")
                    setStatusFilter("all")
                    setTypeFilter("all")
                  }}
                  className="gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpiar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileSearch className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No se encontraron documentos</p>
                <p className="text-sm mt-1">
                  {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                    ? "Intenta ajustar los filtros"
                    : "Sube tu primer documento para comenzar"}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="block sm:hidden divide-y">
                  {paginatedDocs.map((doc) => (
                    <div key={doc.id} className="p-4 space-y-3">
                      {/* Top row: filename + status */}
                      <div
                        className="flex items-start justify-between gap-2 cursor-pointer active:opacity-70"
                        onClick={() => openDetail(doc)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{doc.filename}</span>
                        </div>
                        {getStatusBadge(doc.status)}
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{doc.documentTypeName || "Sin tipo"}</span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Confidence bar */}
                      {doc.confidenceScore > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                doc.confidenceScore >= 0.8
                                  ? "bg-green-500"
                                  : doc.confidenceScore >= 0.5
                                    ? "bg-orange-500"
                                    : "bg-red-500"
                              )}
                              style={{ width: `${doc.confidenceScore * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {(doc.confidenceScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}

                      {/* Action buttons — always visible on mobile */}
                      <div className="flex items-center gap-1 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 gap-1.5 text-xs"
                          onClick={() => openDetail(doc)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 gap-1.5 text-xs"
                          onClick={(e) => { e.stopPropagation(); handleDownload(doc) }}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Descargar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); doc.status === "pending_confirmation" ? openDecision(doc) : handleReprocess(doc) }}
                          title={doc.status === "pending_confirmation" ? "Decidir qué hacer" : "Re-procesar"}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 flex-shrink-0 text-red-500 hover:text-red-600 hover:border-red-300"
                          onClick={(e) => { e.stopPropagation(); handleDelete(doc) }}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Archivo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Confianza</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right w-px whitespace-nowrap">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedDocs.map((doc) => (
                        <TableRow key={doc.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate max-w-[250px]">{doc.filename}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {doc.documentTypeName || (
                              <span className="italic">Sin tipo</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(doc.status)}</TableCell>
                          <TableCell>
                            {doc.confidenceScore > 0 ? (
                              <div className="flex items-center gap-2 min-w-[80px]">
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all",
                                      doc.confidenceScore >= 0.8
                                        ? "bg-green-500"
                                        : doc.confidenceScore >= 0.5
                                          ? "bg-orange-500"
                                          : "bg-red-500"
                                    )}
                                    style={{ width: `${doc.confidenceScore * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono text-muted-foreground">
                                  {(doc.confidenceScore * 100).toFixed(0)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-right w-px whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openDetail(doc)}
                                title="Ver detalle"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDownload(doc)}
                                title="Descargar"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleReprocess(doc)}
                                title="Re-procesar"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                onClick={() => handleDelete(doc)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      {filteredDocs.length} documento{filteredDocs.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm px-3">
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Document Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[95vw] max-w-2xl md:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-primary flex items-center gap-2">
              <FileText className="h-5 w-5 shrink-0" />
              <span className="truncate">{selectedDoc?.filename || "Documento"}</span>
            </DialogTitle>
            <DialogDescription>
              Detalle completo del documento procesado
            </DialogDescription>
            {selectedDoc && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('auth_token');
                      const res = await fetch(`/api/documents/${selectedDoc.id}/download-url`, {
                        headers: { Authorization: `Bearer ${token}` }
                      });
                      if (res.ok) {
                        const data = await res.json();
                        const downloadUrl = data.url || data.downloadUrl;
                        if (downloadUrl) window.open(downloadUrl, '_blank');
                      } else {
                        alert('No se pudo obtener el enlace de descarga');
                      }
                    } catch (e) {
                      alert('Error al descargar el documento');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Ver PDF Original
                </button>
              </div>
            )}
          </DialogHeader>

          {selectedDoc && (
            <ScrollArea className="flex-1 pr-2">
              <div className="md:grid md:grid-cols-[1fr_1fr] md:gap-6 space-y-6 md:space-y-0 pb-4">
              <div className="space-y-6">{/* col izq */}
                {/* Meta info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Estado</p>
                    {getStatusBadge(selectedDoc.status)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tipo</p>
                    <p className="text-sm font-medium break-words">{selectedDoc.documentTypeName || "Sin tipo"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Confianza</p>
                    <p className="text-sm font-medium font-mono">
                      {selectedDoc.confidenceScore > 0
                        ? `${(selectedDoc.confidenceScore * 100).toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Fecha</p>
                    <p className="text-sm font-medium">
                      {new Date(selectedDoc.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <Separator />
                {/* Summary */}
                {selectedDoc.extractedData?.summary && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Resumen</p>
                    <p className="text-sm leading-relaxed bg-muted/50 rounded-lg p-3 break-words">
                      {selectedDoc.extractedData.summary}
                    </p>
                  </div>
                )}

                {/* Extracted Fields */}
                {(selectedDoc.extractedData?.fields || selectedDoc.extractedData?.key_fields) && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Datos Extraídos</p>
                    <div className="rounded-lg border divide-y">
                      {(selectedDoc.extractedData.fields || selectedDoc.extractedData.key_fields || []).map(
                        (field: DocumentField, index: number) => (
                          <div key={index} className="flex flex-col sm:flex-row sm:items-start px-3 py-2 gap-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase w-full sm:w-2/5 shrink-0">
                              {field.label || field.name}{field.required && <span className="text-red-500 ml-1">*</span>}
                            </span>
                            <span className="text-sm break-words min-w-0">{renderFieldValue(field)}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Inferred Data — solo mostrar si NO hay extractedData (docs sin tipo procesado) */}
                {selectedDoc.inferredData && !selectedDoc.extractedData?.fields?.length && !selectedDoc.extractedData?.key_fields?.length && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Datos Inferidos (tipo: {selectedDoc.inferredData.inferred_type})
                    </p>
                    <p className="text-sm leading-relaxed bg-muted/50 rounded-lg p-3">
                      {selectedDoc.inferredData.summary}
                    </p>
                    {selectedDoc.inferredData.key_fields?.length > 0 && (
                      <div className="rounded-lg border divide-y">
                        {selectedDoc.inferredData.key_fields.map(
                          (field: DocumentField, index: number) => (
                            <div key={index} className="flex flex-col sm:flex-row sm:items-start px-3 py-2 gap-1">
                              <span className="text-xs font-semibold text-muted-foreground uppercase w-full sm:w-2/5 shrink-0">
                                {field.label || field.name}
                              </span>
                              <span className="text-sm break-words min-w-0">{renderFieldValue(field)}</span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                </div>{/* /col izq */}
                <div className="space-y-6">{/* col der */}
                {/* OCR Raw Text */}
                {selectedDoc.ocrRawText && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Texto OCR</p>
                    <pre className="text-xs bg-muted/50 rounded-lg p-3 whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto font-mono">
                      {selectedDoc.ocrRawText}
                    </pre>
                  </div>
                )}
                </div>{/* /col der */}
              </div>{/* /grid */}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {selectedDoc.googleDriveLink && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => window.open(selectedDoc.googleDriveLink, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver en Drive
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleDownload(selectedDoc)}
                  >
                    <Download className="h-4 w-4" />
                    Descargar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleReprocess(selectedDoc)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Re-procesar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red-500 hover:text-red-600"
                    onClick={() => {
                      handleDelete(selectedDoc)
                      setDetailOpen(false)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Decision Dialog — for pending_confirmation documents */}
      <Dialog open={!!decisionDoc} onOpenChange={(o) => { if (!o) setDecisionDoc(null) }}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-primary flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              ¿Qué hacer con este documento?
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-muted-foreground">
              {decisionDoc?.filename}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Opción 1: Crear nuevo tipo */}
            <button
              onClick={() => setDecisionAction("confirm")}
              className={cn(
                "flex items-start gap-3 px-4 py-3 rounded-lg border w-full text-left transition-colors",
                decisionAction === "confirm" ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
              )}
            >
              <CheckCircle2 className={cn("h-4 w-4 mt-0.5 shrink-0", decisionAction === "confirm" ? "text-primary" : "text-muted-foreground")} />
              <div>
                <p className="text-sm font-medium">Crear nuevo tipo de documento</p>
                <p className="text-xs text-muted-foreground">La IA definirá el esquema basándose en este documento</p>
                {decisionAction === "confirm" && (
                  <input
                    className="mt-2 w-full text-sm border rounded px-2 py-1 bg-background"
                    placeholder="Nombre del tipo (ej: Factura, Contrato...)"
                    value={decisionTypeName}
                    onChange={e => setDecisionTypeName(e.target.value)}
                  />
                )}
              </div>
            </button>

            {/* Opción 2: Asignar tipo existente */}
            <button
              onClick={() => setDecisionAction("assign_type")}
              className={cn(
                "flex items-start gap-3 px-4 py-3 rounded-lg border w-full text-left transition-colors",
                decisionAction === "assign_type" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "border-border hover:bg-accent"
              )}
            >
              <FileSearch className={cn("h-4 w-4 mt-0.5 shrink-0", decisionAction === "assign_type" ? "text-blue-500" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Extraer con tipo existente</p>
                <p className="text-xs text-muted-foreground">Elegir un esquema ya definido para extraer los campos</p>
                {decisionAction === "assign_type" && (
                  <select
                    className="mt-2 w-full text-sm border rounded px-2 py-1 bg-background"
                    value={decisionTypeId ?? ""}
                    onChange={e => setDecisionTypeId(Number(e.target.value))}
                  >
                    <option value="">— Selecciona un tipo —</option>
                    {availableTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </button>

            {/* Opción 3: Cancelar */}
            <button
              onClick={() => setDecisionAction("cancel")}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg border w-full text-left transition-colors",
                decisionAction === "cancel" ? "border-destructive bg-destructive/10" : "border-border hover:bg-accent"
              )}
            >
              <Ban className={cn("h-4 w-4 shrink-0", decisionAction === "cancel" ? "text-destructive" : "text-muted-foreground")} />
              <div>
                <p className="text-sm font-medium">Cancelar y eliminar</p>
                <p className="text-xs text-muted-foreground">Eliminar el documento sin procesar</p>
              </div>
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDecisionDoc(null)}>
              Volver
            </Button>
            <Button
              className="flex-1"
              onClick={handleDecisionSubmit}
              disabled={submittingDecision || (decisionAction === "assign_type" && !decisionTypeId)}
            >
              {submittingDecision ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {decisionAction === "cancel" ? "Eliminar documento" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
