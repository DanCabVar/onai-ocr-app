"use client"

import { useState, useEffect, useMemo } from "react"
import { Plus, Edit, Trash2, FileText, Loader2, Sparkles, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { documentTypesService, DocumentType, FieldDefinition } from "@/lib/api/document-types.service"
import { DocumentTypeModal } from "@/components/document-type-modal"
import { InferFromSamplesModal } from "./components/InferFromSamplesModal"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export default function DocumentTypesPage() {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([])
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isInferModalOpen, setIsInferModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<DocumentType | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const { toast } = useToast()

  // Cargar tipos de documento
  const loadDocumentTypes = async () => {
    try {
      setIsLoading(true)
      const types = await documentTypesService.getAll()
      setDocumentTypes(types)
      // Seleccionar el primero por defecto si hay tipos
      if (types.length > 0 && !selectedType) {
        setSelectedType(types[0])
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Error al cargar tipos de documento",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDocumentTypes()
  }, [])

  // Filter types by search
  const filteredTypes = useMemo(() => {
    if (!searchQuery.trim()) return documentTypes
    const q = searchQuery.toLowerCase()
    return documentTypes.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    )
  }, [documentTypes, searchQuery])

  // Crear nuevo tipo
  const handleCreate = () => {
    setEditingType(null)
    setIsModalOpen(true)
  }

  // Editar tipo
  const handleEdit = (type: DocumentType) => {
    setEditingType(type)
    setIsModalOpen(true)
  }

  // Eliminar tipo
  const handleDelete = async (type: DocumentType) => {
    // Construir mensaje de advertencia
    let warningMessage = `¿Está seguro de eliminar el tipo "${type.name}"?\n\n`;

    if (type.googleDriveFolderId) {
      warningMessage += `⚠️ IMPORTANTE:\n`;
      warningMessage += `• Los datos en la base de datos serán eliminados\n`;
      warningMessage += `• La conexión con Google Drive se perderá\n`;
      warningMessage += `• La carpeta en Google Drive NO será eliminada (puedes eliminarla manualmente si lo deseas)\n\n`;
      warningMessage += `Esta acción no se puede deshacer.`;
    } else {
      warningMessage += `Esta acción no se puede deshacer.`;
    }

    if (!confirm(warningMessage)) {
      return
    }

    try {
      const response = await documentTypesService.delete(type.id)

      // Mostrar mensaje de éxito con advertencia si existe
      toast({
        title: "Tipo eliminado",
        description: response.warning || `El tipo "${type.name}" ha sido eliminado exitosamente`,
      })

      // Si el tipo eliminado era el seleccionado, limpiar selección
      if (selectedType?.id === type.id) {
        setSelectedType(null)
      }

      loadDocumentTypes()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Error al eliminar tipo de documento",
        variant: "destructive",
      })
    }
  }

  // Callback cuando se guarda un tipo
  const handleTypeSaved = () => {
    setIsModalOpen(false)
    loadDocumentTypes()
  }

  // Select a card
  const handleCardClick = (type: DocumentType) => {
    setSelectedType(type)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-[2200px] mx-auto px-4">
          <div>
            <h1 className="text-3xl font-bold font-primary">Tipos de Documento</h1>
            <p className="text-muted-foreground mt-1 font-secondary">
              Gestiona los tipos de documento y define que campos extraer
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <Button variant="outline" className="rounded-full w-full sm:w-auto" onClick={() => setIsInferModalOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Inferir desde Muestras
            </Button>
            <Button className="rounded-full w-full sm:w-auto" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tipo
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[2200px] mx-auto px-4">
          {documentTypes.length === 0 ? (
            <div className="flex items-center justify-center h-full p-6">
              <Card className="p-12 text-center max-w-md rounded-2xl">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2 font-primary">No hay tipos de documento</h3>
                <p className="text-muted-foreground mb-4 font-secondary">
                  Crea tu primer tipo de documento para comenzar a procesar archivos
                </p>
                <Button className="rounded-full" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Tipo de Documento
                </Button>
              </Card>
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="relative mb-6 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tipos de documento..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
                {filteredTypes.map((type) => (
                  <Card
                    key={type.id}
                    className={cn(
                      "rounded-2xl cursor-pointer transition-all hover:shadow-md group",
                      selectedType?.id === type.id
                        ? "ring-2 ring-primary shadow-md"
                        : "hover:ring-1 hover:ring-primary/30"
                    )}
                    onClick={() => handleCardClick(type)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3 gap-2 min-w-0">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold font-primary text-sm truncate break-words">{type.name}</h3>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(type)
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(type)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground font-secondary line-clamp-2 mb-4 min-h-[2.5rem]">
                        {type.description || "Sin descripcion"}
                      </p>

                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-secondary">
                          {type.fieldSchema.fields.length} campos
                        </Badge>
                        {(type as any).documentCount !== undefined && (
                          <Badge variant="outline" className="text-xs font-secondary">
                            {(type as any).documentCount} documentos
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredTypes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground font-secondary">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No se encontraron tipos de documento que coincidan con tu busqueda.</p>
                </div>
              )}

              {/* Selected Type Detail — Fields Table */}
              {selectedType && (
                <Card className="rounded-2xl max-h-[calc(100vh-220px)] flex flex-col overflow-hidden">
                  <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold font-primary">
                        Campos de: {selectedType.name}
                      </h2>
                      <Badge variant="secondary" className="text-xs">
                        {selectedType.fieldSchema.fields.length}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => handleEdit(selectedType)}
                      >
                        <Edit className="h-3.5 w-3.5 mr-1.5" />
                        Editar
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-auto flex-1">
                    {selectedType.fieldSchema.fields.length > 0 ? (
                      <div className="divide-y">
                        {selectedType.fieldSchema.fields.map((field, index) => (
                          <div key={index} className="px-4 py-3 space-y-1.5">
                            {/* Fila 1: nombre + tipo + requerido */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold">{field.label || field.name}</span>
                              {field.label && field.label !== field.name && (
                                <span className="text-xs text-muted-foreground font-mono">({field.name})</span>
                              )}
                              <Badge variant="outline" className="text-xs">{field.type}</Badge>
                              {field.required ? (
                                <Badge variant="destructive" className="text-xs">Requerido</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Opcional</Badge>
                              )}
                            </div>
                            {/* Fila 2: descripción */}
                            {field.description && (
                              <p className="text-xs text-muted-foreground leading-relaxed">{field.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground font-secondary">
                        Este tipo de documento no tiene campos definidos.
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <DocumentTypeModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        documentType={editingType}
        onSaved={handleTypeSaved}
      />

      <InferFromSamplesModal
        isOpen={isInferModalOpen}
        onClose={() => setIsInferModalOpen(false)}
        onSuccess={loadDocumentTypes}
      />
    </div>
  )
}
