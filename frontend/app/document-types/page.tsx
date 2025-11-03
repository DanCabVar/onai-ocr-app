"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, FileText, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
        <div className="flex justify-between items-center max-w-[2200px] mx-auto px-4">
          <div>
            <h1 className="text-3xl font-bold">Tipos de Documento</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona los tipos de documento y define qué campos extraer
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => setIsInferModalOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Nuevo tipo a partir de documentos
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tipo
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {documentTypes.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <Card className="p-12 text-center max-w-md">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No hay tipos de documento</h3>
              <p className="text-muted-foreground mb-4">
                Crea tu primer tipo de documento para comenzar a procesar archivos
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Tipo de Documento
              </Button>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6 p-6 max-w-[2200px] mx-auto">
            {/* Panel Izquierdo: Lista de Tipos */}
            <Card className="flex flex-col overflow-hidden h-fit max-h-[calc(100vh-200px)] min-w-0">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Tipos de Documento</h2>
              </div>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-6">Nombre</TableHead>
                      <TableHead className="px-6">Descripción</TableHead>
                      <TableHead className="w-[100px] text-center px-6">Campos</TableHead>
                      <TableHead className="w-[100px] text-right px-6">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentTypes.map((type) => (
                      <TableRow
                        key={type.id}
                        className={cn(
                          "cursor-pointer transition-colors group",
                          selectedType?.id === type.id 
                            ? "bg-primary hover:bg-primary" 
                            : "hover:bg-primary/90"
                        )}
                        onClick={() => setSelectedType(type)}
                      >
                        <TableCell className={cn(
                          "font-medium py-4 px-6",
                          selectedType?.id === type.id 
                            ? "text-white" 
                            : "group-hover:text-white"
                        )}>
                          {type.name}
                        </TableCell>
                        <TableCell className={cn(
                          "py-4 px-6 whitespace-normal max-w-[300px]",
                          selectedType?.id === type.id 
                            ? "text-white/90" 
                            : "text-muted-foreground group-hover:text-white/90"
                        )}>
                          {type.description || "Sin descripción"}
                        </TableCell>
                        <TableCell className="text-center py-4 px-6">
                          <Badge 
                            variant={selectedType?.id === type.id ? "default" : "secondary"}
                            className={cn(
                              selectedType?.id === type.id 
                                ? "bg-white/20 text-white"
                                : "group-hover:bg-white/20 group-hover:text-white"
                            )}
                          >
                            {type.fieldSchema.fields.length}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-4 px-6">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                selectedType?.id === type.id 
                                  ? "hover:bg-white/20 text-white"
                                  : "group-hover:text-white hover:bg-white/20"
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(type)
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                selectedType?.id === type.id 
                                  ? "hover:bg-white/20"
                                  : "hover:bg-white/20"
                              )}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(type)
                              }}
                            >
                              <Trash2 className={cn(
                                "h-4 w-4",
                                selectedType?.id === type.id 
                                  ? "text-white" 
                                  : "text-destructive group-hover:text-white"
                              )} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Panel Derecho: Campos del Tipo Seleccionado */}
            <Card className="flex flex-col overflow-hidden h-fit max-h-[calc(100vh-200px)] min-w-0">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">
                  {selectedType ? `Campos de: ${selectedType.name}` : "Selecciona un tipo"}
                </h2>
              </div>
              <div className="overflow-auto">
                {selectedType ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-6">Campo</TableHead>
                        <TableHead className="px-6">Etiqueta</TableHead>
                        <TableHead className="w-[120px] px-6">Tipo</TableHead>
                        <TableHead className="w-[100px] text-center px-6">Requerido</TableHead>
                        <TableHead className="px-6">Descripción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedType.fieldSchema.fields.map((field, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm py-4 px-6">{field.name}</TableCell>
                          <TableCell className="font-medium py-4 px-6">{field.label}</TableCell>
                          <TableCell className="py-4 px-6">
                            <Badge variant="outline">{field.type}</Badge>
                          </TableCell>
                          <TableCell className="text-center py-4 px-6">
                            {field.required ? (
                              <Badge variant="destructive">Sí</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm py-4 px-6 whitespace-normal max-w-[350px]">
                            {field.description || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Selecciona un tipo de documento para ver sus campos</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
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
