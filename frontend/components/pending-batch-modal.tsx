"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, FileText, Plus, Loader2, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { documentsService, BatchDocumentResult } from "@/lib/api/documents.service"
import { documentTypesService } from "@/lib/api/document-types.service"
import { cn } from "@/lib/utils"

interface InferredType {
  name: string
  schema: Array<{ name: string; label?: string; type: string; required?: boolean; description?: string }>
  docCount: number
}

interface PendingDoc {
  documentId: number
  filename: string
  suggestedType: string
  confidence?: number
}

interface PendingBatchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inferredTypes: InferredType[]
  pendingDocs: PendingDoc[]
  existingTypes: Array<{ id: number; name: string }>
  onSuccess: () => void
}

export function PendingBatchModal({
  open,
  onOpenChange,
  inferredTypes,
  pendingDocs,
  existingTypes,
  onSuccess,
}: PendingBatchModalProps) {
  const { toast } = useToast()
  const [selectedType, setSelectedType] = useState<InferredType | null>(null)
  // assignments: docId → typeName
  const [assignments, setAssignments] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Initialize assignments from suggestedType
  useEffect(() => {
    if (open && pendingDocs.length > 0) {
      const init: Record<number, string> = {}
      pendingDocs.forEach(doc => { init[doc.documentId] = doc.suggestedType })
      setAssignments(init)
      if (inferredTypes.length > 0) setSelectedType(inferredTypes[0])
    }
  }, [open, pendingDocs, inferredTypes])

  // All type options: inferred new + existing
  const allTypeOptions = [
    ...inferredTypes.map(t => ({ id: undefined as number | undefined, name: t.name, isNew: true })),
    ...existingTypes.filter(e => !inferredTypes.find(t => t.name === e.name)).map(e => ({ id: e.id, name: e.name, isNew: false })),
  ]

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const assignmentList = Object.entries(assignments).map(([docId, typeName]) => {
        const existing = existingTypes.find(t => t.name === typeName)
        return { documentId: Number(docId), typeName, typeId: existing?.id }
      })
      const response = await documentsService.resolvePendingBatch(assignmentList)
      toast({
        title: "¡Procesado!",
        description: `${response.completed} de ${response.total} documentos clasificados y extraídos correctamente.`,
      })
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.response?.data?.message || err.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const typeSchemaToShow = selectedType
    ? inferredTypes.find(t => t.name === selectedType.name)
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="font-primary text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-amber-500" />
            Clasificar documentos sin tipo
          </DialogTitle>
          <DialogDescription>
            {inferredTypes.length > 0
              ? `La IA identificó ${inferredTypes.length} tipo(s) nuevo(s) para ${pendingDocs.length} documento(s). Revisa y confirma.`
              : `${pendingDocs.length} documento(s) pendientes de clasificación.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">

          {/* Columna izquierda — Tipos inferidos */}
          {inferredTypes.length > 0 && (
            <div className="md:w-72 border-b md:border-b-0 md:border-r flex flex-col min-h-0">
              <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                Tipos nuevos inferidos
              </div>
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {inferredTypes.map(type => (
                    <button
                      key={type.name}
                      onClick={() => setSelectedType(type)}
                      className={cn(
                        "w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-accent transition-colors",
                        selectedType?.name === type.name && "bg-primary/10 border-l-2 border-l-primary"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{type.name}</p>
                        <p className="text-xs text-muted-foreground">{type.schema.length} campos · {type.docCount} doc(s)</p>
                      </div>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", selectedType?.name === type.name && "rotate-90 text-primary")} />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Columna central — Schema del tipo seleccionado */}
          {inferredTypes.length > 0 && (
            <div className="md:w-72 border-b md:border-b-0 md:border-r flex flex-col min-h-0">
              <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                {selectedType ? `Esquema: ${selectedType.name}` : "Selecciona un tipo"}
              </div>
              <ScrollArea className="flex-1">
                {typeSchemaToShow && typeSchemaToShow.schema.length > 0 ? (
                  <div className="divide-y">
                    {typeSchemaToShow.schema.map((field, i) => (
                      <div key={i} className="px-4 py-2.5 space-y-0.5">
                        <p className="text-sm font-medium leading-tight">{field.label || field.name}</p>
                        {field.label && field.label !== field.name && (
                          <p className="text-xs text-muted-foreground font-mono">({field.name})</p>
                        )}
                        <div className="flex gap-1.5 mt-1">
                          <Badge variant="outline" className="text-xs">{field.type}</Badge>
                          {field.required && <Badge variant="destructive" className="text-xs">Req.</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {selectedType ? "Sin campos inferidos" : "Selecciona un tipo para ver su esquema"}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Columna derecha — Documentos con selector */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
              Documentos pendientes ({pendingDocs.length})
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {pendingDocs.map(doc => (
                  <div key={doc.documentId} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium truncate flex-1">{doc.filename}</p>
                      {doc.confidence && (
                        <span className="text-xs text-muted-foreground shrink-0">{Math.round(doc.confidence * 100)}%</span>
                      )}
                    </div>
                    <select
                      value={assignments[doc.documentId] ?? doc.suggestedType}
                      onChange={e => setAssignments(prev => ({ ...prev, [doc.documentId]: e.target.value }))}
                      className="w-full text-sm border rounded-md px-2 py-1.5 bg-background"
                    >
                      {allTypeOptions.map(opt => (
                        <option key={opt.name} value={opt.name}>
                          {opt.isNew ? "✨ " : ""}{opt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

        </div>

        {/* Footer — acciones */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => {
              // Abrir modal de nuevo tipo — emitir evento
              window.dispatchEvent(new CustomEvent("openNewTypeModal"))
            }}>
              <Plus className="h-4 w-4" />
              Nuevo tipo manual
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Procesando..." : `Aceptar y extraer (${pendingDocs.length} docs)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
