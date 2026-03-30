"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, FileText, Plus, Loader2, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
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

interface ProcessedDoc {
  filename: string
  typeName: string
  status: string
}

interface PendingBatchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inferredTypes: InferredType[]
  pendingDocs: PendingDoc[]
  processedDocs: ProcessedDoc[]
  existingTypes: Array<{ id: number; name: string }>
  onSuccess: () => void
}

export function PendingBatchModal({
  open, onOpenChange, inferredTypes, pendingDocs, processedDocs, existingTypes, onSuccess,
}: PendingBatchModalProps) {
  const { toast } = useToast()
  const [selectedType, setSelectedType] = useState<InferredType | null>(null)
  const [assignments, setAssignments] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<"pending" | "processed">("pending")

  useEffect(() => {
    if (open && pendingDocs.length > 0) {
      const init: Record<number, string> = {}
      pendingDocs.forEach(doc => { init[doc.documentId] = doc.suggestedType })
      setAssignments(init)
      if (inferredTypes.length > 0) setSelectedType(inferredTypes[0])
    }
  }, [open, pendingDocs, inferredTypes])

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
      toast({ title: "¡Procesado!", description: `${response.completed} de ${response.total} documentos clasificados correctamente.` })
      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      toast({ title: "Error", description: err?.response?.data?.message || err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const selectedSchema = selectedType ? inferredTypes.find(t => t.name === selectedType.name) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-[1400px] h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">

        {/* Header + tabs */}
        <div className="px-6 pt-5 pb-0 border-b shrink-0">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="font-primary text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-amber-500" />
                Clasificar documentos del lote
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {inferredTypes.length > 0 ? `IA identificó ${inferredTypes.length} tipo(s) para ${pendingDocs.length} doc(s) pendiente(s).` : `${pendingDocs.length} documentos pendientes.`}
                {processedDocs.length > 0 && ` · ${processedDocs.length} ya procesados.`}
              </p>
            </div>
          </div>
          <div className="flex gap-1 pt-3">
            <button onClick={() => setActiveTab("pending")} className={cn("px-4 py-1.5 text-sm rounded-t-lg font-medium border-b-2 transition-colors",
              activeTab === "pending" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              Pendientes ({pendingDocs.length})
            </button>
            {processedDocs.length > 0 && (
              <button onClick={() => setActiveTab("processed")} className={cn("px-4 py-1.5 text-sm rounded-t-lg font-medium border-b-2 transition-colors",
                activeTab === "processed" ? "border-green-500 text-green-600" : "border-transparent text-muted-foreground hover:text-foreground")}>
                ✅ Procesados ({processedDocs.length})
              </button>
            )}
          </div>
        </div>

        {/* TAB PENDIENTES */}
        {activeTab === "pending" && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">

            {/* Zona superior: tipos (izq) + docs (der) */}
            <div className="flex border-b" style={{ height: '45%' }}>

              {/* Izq: tipos inferidos */}
              {inferredTypes.length > 0 && (
                <div className="w-72 shrink-0 border-r flex flex-col min-h-0">
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 shrink-0">
                    Tipos inferidos — clic para ver esquema
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="divide-y">
                      {inferredTypes.map(type => (
                        <button key={type.name} onClick={() => setSelectedType(type)}
                          className={cn("w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-accent transition-colors",
                            selectedType?.name === type.name && "bg-primary/10 border-l-2 border-l-primary")}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{type.name}</p>
                            <p className="text-xs text-muted-foreground">{type.schema.length} campos · {type.docCount} doc(s)</p>
                          </div>
                          <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                            selectedType?.name === type.name && "rotate-90 text-primary")} />
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Der: docs con selector de tipo */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 shrink-0">
                  Documentos pendientes — selecciona tipo para cada uno
                </div>
                <ScrollArea className="flex-1">
                  <div className="divide-y">
                    {pendingDocs.map(doc => (
                      <div key={doc.documentId} className="px-4 py-3 flex items-center gap-3">
                        <FileText className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.filename}</p>
                          {doc.confidence && (
                            <p className="text-xs text-muted-foreground">Confianza: {Math.round(doc.confidence * 100)}%</p>
                          )}
                        </div>
                        <select
                          value={assignments[doc.documentId] ?? doc.suggestedType}
                          onChange={e => setAssignments(prev => ({ ...prev, [doc.documentId]: e.target.value }))}
                          className="text-sm border rounded-md px-2 py-1.5 bg-background min-w-[220px]"
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

            {/* Zona inferior: tabla schema */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 shrink-0">
                {selectedType ? `Esquema inferido: ${selectedType.name}` : "Selecciona un tipo arriba para ver su esquema"}
              </div>
              <ScrollArea className="flex-1">
                {selectedSchema && selectedSchema.schema.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/60 z-10">
                      <tr className="text-xs text-muted-foreground uppercase">
                        <th className="text-left px-4 py-2 font-semibold">Campo</th>
                        <th className="text-left px-4 py-2 font-semibold w-24">Tipo</th>
                        <th className="text-left px-4 py-2 font-semibold w-16">Req.</th>
                        <th className="text-left px-4 py-2 font-semibold">Descripción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedSchema.schema.map((field, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-4 py-2">
                            <p className="font-medium">{field.label || field.name}</p>
                            {field.label && field.label !== field.name && (
                              <p className="text-xs text-muted-foreground font-mono">({field.name})</p>
                            )}
                          </td>
                          <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{field.type}</Badge></td>
                          <td className="px-4 py-2">
                            {field.required ? <Badge variant="destructive" className="text-xs">Sí</Badge> : <Badge variant="secondary" className="text-xs">No</Badge>}
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs">{field.description || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {selectedType ? "Sin campos inferidos para este tipo" : "Selecciona un tipo arriba para ver su esquema"}
                  </div>
                )}
              </ScrollArea>
            </div>

          </div>
        )}

        {/* TAB PROCESADOS */}
        {activeTab === "processed" && (
          <div className="flex-1 overflow-hidden min-h-0">
            <ScrollArea className="h-full">
              <div className="divide-y px-2">
                {processedDocs.map((doc, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">Tipo: <span className="font-semibold">{doc.typeName}</span></p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">Completo</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => window.dispatchEvent(new CustomEvent("openNewTypeModal"))}>
              <Plus className="h-4 w-4" />Nuevo tipo manual
            </Button>
            {pendingDocs.length > 0 && (
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? "Procesando..." : `Aceptar y extraer (${pendingDocs.length} docs)`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
