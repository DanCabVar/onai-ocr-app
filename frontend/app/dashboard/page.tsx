"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  FileText,
  MessageSquare,
  Send,
  Loader2,
  ChevronDown,
  Bot,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  FileCheck,
  ListTodo,
  Settings2,
  Upload,
  FolderPlus,
  HardDrive,
  TrendingUp,
  Activity,
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { documentsService, Document } from "@/lib/api/documents.service"
import { documentTypesService, DocumentType } from "@/lib/api/document-types.service"
import { chatService } from "@/lib/api/chat.service"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sqlQuery?: string
  data?: Record<string, any>[]
  timestamp: Date
}

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()

  // Data state
  const [documents, setDocuments] = useState<Document[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Chat state (kept from original)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const [isUnauthenticated, setIsUnauthenticated] = useState(false)

  // Load data
  useEffect(() => {
    const loadData = async () => {
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
        console.error("Error loading dashboard data:", error)
        const status = error?.response?.status || error?.status
        if (status === 401 || status === 403) {
          setIsUnauthenticated(true)
          setDocuments([])
          setDocumentTypes([])
        } else {
          toast({
            title: "Error",
            description: "No se pudieron cargar los datos del dashboard",
            variant: "destructive",
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // Listen for document uploaded events
    const handleDocumentUploaded = () => {
      loadData()
    }
    window.addEventListener("documentUploaded", handleDocumentUploaded)
    return () => {
      window.removeEventListener("documentUploaded", handleDocumentUploaded)
    }
  }, [])

  // Computed metrics
  const completedDocs = documents.filter((d) => d.status === "completed")
  const processingDocs = documents.filter((d) => d.status === "processing")
  const errorDocs = documents.filter((d) => d.status === "error")
  const successRate =
    documents.length > 0
      ? Math.round((completedDocs.length / documents.length) * 1000) / 10
      : 0

  // Recent documents (filtered by search)
  const recentDocuments = documents
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .filter((doc) =>
      searchQuery
        ? doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.documentTypeName
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())
        : true
    )
    .slice(0, 5)

  // Recent activity (derived from documents)
  const recentActivity = documents
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5)
    .map((doc) => ({
      id: doc.id,
      text:
        doc.status === "completed"
          ? `Documento "${doc.filename}" procesado exitosamente`
          : doc.status === "processing"
          ? `Procesando documento "${doc.filename}"`
          : `Error al procesar "${doc.filename}"`,
      status: doc.status,
      time: formatRelativeTime(doc.createdAt),
    }))

  // Chart data: documents processed per day (last 14 days)
  const chartData = useMemo(() => {
    const now = new Date()
    const days: { date: string; label: string; completados: number; errores: number; total: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
      const dayDocs = documents.filter(
        (doc) => new Date(doc.createdAt).toISOString().slice(0, 10) === key
      )
      days.push({
        date: key,
        label,
        completados: dayDocs.filter((d) => d.status === "completed").length,
        errores: dayDocs.filter((d) => d.status === "error").length,
        total: dayDocs.length,
      })
    }
    return days
  }, [documents])

  // New types this month
  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)
  const newTypesThisMonth = documentTypes.filter(
    (dt) => new Date(dt.createdAt) >= thisMonth
  ).length

  // Status badge helper
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
            <Clock className="h-3 w-3" />
            En proceso
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
        return (
          <Badge variant="secondary">{status}</Badge>
        )
    }
  }

  // Activity dot color
  function getActivityDotColor(status: string) {
    switch (status) {
      case "completed":
        return "bg-green-500"
      case "processing":
        return "bg-orange-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-gray-400"
    }
  }

  // Chat state for SQL toggle
  const [expandedSql, setExpandedSql] = useState<Set<string>>(new Set())

  const toggleSql = (messageId: string) => {
    setExpandedSql((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  }

  // Chat handler — calls real RAG SQL endpoint
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const question = inputMessage
    setInputMessage("")
    setIsProcessing(true)

    try {
      const result = await chatService.query(question)

      const aiMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: result.answer,
        sqlQuery: result.query,
        data: result.data,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        "Error al procesar tu consulta"

      const aiMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: `⚠️ ${errorMsg}`,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMessage])
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold font-primary tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground font-secondary mt-1">
              Resumen de actividad y procesamiento de documentos
            </p>
          </div>
          <Button
            className="rounded-full gap-2"
            onClick={() => {
              // Dispatch event to open upload modal (handled by layout/sidebar)
              window.dispatchEvent(new CustomEvent("openUploadModal"))
            }}
          >
            <Plus className="h-4 w-4" />
            Subir Documento
          </Button>
        </div>

        {/* Unauthenticated Banner */}
        {isUnauthenticated && (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="p-6 text-center">
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm font-medium text-muted-foreground">
                Inicia sesión para ver tus documentos y estadísticas
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

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Documentos Procesados */}
          <Card className="relative overflow-hidden rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground font-secondary">
                    Documentos Procesados
                  </p>
                  <p className="text-3xl font-bold font-primary tracking-tight">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      completedDocs.length.toLocaleString()
                    )}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {documents.length} total procesados
                  </p>
                </div>
                <div className="rounded-xl bg-green-100 dark:bg-green-900/30 p-2.5">
                  <FileCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tasa de Exito OCR */}
          <Card className="relative overflow-hidden rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground font-secondary">
                    Tasa de Exito OCR
                  </p>
                  <p className="text-3xl font-bold font-primary tracking-tight">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      `${successRate}%`
                    )}
                  </p>
                  <div className="space-y-1">
                    <Progress value={successRate} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {successRate >= 90
                        ? "Excelente rendimiento"
                        : successRate >= 70
                        ? "Buen rendimiento"
                        : "Rendimiento mejorable"}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-orange-100 dark:bg-orange-900/30 p-2.5">
                  <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pendientes */}
          <Card className="relative overflow-hidden rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground font-secondary">
                    Pendientes
                  </p>
                  <p className="text-3xl font-bold font-primary tracking-tight">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      processingDocs.length
                    )}
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                    En cola de procesamiento
                  </p>
                </div>
                <div className="rounded-xl bg-orange-100 dark:bg-orange-900/30 p-2.5">
                  <ListTodo className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tipos Configurados */}
          <Card className="relative overflow-hidden rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground font-secondary">
                    Tipos Configurados
                  </p>
                  <p className="text-3xl font-bold font-primary tracking-tight">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      documentTypes.length
                    )}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    {newTypesThisMonth > 0
                      ? `${newTypesThisMonth} nuevo${newTypesThisMonth > 1 ? "s" : ""} este mes`
                      : "Sin cambios este mes"}
                  </p>
                </div>
                <div className="rounded-xl bg-green-100 dark:bg-green-900/30 p-2.5">
                  <Settings2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart: Documentos procesados por día */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-primary flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Documentos Procesados (últimos 14 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[220px]">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCompletados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorErrores" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="completados"
                      name="Completados"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCompletados)"
                    />
                    <Area
                      type="monotone"
                      dataKey="errores"
                      name="Errores"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorErrores)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Two-Column Area */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Documentos Recientes (3/5 = ~60%) */}
          <Card className="lg:col-span-3 rounded-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-primary">
                  Documentos Recientes
                </CardTitle>
                <button
                  onClick={() => router.push("/documents")}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Ver todos
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar documentos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Table */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : recentDocuments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No hay documentos</p>
                  <p className="text-sm mt-1">
                    Sube tu primer documento para comenzar
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentDocuments.map((doc) => (
                      <TableRow key={doc.id} className="cursor-pointer">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate max-w-[200px]">
                              {doc.filename}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {doc.documentTypeName || "Sin tipo"}
                        </TableCell>
                        <TableCell>{getStatusBadge(doc.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Right Column: Activity + Quick Actions (2/5 = ~40%) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Actividad Reciente */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-primary">
                  Actividad Reciente
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Sin actividad reciente</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3"
                      >
                        <div
                          className={cn(
                            "mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0",
                            getActivityDotColor(activity.status)
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug truncate">
                            {activity.text}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {activity.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Acciones Rapidas */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-primary">
                  Acciones Rapidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <button
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent("openUploadModal"))
                    }
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors text-left"
                  >
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Upload className="h-4 w-4 text-primary" />
                    </div>
                    Subir Documento
                  </button>
                  <button
                    onClick={() => router.push("/document-types")}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors text-left"
                  >
                    <div className="rounded-lg bg-primary/10 p-2">
                      <FolderPlus className="h-4 w-4 text-primary" />
                    </div>
                    Crear Tipo de Documento
                  </button>
                  <button
                    onClick={() => router.push("/documents")}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors text-left"
                  >
                    <div className="rounded-lg bg-primary/10 p-2">
                      <HardDrive className="h-4 w-4 text-primary" />
                    </div>
                    Explorar Almacenamiento
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Chat flotante - burbuja en esquina inferior derecha (kept from original) */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
        {!messages.length && !isProcessing ? (
          <Button
            className="!h-16 !w-16 !p-0 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
            onClick={() => {
              setMessages([
                {
                  id: "welcome",
                  role: "assistant",
                  content:
                    "Hola! Soy tu asistente de IA. En que puedo ayudarte con tus documentos?",
                  timestamp: new Date(),
                },
              ])
            }}
          >
            <Bot className="!h-11 !w-11" />
          </Button>
        ) : (
          <Card className="w-[calc(100vw-2rem)] sm:w-96 h-[45vh] sm:h-[420px] flex flex-col shadow-2xl" style={{ overflow: 'hidden' }}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Chat de IA</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setMessages([])
                  setInputMessage("")
                }}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0 }}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg p-3 text-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-pretty whitespace-pre-line">{message.content}</p>

                      {/* Tabular data display */}
                      {message.data && message.data.length > 0 && (
                        <div className="mt-2 overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr>
                                {Object.keys(message.data[0]).map((key) => (
                                  <th
                                    key={key}
                                    className="text-left px-2 py-1 border-b border-border/50 font-semibold text-muted-foreground"
                                  >
                                    {key.replace(/_/g, " ")}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {message.data.slice(0, 10).map((row, i) => (
                                <tr key={i}>
                                  {Object.values(row).map((val, j) => (
                                    <td
                                      key={j}
                                      className="px-2 py-1 border-b border-border/20"
                                    >
                                      {val === null || val === undefined
                                        ? "—"
                                        : String(val)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {message.data.length > 10 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Mostrando 10 de {message.data.length} filas
                            </p>
                          )}
                        </div>
                      )}

                      {/* Expandible SQL query */}
                      {message.sqlQuery && (
                        <button
                          onClick={() => toggleSql(message.id)}
                          className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        >
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 transition-transform",
                              expandedSql.has(message.id) && "rotate-180"
                            )}
                          />
                          {expandedSql.has(message.id)
                            ? "Ocultar SQL"
                            : "Ver SQL"}
                        </button>
                      )}
                      {message.sqlQuery &&
                        expandedSql.has(message.id) && (
                          <pre className="mt-1 p-2 bg-background/50 rounded text-[10px] overflow-x-auto font-mono leading-relaxed">
                            {message.sqlQuery}
                          </pre>
                        )}

                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString("es-ES")}
                      </p>
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
                className="flex gap-2"
              >
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Escribe tu pregunta..."
                  disabled={isProcessing}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!inputMessage.trim() || isProcessing}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

// Helper: relative time formatting
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Hace un momento"
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  })
}
