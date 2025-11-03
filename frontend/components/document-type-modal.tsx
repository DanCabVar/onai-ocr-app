"use client"

import { useState, useEffect, useRef, KeyboardEvent } from "react"
import { Plus, Trash2, Loader2, ClipboardPaste, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  documentTypesService,
  DocumentType,
  FieldDefinition,
} from "@/lib/api/document-types.service"
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert"

interface DocumentTypeModalProps {
  open: boolean
  onClose: () => void
  documentType?: DocumentType | null
  onSaved: () => void
}

export function DocumentTypeModal({
  open,
  onClose,
  documentType,
  onSaved,
}: DocumentTypeModalProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [fields, setFields] = useState<FieldDefinition[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null)
  const { toast } = useToast()

  // Cargar datos cuando se edita un tipo existente
  useEffect(() => {
    if (documentType) {
      setName(documentType.name)
      setDescription(documentType.description || "")
      setFields(documentType.fieldSchema.fields)
    } else {
      // Reset form
      setName("")
      setDescription("")
      setFields([])
    }
  }, [documentType, open])

  // Agregar nuevo campo
  const addField = () => {
    setFields([
      ...fields,
      {
        name: "",
        type: "string",
        label: "",
        required: false,
        description: "",
      },
    ])
  }

  // Eliminar campo
  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  // Actualizar campo
  const updateField = (index: number, updates: Partial<FieldDefinition>) => {
    setFields(
      fields.map((field, i) => (i === index ? { ...field, ...updates } : field))
    )
  }

  // Pegar desde Excel
  const handlePaste = (e: React.ClipboardEvent, rowIndex?: number) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const rows = pastedData.split("\n").filter((row) => row.trim())

    const newFields: FieldDefinition[] = rows.map((row) => {
      const columns = row.split("\t")
      
      // Mapear tipo de dato
      let fieldType: any = "string"
      const typeStr = columns[2]?.trim().toLowerCase()
      if (typeStr === "numero" || typeStr === "number") fieldType = "number"
      else if (typeStr === "fecha" || typeStr === "date") fieldType = "date"
      else if (typeStr === "booleano" || typeStr === "boolean") fieldType = "boolean"
      else if (typeStr === "lista" || typeStr === "array") fieldType = "array"
      else if (typeStr === "texto" || typeStr === "string") fieldType = "string"

      // Mapear requerido
      const requiredStr = columns[3]?.trim().toLowerCase()
      const isRequired = requiredStr === "si" || requiredStr === "sí" || requiredStr === "true" || requiredStr === "1"

      return {
        name: columns[0]?.trim() || "",
        label: columns[1]?.trim() || columns[0]?.trim() || "",
        type: fieldType,
        required: isRequired,
        description: columns[4]?.trim() || "",
      }
    })

    if (newFields.length > 0) {
      if (rowIndex !== undefined) {
        // Reemplazar desde la fila específica
        const newAllFields = [...fields]
        newFields.forEach((field, i) => {
          if (rowIndex + i < newAllFields.length) {
            newAllFields[rowIndex + i] = field
          } else {
            newAllFields.push(field)
          }
        })
        setFields(newAllFields)
      } else {
        // Agregar al final
        setFields([...fields, ...newFields])
      }

      toast({
        title: "Campos pegados",
        description: `Se agregaron/actualizaron ${newFields.length} campo(s) desde el portapapeles`,
      })
    }
  }

  // Guardar tipo de documento
  const handleSave = async () => {
    // Validaciones
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "El nombre es requerido",
        variant: "destructive",
      })
      return
    }

    if (fields.length === 0) {
      toast({
        title: "Error",
        description: "Debe definir al menos un campo",
        variant: "destructive",
      })
      return
    }

    // Validar que todos los campos tengan nombre y label
    for (const field of fields) {
      if (!field.name.trim() || !field.label.trim()) {
        toast({
          title: "Error",
          description: "Todos los campos deben tener nombre y etiqueta",
          variant: "destructive",
        })
        return
      }
    }

    try {
      setIsLoading(true)

      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        fields,
      }

      if (documentType) {
        await documentTypesService.update(documentType.id, data)
        toast({
          title: "Tipo actualizado",
          description: `El tipo "${name}" ha sido actualizado exitosamente`,
        })
      } else {
        await documentTypesService.create(data)
        toast({
          title: "Tipo creado",
          description: `El tipo "${name}" ha sido creado exitosamente`,
        })
      }

      onSaved()
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.response?.data?.message || "Error al guardar tipo de documento",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[60vw]! max-w-[60vw]! max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {documentType ? "Editar Tipo de Documento" : "Nuevo Tipo de Documento"}
          </DialogTitle>
          <DialogDescription>
            Define el tipo de documento y los campos que se extraerán automáticamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Nombre y Descripción */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del tipo *</Label>
              <Input
                id="name"
                placeholder="Ej: Factura, Orden de Compra..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Descripción (opcional) - {description.length}/300
              </Label>
              <Input
                id="description"
                placeholder="Describe el tipo de documento..."
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                maxLength={300}
                className="border-2"
              />
            </div>
          </div>

          {/* Info de formato Excel */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Copiar desde Excel:</strong> Selecciona celdas en Excel (Nombre | Etiqueta | Tipo | Requerido | Descripción) y pega con Ctrl+V en la tabla.
              <br />
              <span className="text-xs text-muted-foreground">
                Tipos válidos: texto/string, numero/number, fecha/date, booleano/boolean, lista/array
              </span>
            </AlertDescription>
          </Alert>

          {/* Grilla de Campos */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Campos a extraer *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addField}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Campo
              </Button>
            </div>

            {fields.length === 0 ? (
              <div
                className="text-center py-12 border-2 border-dashed rounded-lg"
                onPaste={(e) => handlePaste(e)}
              >
                <ClipboardPaste className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2">
                  No hay campos definidos
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Agrega campos manualmente o pega desde Excel (Ctrl+V)
                </p>
              </div>
            ) : (
              <div className="border rounded-md overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px] px-4">Nombre Campo *</TableHead>
                      <TableHead className="w-[280px] px-4">Etiqueta *</TableHead>
                      <TableHead className="w-[180px] px-4">Tipo *</TableHead>
                      <TableHead className="w-[140px] text-center px-4">Requerido</TableHead>
                      <TableHead className="w-[600px] px-4">Descripción (máx. 300 caracteres)</TableHead>
                      <TableHead className="w-[80px] px-4"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow
                        key={index}
                        onPaste={(e) => handlePaste(e, index)}
                      >
                        <TableCell className="w-[280px] py-3 px-4">
                          <Input
                            placeholder="numero_factura"
                            value={field.name}
                            onChange={(e) =>
                              updateField(index, { name: e.target.value })
                            }
                            className="h-8 w-full border-2"
                          />
                        </TableCell>
                        <TableCell className="w-[280px] py-3 px-4">
                          <Input
                            placeholder="Número de Factura"
                            value={field.label}
                            onChange={(e) =>
                              updateField(index, { label: e.target.value })
                            }
                            className="h-8 w-full border-2"
                          />
                        </TableCell>
                        <TableCell className="w-[180px] py-3 px-4">
                          <Select
                            value={field.type}
                            onValueChange={(value: any) =>
                              updateField(index, { type: value })
                            }
                          >
                            <SelectTrigger className="h-8 w-full border-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">Texto</SelectItem>
                              <SelectItem value="number">Número</SelectItem>
                              <SelectItem value="date">Fecha</SelectItem>
                              <SelectItem value="boolean">Booleano</SelectItem>
                              <SelectItem value="array">Lista</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="w-[140px] py-3 px-4">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={field.required}
                              onCheckedChange={(checked) =>
                                updateField(index, { required: checked === true })
                              }
                              className="size-5 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="w-[600px] py-3 px-4">
                          <Input
                            placeholder="Descripción opcional"
                            value={field.description || ""}
                            onChange={(e) =>
                              updateField(index, { description: e.target.value.slice(0, 300) })
                            }
                            maxLength={300}
                            className="h-8 w-full border-2"
                          />
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeField(index)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
