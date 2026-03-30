"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  HardDrive,
  Search,
  Upload,
  Download,
  Trash2,
  Eye,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  Loader2,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  LayoutGrid,
  List,
  ArrowUpDown,
  Database,
  Files,
  Shield,
  LogIn,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api/client"
import { documentsService, Document, DocumentField } from "@/lib/api/documents.service"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function estimateFileSize(filename: string): number {
  // Rough estimate based on file type – real size not in entity
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return 1.2 * 1024 * 1024 // ~1.2 MB avg
  if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) return 800 * 1024
  if (["xlsx", "csv"].includes(ext || "")) return 200 * 1024
  return 500 * 1024
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return <FileText className="h-5 w-5 text-red-500" />
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext || ""))
    return <ImageIcon className="h-5 w-5 text-blue-500" />
  if (["xlsx", "xls", "csv"].includes(ext || ""))
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />
  return <File className="h-5 w-5 text-muted-foreground" />
}

function getFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  const map: Record<string, string> = {
    pdf: "PDF",
    png: "Imagen PNG",
    jpg: "Imagen JPG",
    jpeg: "Imagen JPEG",
    webp: "Imagen WebP",
    gif: "GIF",
    xlsx: "Excel",
    xls: "Excel",
    csv: "CSV",
    doc: "Word",
    docx: "Word",
    txt: "Texto",
  }
  return map[ext || ""] || ext?.toUpperCase() || "Archivo"
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Procesado
        </Badge>
      )
    case "processing":
      return (
        <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-0 gap-1">
          <Clock className="h-3 w-3 animate-spin" />
          Pendiente
        </Badge>
      )
    case "error":
      return (
        <Badge variant="secondary" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-0 gap-1">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface StorageStats {
  totalFiles: number
  totalSizeEstimate: number
  planLimit: number // bytes
  planName: string
}

type ViewMode = "grid" | "list"
type SortField = "name" | "date" | "size" | "status"

// ─── Component ──────────────────────────────────────────────────────────────

export default function StoragePage() {
  const router = useRouter()
  const { toast } = useToast()

  // State
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUnauthenticated, setIsUnauthenticated] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [sortField, setSortField] = useState<SortField>("date")

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Detail dialog
  const [detailDoc, setDetailDoc] = useState<Document | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Download loading
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  // ─── Data Loading ───────────────────────────────────────────────────────

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      setIsUnauthenticated(false)
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
      if (!token) {
        setIsUnauthenticated(true)
        setDocuments([])
        return
      }
      const docs = await documentsService.getAll()
      setDocuments(docs)
    } catch (error: any) {
      const status = error?.response?.status || error?.status
      if (status === 401 || status === 403) {
        setIsUnauthenticated(true)
        setDocuments([])
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
    loadDocuments()
    const handler = () => loadDocuments()
    window.addEventListener("documentUploaded", handler)
    return () => window.removeEventListener("documentUploaded", handler)
  }, [loadDocuments])

  // ─── Storage Stats ──────────────────────────────────────────────────────

  const stats: StorageStats = useMemo(() => {
    const totalSizeEstimate = documents.reduce(
      (acc, doc) => acc + estimateFileSize(doc.filename),
      0
    )
    return {
      totalFiles: documents.length,
      totalSizeEstimate,
      planLimit: 5 * 1024 * 1024 * 1024, // 5 GB default
      planName: "Plan Estándar",
    }
  }, [documents])

  const usagePercent = Math.min(
    (stats.totalSizeEstimate / stats.planLimit) * 100,
    100
  )

  // ─── Filtering & Sorting ───────────────────────────────────────────────

  const filteredDocs = useMemo(() => {
    let result = [...documents]

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter)
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (d) =>
          d.filename.toLowerCase().includes(q) ||
          d.documentTypeName?.toLowerCase().includes(q)
      )
    }

    // Sort
    result.sort((a, b) => {
      switch (sortField) {
        case "name":
          return a.filename.localeCompare(b.filename)
        case "date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case "size":
          return estimateFileSize(b.filename) - estimateFileSize(a.filename)
        case "status":
          return a.status.localeCompare(b.status)
        default:
          return 0
      }
    })

    return result
  }, [documents, statusFilter, searchQuery, sortField])

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleDownload = async (doc: Document) => {
    try {
      setDownloadingId(doc.id)
      const response = await apiClient.get(`/documents/${doc.id}/download-url`)
      const url = response.data?.url
      if (url) {
        window.open(url, "_blank")
      } else {
        toast({
          title: "Sin enlace",
          description: "No se pudo obtener la URL de descarga",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al obtener la URL de descarga",
        variant: "destructive",
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setIsDeleting(true)
      await apiClient.delete(`/documents/${deleteTarget.id}`)
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id))
      toast({
        title: "Eliminado",
        description: `"${deleteTarget.filename}" fue eliminado correctamente`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el documento",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const openDetail = async (doc: Document) => {
    try {
      const fullDoc = await documentsService.getById(doc.id)
      setDetailDoc(fullDoc)
    } catch {
      setDetailDoc(doc)
    }
    setDetailOpen(true)
  }

  const handleUploadClick = () => {
    window.dispatchEvent(new CustomEvent("openUploadModal"))
  }

  // ─── Render Helpers ─────────────────────────────────────────────────────

  const renderFieldValue = (field: DocumentField) => {
    if (field.value === null || field.value === undefined)
      return <span className="text-muted-foreground italic">Sin valor</span>
    if (typeof field.value === "boolean") return field.value ? "Sí" : "No"
    if (Array.isArray(field.value)) return field.value.join(", ")
    return String(field.value)
  }

  // ─── Unauthenticated State ─────────────────────────────────────────────

  if (isUnauthenticated) {
    return (
      <div className="h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-4 sm:p-6 max-w-[1400px] mx-auto flex items-center justify-center min-h-[60vh]">
          <Card className="rounded-2xl border-dashed max-w-md w-full">
            <CardContent className="p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <HardDrive className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-primary">
                Accede a tu Almacenamiento
              </h3>
              <p className="text-sm text-muted-foreground font-secondary mb-6">
                Inicia sesión para ver y gestionar tus documentos almacenados en la nube.
              </p>
              <Button
                className="rounded-full gap-2"
                onClick={() => router.push("/login")}
              >
                <LogIn className="h-4 w-4" />
                Iniciar Sesión
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ─── Loading State ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
            <Skeleton className="h-10 w-40 rounded-full" />
          </div>
          {/* Stats skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          {/* Grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Main Render ────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold font-primary tracking-tight">
              Almacenamiento
            </h1>
            <p className="text-sm text-muted-foreground font-secondary mt-1">
              Gestiona tus documentos almacenados en la nube
            </p>
          </div>
          <Button className="rounded-full gap-2" onClick={handleUploadClick}>
            <Upload className="h-4 w-4" />
            Subir Documento
          </Button>
        </div>

        {/* ── Storage Stats ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total files */}
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Files className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-primary">{stats.totalFiles}</p>
                <p className="text-xs text-muted-foreground">Archivos totales</p>
              </div>
            </CardContent>
          </Card>

          {/* Storage used */}
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Database className="h-6 w-6 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold font-primary">
                    {formatFileSize(stats.totalSizeEstimate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    de {formatFileSize(stats.planLimit)}
                  </p>
                </div>
              </div>
              <Progress value={usagePercent} className="mt-3 h-1.5" />
            </CardContent>
          </Card>

          {/* Plan */}
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Shield className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-bold font-primary">{stats.planName}</p>
                <p className="text-xs text-muted-foreground">
                  {usagePercent.toFixed(1)}% utilizado
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Filters & Controls ─────────────────────────────────────────── */}
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar archivos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Procesados</SelectItem>
                  <SelectItem value="processing">Pendientes</SelectItem>
                  <SelectItem value="error">Con error</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Más recientes</SelectItem>
                  <SelectItem value="name">Nombre</SelectItem>
                  <SelectItem value="size">Tamaño</SelectItem>
                  <SelectItem value="status">Estado</SelectItem>
                </SelectContent>
              </Select>

              {/* View toggle */}
              <div className="flex items-center border rounded-md">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode("grid")}
                        className={cn(
                          "p-2 rounded-l-md transition-colors",
                          viewMode === "grid"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Vista cuadrícula</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode("list")}
                        className={cn(
                          "p-2 rounded-r-md transition-colors",
                          viewMode === "list"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Vista lista</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Empty State ────────────────────────────────────────────────── */}
        {filteredDocs.length === 0 && (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="p-12 text-center">
              <HardDrive className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2 font-primary">
                {searchQuery || statusFilter !== "all"
                  ? "No se encontraron archivos"
                  : "Sin archivos aún"}
              </h3>
              <p className="text-muted-foreground font-secondary max-w-md mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "Intenta ajustar los filtros de búsqueda"
                  : "Sube tu primer documento para comenzar a organizar tu almacenamiento"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button
                  className="mt-4 rounded-full gap-2"
                  onClick={handleUploadClick}
                >
                  <Upload className="h-4 w-4" />
                  Subir Documento
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Grid View ──────────────────────────────────────────────────── */}
        {filteredDocs.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => (
              <Card
                key={doc.id}
                className="rounded-2xl group hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openDetail(doc)}
              >
                <CardContent className="p-4 space-y-3">
                  {/* File header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        {getFileIcon(doc.filename)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getFileType(doc.filename)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>~{formatFileSize(estimateFileSize(doc.filename))}</span>
                  </div>

                  {/* Document type */}
                  {doc.documentTypeName && (
                    <Badge variant="outline" className="text-xs">
                      {doc.documentTypeName}
                    </Badge>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(doc)
                            }}
                            disabled={downloadingId === doc.id}
                          >
                            {downloadingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Descargar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDetail(doc)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver detalle</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(doc)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── List View ──────────────────────────────────────────────────── */}
        {filteredDocs.length > 0 && viewMode === "list" && (
          <Card className="rounded-2xl">
            <CardContent className="p-0">
              {/* Mobile list */}
              <div className="block sm:hidden divide-y">
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 space-y-2 active:bg-muted/50 transition-colors"
                    onClick={() => openDetail(doc)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {getFileIcon(doc.filename)}
                        <span className="text-sm font-medium truncate">
                          {doc.filename}
                        </span>
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{getFileType(doc.filename)}</span>
                      <span>
                        {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tamaño est.</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map((doc) => (
                      <TableRow key={doc.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFileIcon(doc.filename)}
                            <span className="font-medium truncate max-w-[250px]">
                              {doc.filename}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {doc.documentTypeName || getFileType(doc.filename)}
                        </TableCell>
                        <TableCell>{getStatusBadge(doc.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          ~{formatFileSize(estimateFileSize(doc.filename))}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                              disabled={downloadingId === doc.id}
                              title="Descargar"
                            >
                              {downloadingId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => setDeleteTarget(doc)}
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

              {/* Count */}
              <div className="px-4 py-3 border-t text-sm text-muted-foreground">
                {filteredDocs.length} archivo{filteredDocs.length !== 1 ? "s" : ""}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás por eliminar <strong>"{deleteTarget?.filename}"</strong>. Esta acción
              no se puede deshacer y el archivo será eliminado permanentemente del
              almacenamiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Document Detail Dialog ─────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[95vw] max-w-2xl md:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-primary flex items-center gap-2">
              {detailDoc && getFileIcon(detailDoc.filename)}
              <span className="truncate">{detailDoc?.filename || "Documento"}</span>
            </DialogTitle>
            <DialogDescription>Detalle del documento almacenado</DialogDescription>
          </DialogHeader>

          {detailDoc && (
            <ScrollArea className="flex-1 pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">

                {/* COLUMNA IZQUIERDA: Meta + Resumen + OCR */}
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Estado</p>
                      {getStatusBadge(detailDoc.status)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tipo</p>
                      <p className="text-sm font-medium break-words">{detailDoc.documentTypeName || getFileType(detailDoc.filename)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tamaño est.</p>
                      <p className="text-sm font-medium font-mono">~{formatFileSize(estimateFileSize(detailDoc.filename))}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Fecha</p>
                      <p className="text-sm font-medium">
                        {new Date(detailDoc.createdAt).toLocaleDateString("es-ES", {
                          day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </p>
                    </div>
                    {detailDoc.confidenceScore > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Confianza OCR</p>
                        <p className="text-sm font-medium font-mono">{(detailDoc.confidenceScore * 100).toFixed(1)}%</p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {detailDoc.extractedData?.summary && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Resumen</p>
                      <p className="text-sm leading-relaxed bg-muted/50 rounded-lg p-3 break-words">
                        {detailDoc.extractedData.summary}
                      </p>
                    </div>
                  )}

                  {detailDoc.ocrRawText && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Texto OCR</p>
                      <pre className="text-xs bg-muted/50 rounded-lg p-3 whitespace-pre-wrap break-words max-h-[400px] overflow-y-auto font-mono">
                        {detailDoc.ocrRawText}
                      </pre>
                    </div>
                  )}
                </div>

                {/* COLUMNA DERECHA: Datos Extraídos */}
                <div className="space-y-5">
                  {(detailDoc.extractedData?.fields?.length > 0 || detailDoc.extractedData?.key_fields?.length > 0) && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Datos Extraídos</p>
                      <div className="rounded-lg border divide-y">
                        {(detailDoc.extractedData.fields || detailDoc.extractedData.key_fields || []).map(
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
                    </div>
                  )}
                </div>

              </div>

              {/* Acciones */}
              <div className="flex flex-wrap gap-2 pt-4 border-t justify-end">
                <Button variant="outline" size="sm" className="gap-2"
                  onClick={() => handleDownload(detailDoc)} disabled={downloadingId === detailDoc.id}
                >
                  {downloadingId === detailDoc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Descargar
                </Button>
                <Button variant="outline" size="sm" className="gap-2"
                  onClick={() => router.push(`/documents?search=${encodeURIComponent(detailDoc.filename)}`)}
                >
                  <Eye className="h-4 w-4" />
                  Ver en Documentos
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-red-500 hover:text-red-600"
                  onClick={() => { setFileToDelete(detailDoc); setDetailOpen(false) }}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
        </Dialog>port { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  HardDrive,
  Search,
  Upload,
  Download,
  Trash2,
  Eye,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  Loader2,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  LayoutGrid,
  List,
  ArrowUpDown,
  Database,
  Files,
  Shield,
  LogIn,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api/client"
import { documentsService, Document, DocumentField } from "@/lib/api/documents.service"

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function estimateFileSize(filename: string): number {
  // Rough estimate based on file type – real size not in entity
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return 1.2 * 1024 * 1024 // ~1.2 MB avg
  if (["png", "jpg", "jpeg", "webp"].includes(ext || "")) return 800 * 1024
  if (["xlsx", "csv"].includes(ext || "")) return 200 * 1024
  return 500 * 1024
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return <FileText className="h-5 w-5 text-red-500" />
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext || ""))
    return <ImageIcon className="h-5 w-5 text-blue-500" />
  if (["xlsx", "xls", "csv"].includes(ext || ""))
    return <FileSpreadsheet className="h-5 w-5 text-green-500" />
  return <File className="h-5 w-5 text-muted-foreground" />
}

function getFileType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  const map: Record<string, string> = {
    pdf: "PDF",
    png: "Imagen PNG",
    jpg: "Imagen JPG",
    jpeg: "Imagen JPEG",
    webp: "Imagen WebP",
    gif: "GIF",
    xlsx: "Excel",
    xls: "Excel",
    csv: "CSV",
    doc: "Word",
    docx: "Word",
    txt: "Texto",
  }
  return map[ext || ""] || ext?.toUpperCase() || "Archivo"
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Procesado
        </Badge>
      )
    case "processing":
      return (
        <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-0 gap-1">
          <Clock className="h-3 w-3 animate-spin" />
          Pendiente
        </Badge>
      )
    case "error":
      return (
        <Badge variant="secondary" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-0 gap-1">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface StorageStats {
  totalFiles: number
  totalSizeEstimate: number
  planLimit: number // bytes
  planName: string
}

type ViewMode = "grid" | "list"
type SortField = "name" | "date" | "size" | "status"

// ─── Component ──────────────────────────────────────────────────────────────

export default function StoragePage() {
  const router = useRouter()
  const { toast } = useToast()

  // State
  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUnauthenticated, setIsUnauthenticated] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [sortField, setSortField] = useState<SortField>("date")

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Detail dialog
  const [detailDoc, setDetailDoc] = useState<Document | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Download loading
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  // ─── Data Loading ───────────────────────────────────────────────────────

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      setIsUnauthenticated(false)
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
      if (!token) {
        setIsUnauthenticated(true)
        setDocuments([])
        return
      }
      const docs = await documentsService.getAll()
      setDocuments(docs)
    } catch (error: any) {
      const status = error?.response?.status || error?.status
      if (status === 401 || status === 403) {
        setIsUnauthenticated(true)
        setDocuments([])
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
    loadDocuments()
    const handler = () => loadDocuments()
    window.addEventListener("documentUploaded", handler)
    return () => window.removeEventListener("documentUploaded", handler)
  }, [loadDocuments])

  // ─── Storage Stats ──────────────────────────────────────────────────────

  const stats: StorageStats = useMemo(() => {
    const totalSizeEstimate = documents.reduce(
      (acc, doc) => acc + estimateFileSize(doc.filename),
      0
    )
    return {
      totalFiles: documents.length,
      totalSizeEstimate,
      planLimit: 5 * 1024 * 1024 * 1024, // 5 GB default
      planName: "Plan Estándar",
    }
  }, [documents])

  const usagePercent = Math.min(
    (stats.totalSizeEstimate / stats.planLimit) * 100,
    100
  )

  // ─── Filtering & Sorting ───────────────────────────────────────────────

  const filteredDocs = useMemo(() => {
    let result = [...documents]

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter)
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (d) =>
          d.filename.toLowerCase().includes(q) ||
          d.documentTypeName?.toLowerCase().includes(q)
      )
    }

    // Sort
    result.sort((a, b) => {
      switch (sortField) {
        case "name":
          return a.filename.localeCompare(b.filename)
        case "date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case "size":
          return estimateFileSize(b.filename) - estimateFileSize(a.filename)
        case "status":
          return a.status.localeCompare(b.status)
        default:
          return 0
      }
    })

    return result
  }, [documents, statusFilter, searchQuery, sortField])

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleDownload = async (doc: Document) => {
    try {
      setDownloadingId(doc.id)
      const response = await apiClient.get(`/documents/${doc.id}/download-url`)
      const url = response.data?.url
      if (url) {
        window.open(url, "_blank")
      } else {
        toast({
          title: "Sin enlace",
          description: "No se pudo obtener la URL de descarga",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al obtener la URL de descarga",
        variant: "destructive",
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setIsDeleting(true)
      await apiClient.delete(`/documents/${deleteTarget.id}`)
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id))
      toast({
        title: "Eliminado",
        description: `"${deleteTarget.filename}" fue eliminado correctamente`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el documento",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  const openDetail = async (doc: Document) => {
    try {
      const fullDoc = await documentsService.getById(doc.id)
      setDetailDoc(fullDoc)
    } catch {
      setDetailDoc(doc)
    }
    setDetailOpen(true)
  }

  const handleUploadClick = () => {
    window.dispatchEvent(new CustomEvent("openUploadModal"))
  }

  // ─── Render Helpers ─────────────────────────────────────────────────────

  const renderFieldValue = (field: DocumentField) => {
    if (field.value === null || field.value === undefined)
      return <span className="text-muted-foreground italic">Sin valor</span>
    if (typeof field.value === "boolean") return field.value ? "Sí" : "No"
    if (Array.isArray(field.value)) return field.value.join(", ")
    return String(field.value)
  }

  // ─── Unauthenticated State ─────────────────────────────────────────────

  if (isUnauthenticated) {
    return (
      <div className="h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-4 sm:p-6 max-w-[1400px] mx-auto flex items-center justify-center min-h-[60vh]">
          <Card className="rounded-2xl border-dashed max-w-md w-full">
            <CardContent className="p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <HardDrive className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2 font-primary">
                Accede a tu Almacenamiento
              </h3>
              <p className="text-sm text-muted-foreground font-secondary mb-6">
                Inicia sesión para ver y gestionar tus documentos almacenados en la nube.
              </p>
              <Button
                className="rounded-full gap-2"
                onClick={() => router.push("/login")}
              >
                <LogIn className="h-4 w-4" />
                Iniciar Sesión
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ─── Loading State ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
            <Skeleton className="h-10 w-40 rounded-full" />
          </div>
          {/* Stats skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          {/* Grid skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Main Render ────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold font-primary tracking-tight">
              Almacenamiento
            </h1>
            <p className="text-sm text-muted-foreground font-secondary mt-1">
              Gestiona tus documentos almacenados en la nube
            </p>
          </div>
          <Button className="rounded-full gap-2" onClick={handleUploadClick}>
            <Upload className="h-4 w-4" />
            Subir Documento
          </Button>
        </div>

        {/* ── Storage Stats ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total files */}
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Files className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-primary">{stats.totalFiles}</p>
                <p className="text-xs text-muted-foreground">Archivos totales</p>
              </div>
            </CardContent>
          </Card>

          {/* Storage used */}
          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Database className="h-6 w-6 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold font-primary">
                    {formatFileSize(stats.totalSizeEstimate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    de {formatFileSize(stats.planLimit)}
                  </p>
                </div>
              </div>
              <Progress value={usagePercent} className="mt-3 h-1.5" />
            </CardContent>
          </Card>

          {/* Plan */}
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Shield className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-bold font-primary">{stats.planName}</p>
                <p className="text-xs text-muted-foreground">
                  {usagePercent.toFixed(1)}% utilizado
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Filters & Controls ─────────────────────────────────────────── */}
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar archivos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Procesados</SelectItem>
                  <SelectItem value="processing">Pendientes</SelectItem>
                  <SelectItem value="error">Con error</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Más recientes</SelectItem>
                  <SelectItem value="name">Nombre</SelectItem>
                  <SelectItem value="size">Tamaño</SelectItem>
                  <SelectItem value="status">Estado</SelectItem>
                </SelectContent>
              </Select>

              {/* View toggle */}
              <div className="flex items-center border rounded-md">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode("grid")}
                        className={cn(
                          "p-2 rounded-l-md transition-colors",
                          viewMode === "grid"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Vista cuadrícula</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode("list")}
                        className={cn(
                          "p-2 rounded-r-md transition-colors",
                          viewMode === "list"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Vista lista</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Empty State ────────────────────────────────────────────────── */}
        {filteredDocs.length === 0 && (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="p-12 text-center">
              <HardDrive className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2 font-primary">
                {searchQuery || statusFilter !== "all"
                  ? "No se encontraron archivos"
                  : "Sin archivos aún"}
              </h3>
              <p className="text-muted-foreground font-secondary max-w-md mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "Intenta ajustar los filtros de búsqueda"
                  : "Sube tu primer documento para comenzar a organizar tu almacenamiento"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <Button
                  className="mt-4 rounded-full gap-2"
                  onClick={handleUploadClick}
                >
                  <Upload className="h-4 w-4" />
                  Subir Documento
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Grid View ──────────────────────────────────────────────────── */}
        {filteredDocs.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => (
              <Card
                key={doc.id}
                className="rounded-2xl group hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openDetail(doc)}
              >
                <CardContent className="p-4 space-y-3">
                  {/* File header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        {getFileIcon(doc.filename)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getFileType(doc.filename)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>~{formatFileSize(estimateFileSize(doc.filename))}</span>
                  </div>

                  {/* Document type */}
                  {doc.documentTypeName && (
                    <Badge variant="outline" className="text-xs">
                      {doc.documentTypeName}
                    </Badge>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(doc)
                            }}
                            disabled={downloadingId === doc.id}
                          >
                            {downloadingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Descargar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDetail(doc)
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver detalle</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(doc)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── List View ──────────────────────────────────────────────────── */}
        {filteredDocs.length > 0 && viewMode === "list" && (
          <Card className="rounded-2xl">
            <CardContent className="p-0">
              {/* Mobile list */}
              <div className="block sm:hidden divide-y">
                {filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 space-y-2 active:bg-muted/50 transition-colors"
                    onClick={() => openDetail(doc)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {getFileIcon(doc.filename)}
                        <span className="text-sm font-medium truncate">
                          {doc.filename}
                        </span>
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{getFileType(doc.filename)}</span>
                      <span>
                        {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tamaño est.</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map((doc) => (
                      <TableRow key={doc.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFileIcon(doc.filename)}
                            <span className="font-medium truncate max-w-[250px]">
                              {doc.filename}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {doc.documentTypeName || getFileType(doc.filename)}
                        </TableCell>
                        <TableCell>{getStatusBadge(doc.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          ~{formatFileSize(estimateFileSize(doc.filename))}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                              disabled={downloadingId === doc.id}
                              title="Descargar"
                            >
                              {downloadingId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => setDeleteTarget(doc)}
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

              {/* Count */}
              <div className="px-4 py-3 border-t text-sm text-muted-foreground">
                {filteredDocs.length} archivo{filteredDocs.length !== 1 ? "s" : ""}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás por eliminar <strong>"{deleteTarget?.filename}"</strong>. Esta acción
              no se puede deshacer y el archivo será eliminado permanentemente del
              almacenamiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Document Detail Dialog ─────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-primary flex items-center gap-2">
              {detailDoc && getFileIcon(detailDoc.filename)}
              <span className="truncate">{detailDoc?.filename || "Documento"}</span>
            </DialogTitle>
            <DialogDescription>Detalle del documento almacenado</DialogDescription>
          </DialogHeader>

          {detailDoc && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 pb-4">
                {/* Meta info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Estado
                    </p>
                    {getStatusBadge(detailDoc.status)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Tipo
                    </p>
                    <p className="text-sm font-medium break-words">
                      {detailDoc.documentTypeName || getFileType(detailDoc.filename)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Tamaño estimado
                    </p>
                    <p className="text-sm font-medium font-mono">
                      ~{formatFileSize(estimateFileSize(detailDoc.filename))}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Fecha
                    </p>
                    <p className="text-sm font-medium">
                      {new Date(detailDoc.createdAt).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {detailDoc.confidenceScore > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Confianza OCR
                      </p>
                      <p className="text-sm font-medium font-mono">
                        {(detailDoc.confidenceScore * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Summary */}
                {detailDoc.extractedData?.summary && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Resumen
                    </p>
                    <p className="text-sm leading-relaxed bg-muted/50 rounded-lg p-3 break-words">
                      {detailDoc.extractedData.summary}
                    </p>
                  </div>
                )}

                {/* Extracted fields */}
                {(detailDoc.extractedData?.fields ||
                  detailDoc.extractedData?.key_fields) && (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Datos Extraídos
                    </p>
                    <div className="rounded-lg border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40%]">Campo</TableHead>
                            <TableHead>Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(
                            detailDoc.extractedData.fields ||
                            detailDoc.extractedData.key_fields ||
                            []
                          ).map((field: DocumentField, index: number) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium text-sm">
                                {field.label || field.name}
                              </TableCell>
                              <TableCell className="text-sm break-all">
                                {renderFieldValue(field)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* OCR Raw Text */}
                {detailDoc.ocrRawText && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Texto OCR
                    </p>
                    <pre className="text-xs bg-muted/50 rounded-lg p-3 whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto font-mono">
                      {detailDoc.ocrRawText}
                    </pre>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleDownload(detailDoc)}
                    disabled={downloadingId === detailDoc.id}
                  >
                    {downloadingId === detailDoc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Descargar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      router.push(`/documents?search=${encodeURIComponent(detailDoc.filename)}`)
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    Ver en Documentos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red-500 hover:text-red-600"
                    onClick={() => {
                      setDetailOpen(false)
                      setDeleteTarget(detailDoc)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
