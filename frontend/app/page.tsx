"use client"

import { useState, useEffect } from "react"
import { FileText, Folder, MessageSquare, Send, Loader2, CheckCircle2, Table, Braces, ChevronLeft, ChevronRight, ChevronDown, Image as ImageIcon, File, RefreshCw, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { googleDriveService, GoogleDriveFile } from "@/lib/api/google-drive.service"
import { documentTypesService, DocumentType } from "@/lib/api/document-types.service"
import { documentsService, Document } from "@/lib/api/documents.service"

type DataViewMode = "table" | "json"

interface FolderNode {
  id: string
  name: string
  type: "folder" | "file"
  mimeType?: string
  webViewLink?: string
  children?: FolderNode[]
  expanded?: boolean
  createdTime?: string
  modifiedTime?: string
  documentData?: Document | null // Agregar datos del documento si están disponibles
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export default function DashboardPage() {
  const [folderTree, setFolderTree] = useState<FolderNode[]>([])
  const [selectedFile, setSelectedFile] = useState<GoogleDriveFile | null>(null)
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null)
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [currentDocumentType, setCurrentDocumentType] = useState<DocumentType | null>(null)
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [isLoadingDocument, setIsLoadingDocument] = useState(false)
  const [dataViewMode, setDataViewMode] = useState<DataViewMode>("table")
  const [isRoutesCollapsed, setIsRoutesCollapsed] = useState(false)
  const { toast } = useToast()

  // Cargar carpeta raíz de Google Drive
  const loadRootFolder = async () => {
    try {
      setIsLoadingFolders(true)
      
      // Verificar autenticación
      const authStatus = await googleDriveService.getAuthStatus()
      if (!authStatus.authenticated) {
        toast({
          title: "Google Drive no conectado",
          description: "Por favor, conecta tu cuenta de Google Drive desde Tipos de Documento",
          variant: "destructive",
        })
        return
      }

      // Intentar listar directamente desde la carpeta raíz configurada
      // Si GOOGLE_DRIVE_ROOT_FOLDER_ID está configurado, listará desde ahí
      const response = await googleDriveService.listRootFiles()
      
      // Si la respuesta contiene carpetas, usarlas directamente
      if (response.files && response.files.length > 0) {
        const tree: FolderNode[] = response.files
          .filter(f => f.mimeType === "application/vnd.google-apps.folder")
          .map(file => ({
            id: file.id,
            name: file.name,
            type: "folder",
            mimeType: file.mimeType,
            webViewLink: file.webViewLink,
            children: [],
            expanded: false,
            createdTime: file.createdTime,
            modifiedTime: file.modifiedTime,
          }))

        if (tree.length > 0) {
          setFolderTree(tree)
        } else {
          toast({
            title: "No hay carpetas",
            description: "No se encontraron carpetas de tipos de documento. Crea un tipo de documento primero.",
          })
        }
      } else {
        toast({
          title: "No hay carpetas",
          description: "No se encontraron carpetas en Google Drive. Crea un tipo de documento primero.",
        })
      }
    } catch (error: any) {
      console.error("Error loading folders:", error)
      toast({
        title: "Error",
        description: error.message || "Error al cargar carpetas de Google Drive",
        variant: "destructive",
      })
    } finally {
      setIsLoadingFolders(false)
    }
  }

  // Expandir/contraer carpeta
  const toggleFolder = async (nodeId: string) => {
    const updateTree = async (nodes: FolderNode[]): Promise<FolderNode[]> => {
      return Promise.all(
        nodes.map(async (node) => {
          if (node.id === nodeId && node.type === "folder") {
            if (!node.expanded && (!node.children || node.children.length === 0)) {
              // Cargar archivos de esta carpeta
              try {
                const files = await googleDriveService.listFolderFiles(node.id)
                node.children = files.files.map(file => ({
                  id: file.id,
                  name: file.name,
                  type: file.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file",
                  mimeType: file.mimeType,
                  webViewLink: file.webViewLink,
                  children: [],
                  expanded: false,
                  createdTime: file.createdTime,
                  modifiedTime: file.modifiedTime,
                }))
              } catch (error) {
                console.error("Error loading folder:", error)
                toast({
                  title: "Error",
                  description: `Error al cargar la carpeta ${node.name}`,
                  variant: "destructive",
                })
              }
            }
            return { ...node, expanded: !node.expanded }
          }
          if (node.children) {
            return { ...node, children: await updateTree(node.children) }
          }
          return node
        })
      )
    }

    const updatedTree = await updateTree(folderTree)
    setFolderTree(updatedTree)
  }

  // Seleccionar archivo
  // Cargar datos del documento desde el backend
  const loadDocumentData = async (googleDriveFileId: string) => {
    try {
      setIsLoadingDocument(true)
      
      // Obtener todos los documentos del usuario
      const allDocuments = await documentsService.getAll()
      
      // Buscar el documento que coincida con el googleDriveFileId
      const document = allDocuments.find(doc => doc.googleDriveFileId === googleDriveFileId)
      
      if (document) {
        setCurrentDocument(document)
        console.log("Documento cargado:", document)
        
        // Actualizar el tipo de documento actual
        const docType = documentTypes.find(dt => dt.id === document.documentTypeId)
        setCurrentDocumentType(docType || null)
      } else {
        console.log("Documento no encontrado en BD para fileId:", googleDriveFileId)
        setCurrentDocument(null)
      }
    } catch (error) {
      console.error("Error loading document data:", error)
      toast({
        title: "Error al cargar datos",
        description: "No se pudieron cargar los datos del documento",
        variant: "destructive",
      })
      setCurrentDocument(null)
    } finally {
      setIsLoadingDocument(false)
    }
  }

  const selectFile = (node: FolderNode, parentFolderName?: string) => {
    if (node.type === "file") {
      setSelectedFile({
        id: node.id,
        name: node.name,
        mimeType: node.mimeType || "",
        webViewLink: node.webViewLink,
        createdTime: node.createdTime,
        modifiedTime: node.modifiedTime,
      })
      
      // Guardar el nombre de la carpeta padre (se procesará en useEffect)
      if (parentFolderName) {
        setSelectedFolderName(parentFolderName)
      }
      
      // Cargar datos del documento desde el backend
      loadDocumentData(node.id)
    }
  }
  
  // Cargar tipos de documento
  const loadDocumentTypes = async () => {
    try {
      const types = await documentTypesService.getAll()
      setDocumentTypes(types)
    } catch (error) {
      console.error("Error loading document types:", error)
    }
  }

  // Obtener icono según tipo de archivo
  const getFileIcon = (node: FolderNode) => {
    if (node.type === "folder") {
      return <Folder className="h-4 w-4 text-amber-500" />
    }
    if (node.mimeType === "application/pdf") {
      return <FileText className="h-4 w-4 text-red-500" />
    }
    if (node.mimeType?.startsWith("image/")) {
      return <ImageIcon className="h-4 w-4 text-blue-500" />
    }
    return <File className="h-4 w-4 text-gray-500" />
  }

  // Renderizar árbol de carpetas
  const renderTree = (nodes: FolderNode[], level: number = 0, parentName?: string) => {
    return nodes.map((node) => (
      <div key={node.id}>
        <button
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left transition-colors",
            selectedFile?.id === node.id && "bg-primary/10",
            isRoutesCollapsed && "justify-center px-1"
          )}
          style={{ paddingLeft: isRoutesCollapsed ? undefined : `${level * 16 + 8}px` }}
          onClick={() => {
            if (node.type === "folder") {
              toggleFolder(node.id)
            } else {
              // Si estamos en nivel 0, no hay carpeta padre
              // Si estamos en nivel > 0, usar el parentName que se pasó
              selectFile(node, parentName)
            }
          }}
          title={isRoutesCollapsed ? node.name : undefined}
        >
          {node.type === "folder" && !isRoutesCollapsed && (
            node.expanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )
          )}
          {getFileIcon(node)}
          {!isRoutesCollapsed && (
            <span className="text-sm truncate flex-1">{node.name}</span>
          )}
        </button>
        {node.expanded && node.children && renderTree(node.children, level + 1, node.name)}
      </div>
    ))
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputMessage("")
    setIsProcessing(true)

    // Simulate AI response
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const aiMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: "assistant",
      content: `He analizado tu consulta sobre "${inputMessage}". Basándome en los documentos procesados, puedo ayudarte con información específica. ¿Qué más necesitas saber?`,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, aiMessage])
    setIsProcessing(false)
  }

  const mockExtractedData = selectedFile
    ? {
        fileName: selectedFile.name,
        extractedFields: {
          nombre: selectedFile.name,
          tipo: selectedFile.mimeType,
          id: selectedFile.id,
          creado: selectedFile.createdTime || "N/A",
          modificado: selectedFile.modifiedTime || "N/A",
        },
      }
    : null

  useEffect(() => {
    loadRootFolder()
    loadDocumentTypes()

    // Escuchar evento de documento subido para refrescar la lista
    const handleDocumentUploaded = () => {
      console.log('Documento subido, refrescando lista...')
      loadRootFolder()
    }

    window.addEventListener('documentUploaded', handleDocumentUploaded)

    return () => {
      window.removeEventListener('documentUploaded', handleDocumentUploaded)
    }
  }, [])

  // Actualizar el tipo de documento cuando cambie la carpeta seleccionada
  useEffect(() => {
    if (selectedFolderName && documentTypes.length > 0) {
      const docType = documentTypes.find(dt => dt.name === selectedFolderName)
      setCurrentDocumentType(docType || null)
      console.log('Selected Folder:', selectedFolderName)
      console.log('Document Types:', documentTypes.map(dt => dt.name))
      console.log('Found Document Type:', docType)
    }
  }, [selectedFolderName, documentTypes])

  return (
    <div className="h-[calc(100vh-4rem)] p-4">
      <div className="h-full grid grid-cols-12 gap-4">
        {/* Panel 1: Rutas de archivos - más estrecho */}
        <div className={cn("relative transition-all duration-300", isRoutesCollapsed ? "col-span-1" : "col-span-2")}>
          <Card className="h-full flex flex-col">
            <div className={cn("p-4 border-b border-border transition-all duration-300 flex items-center justify-between", isRoutesCollapsed && "p-2 flex-col gap-2")}>
              <div className="flex items-center gap-2">
                <Folder className={cn("h-5 w-5 text-primary", isRoutesCollapsed && "mx-auto")} />
                {!isRoutesCollapsed && <h2 className="font-semibold text-lg">Rutas de Archivos</h2>}
              </div>
              {!isRoutesCollapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={loadRootFolder}
                  disabled={isLoadingFolders}
                >
                  <RefreshCw className={cn("h-4 w-4", isLoadingFolders && "animate-spin")} />
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className={cn("p-2 space-y-1", isRoutesCollapsed && "p-1")}>
                {isLoadingFolders ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : folderTree.length === 0 ? (
                  <div className={cn("p-8 text-center text-muted-foreground text-sm", isRoutesCollapsed && "p-2")}>
                    <FileText
                      className={cn("h-12 w-12 mx-auto mb-2 opacity-50", isRoutesCollapsed && "h-6 w-6 mb-1")}
                    />
                    {!isRoutesCollapsed && (
                      <>
                        <p>No hay documentos</p>
                        <p className="text-xs mt-1">Crea tipos de documento primero</p>
                      </>
                    )}
                  </div>
                ) : (
                  renderTree(folderTree)
                )}
              </div>
            </ScrollArea>
            
            {!isRoutesCollapsed && (
              <div className="p-2 border-t text-xs text-muted-foreground text-center">
                {folderTree.length} carpeta(s)
              </div>
            )}
          </Card>

          <Button
            variant="outline"
            size="icon"
            className="absolute top-1/2 -translate-y-1/2 -right-3 h-8 w-8 rounded-full shadow-md z-10 bg-background"
            onClick={() => setIsRoutesCollapsed(!isRoutesCollapsed)}
          >
            <ChevronLeft
              className={cn("h-4 w-4 transition-transform duration-300", isRoutesCollapsed && "rotate-180")}
            />
          </Button>
        </div>

        {/* Panel 2: Visor de documento - mantiene tamaño fijo, se mueve a la izquierda */}
        <Card className="col-span-5 flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-lg">Visor de Documento</h2>
            {selectedFile && <p className="text-sm text-muted-foreground mt-1 truncate">{selectedFile.name}</p>}
          </div>

          <div className="flex-1 flex items-center justify-center bg-muted/20">
            {!selectedFile ? (
              <div className="text-center text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No hay documento seleccionado</p>
                <p className="text-sm">Selecciona un documento de la lista para verlo</p>
              </div>
            ) : (
              <iframe
                src={`https://drive.google.com/file/d/${selectedFile.id}/preview`}
                className="w-full h-full"
                allow="autoplay"
                title={selectedFile.name}
              />
            )}
          </div>
        </Card>

        {/* Panel 3: Visor de Datos - se expande cuando rutas se colapsa */}
        <Card 
          className={cn(
            "flex flex-col transition-all duration-300",
            isRoutesCollapsed ? "col-span-6" : "col-span-5"
          )}
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-lg">Visor de Datos</h2>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={dataViewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setDataViewMode("table")}
                className="h-8 px-3"
              >
                <Table className="h-4 w-4 mr-1.5" />
                Tabla
              </Button>
              <Button
                variant={dataViewMode === "json" ? "default" : "ghost"}
                size="sm"
                onClick={() => setDataViewMode("json")}
                className="h-8 px-3"
              >
                <Braces className="h-4 w-4 mr-1.5" />
                JSON
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-6 !min-w-0">
              {!selectedFile ? (
                <div className="h-full flex items-center justify-center text-center text-muted-foreground py-12">
                  <div>
                    <Table className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay datos para mostrar</p>
                    <p className="text-xs mt-1">Selecciona un documento procesado</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Sección 1: Metadata del documento */}
                  <div className="!w-full">
                    <h3 className="text-sm font-semibold mb-3 px-0">Información del Documento</h3>
                    <div className="!w-full overflow-x-auto rounded-lg border border-border">
                      <table className="!w-full">
                        <tbody>
                          <tr className="border-b border-border">
                            <td className="p-3 text-sm font-medium bg-muted/50 w-[120px] whitespace-nowrap">Nombre</td>
                            <td className="p-3 text-sm text-muted-foreground break-words">{selectedFile?.name}</td>
                          </tr>
                          <tr className="border-b border-border">
                            <td className="p-3 text-sm font-medium bg-muted/50 w-[120px] whitespace-nowrap">Tipo</td>
                            <td className="p-3 text-sm text-muted-foreground break-words">{selectedFile?.mimeType}</td>
                          </tr>
                          {currentDocument && (
                            <>
                              <tr className="border-b border-border">
                                <td className="p-3 text-sm font-medium bg-muted/50 w-[120px] whitespace-nowrap">ID</td>
                                <td className="p-3 text-sm text-muted-foreground break-words font-mono text-xs">{currentDocument.googleDriveFileId}</td>
                              </tr>
                              <tr className="border-b border-border">
                                <td className="p-3 text-sm font-medium bg-muted/50 w-[120px] whitespace-nowrap">Creado</td>
                                <td className="p-3 text-sm text-muted-foreground break-words">
                                  {new Date(currentDocument.createdAt).toLocaleString()}
                                </td>
                              </tr>
                              <tr className="border-b border-border last:border-0">
                                <td className="p-3 text-sm font-medium bg-muted/50 w-[120px] whitespace-nowrap">Modificado</td>
                                <td className="p-3 text-sm text-muted-foreground break-words">
                                  {new Date(currentDocument.updatedAt).toLocaleString()}
                                </td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Sección 2: Resumen */}
                  {currentDocument && (currentDocument.extractedData?.summary || currentDocument.inferredData?.summary) && (
                    <div className="!w-full">
                      <h3 className="text-sm font-semibold mb-3 px-0">Resumen</h3>
                      <div className="rounded-lg border border-border p-4 bg-muted/20">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {currentDocument.extractedData?.summary || currentDocument.inferredData?.summary}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Sección 3: Datos extraídos */}
                  <div className="!w-full">
                    <h3 className="text-sm font-semibold mb-3 px-0">Datos Extraídos</h3>
                    {!currentDocument || !currentDocumentType ? (
                      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
                        <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>No hay datos disponibles</p>
                        <p className="text-xs mt-1">Este documento aún no ha sido procesado</p>
                      </div>
                    ) : dataViewMode === "json" ? (
                      // Vista JSON
                      <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto">
                        <code>{JSON.stringify(
                          currentDocument.documentTypeName?.toLowerCase().includes('otros')
                            ? currentDocument.inferredData
                            : currentDocument.extractedData,
                          null,
                          2
                        )}</code>
                      </pre>
                    ) : (
                      // Vista Tabla (5 columnas)
                      <div className="!w-full overflow-x-auto rounded-lg border border-border">
                        <table className="w-max min-w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-3 text-sm font-semibold whitespace-nowrap min-w-[150px]">Nombre</th>
                              <th className="text-left p-3 text-sm font-semibold whitespace-nowrap min-w-[200px]">Etiqueta</th>
                              <th className="text-left p-3 text-sm font-semibold whitespace-nowrap min-w-[200px]">Valor</th>
                              <th className="text-left p-3 text-sm font-semibold whitespace-nowrap min-w-[100px]">Tipo</th>
                              <th className="text-left p-3 text-sm font-semibold whitespace-nowrap min-w-[100px]">Requerido</th>
                              <th className="text-left p-3 text-sm font-semibold whitespace-nowrap min-w-[250px]">Descripción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              // Determinar de dónde obtener los campos
                              const fields = currentDocument.documentTypeName?.toLowerCase().includes('otros')
                                ? currentDocument.inferredData?.key_fields || currentDocument.extractedData?.key_fields || []
                                : currentDocument.extractedData?.fields || [];

                              if (fields.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                      <p>No hay campos extraídos</p>
                                    </td>
                                  </tr>
                                );
                              }

                              return fields.map((field: any, index: number) => (
                                <tr key={index} className="border-t border-border hover:bg-muted/50 transition-colors">
                                  <td className="p-3 text-sm font-mono text-xs">{field.name}</td>
                                  <td className="p-3 text-sm font-medium">{field.label}</td>
                                  <td className="p-3 text-sm font-medium">
                                    {field.value !== null && field.value !== undefined ? (
                                      typeof field.value === 'object' ? (
                                        <span className="font-mono text-xs">{JSON.stringify(field.value)}</span>
                                      ) : (
                                        String(field.value)
                                      )
                                    ) : (
                                      <span className="text-xs text-muted-foreground opacity-50">Sin valor</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-sm">
                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
                                      {field.type}
                                    </span>
                                  </td>
                                  <td className="p-3 text-sm text-center">
                                    {field.required ? (
                                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                        Sí
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                        No
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3 text-sm text-muted-foreground">{field.description || 'Sin descripción'}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Chat flotante - burbuja en esquina inferior derecha */}
      <div className="fixed bottom-6 right-6 z-50">
        {!messages.length && !isProcessing ? (
          /* Burbuja cerrada */
          <Button
            className="!h-16 !w-16 !p-0 rounded-full shadow-lg hover:scale-110 transition-transform flex items-center justify-center"
            onClick={() => {
              // Simular primer mensaje
              setMessages([{
                id: "welcome",
                role: "assistant",
                content: "¡Hola! Soy tu asistente de IA. ¿En qué puedo ayudarte con tus documentos?",
                timestamp: new Date(),
              }])
            }}
          >
            <Bot className="!h-11 !w-11" />
          </Button>
        ) : (
          /* Chat expandido */
          <Card className="w-96 h-[500px] flex flex-col shadow-2xl">
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

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg p-3 text-sm",
                        message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                      )}
                    >
                      <p className="text-pretty">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">{message.timestamp.toLocaleTimeString("es-ES")}</p>
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
            </ScrollArea>

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
                <Button type="submit" size="icon" disabled={!inputMessage.trim() || isProcessing}>
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
