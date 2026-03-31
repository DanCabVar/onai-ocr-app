"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, FileText, Plus, Loader2, ChevronRight, LayoutList, Shapes } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { documentsService } from "@/lib/api/documents.service"
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
  const [activeTab, setActiveTab] = useState<"docs" | "types">("docs")

  useEffect(() => {
    if (open && pendingDocs.length > 0) {
      const init: Record<number, string> = {}
      pendingDocs.forEach(doc => { init[doc.documentId] = doc.suggestedType })
      setAssignments(init)
      if (inferredTypes.length > 0) setSelectedType(inferredTypes[0])
      setActiveTab("docs")
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
      if (response.processing) {
        toast({ title: "Procesando en segundo plano", description: `${response.total} documento(s) se están clasificando. Revisa la sección Documentos en unos momentos.` })
      } else {
        toast({ title: "¡Procesado!", description: `${response.completed} de ${response.total} documentos clasificados correctamente.` })
      }
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
      <DialogContent className="!w-[96vw] !max-w-[96vw] !h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">

        {/* ── HEADER ── */}
        <div className="px-5 pt-5 pb-0 border-b shrink-0">
          <div className="flex items-start gap-3 mb-3">
            <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight">Clasificar documentos del lote</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {inferredTypes.length > 0
                  ? `IA identificó ${inferredTypes.length} tipo(s) nuevo(s) para ${pendingDocs.length} documento(s).`
                  : `${pendingDocs.length} documentos pendientes de clasificar.`}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab("docs")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                activeTab === "docs"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-4 w-4" />
              Documentos ({pendingDocs.length})
            </button>
            {inferredTypes.length > 0 && (
              <button
                onClick={() => setActiveTab("types")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "types"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Shapes className="h-4 w-4" />
                Tipos inferidos ({inferredTypes.length})
              </button>
            )}
          </div>
        </div>

        {/* ── TAB DOCUMENTOS ── */}
        {activeTab === "docs" && (
          <ScrollArea className="flex-1 h-0">
            <div className="divide-y">
              {pendingDocs.map(doc => (
                <div key={doc.documentId} className="px-5 py-4">
                  {/* Filename + confidence */}
                  <div className="flex items-start gap-2 mb-3">
                    <FileText className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium break-words leading-snug">{doc.filename}</p>
                      {doc.confidence !== undefined && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Confianza IA: <span className="font-medium">{Math.round(doc.confidence * 100)}%</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Selector */}
                  <select
                    value={assignments[doc.documentId] ?? doc.suggestedType}
                    onChange={e => setAssignments(prev => ({ ...prev, [doc.documentId]: e.target.value }))}
                    className="w-full text-sm border rounded-md px-3 py-2 bg-background"
                  >
                    {allTypeOptions.filter(o => o.isNew).length > 0 && (
                      <optgroup label="✨ Tipos nuevos inferidos por IA">
                        {allTypeOptions.filter(o => o.isNew).map(opt => (
                          <option key={opt.name} value={opt.name}>{opt.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {allTypeOptions.filter(o => !o.isNew).length > 0 && (
                      <optgroup label="📁 Tipos existentes en el sistema">
                        {allTypeOptions.filter(o => !o.isNew).map(opt => (
                          <option key={opt.name} value={opt.name}>{opt.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* ── TAB TIPOS INFERIDOS ── */}
        {activeTab === "types" && (
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">

            {/* Lista de tipos — scroll propio */}
            <div className="md:w-72 shrink-0 md:border-r flex flex-col min-h-0 border-b md:border-b-0">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 shrink-0 border-b">
                Tipos — clic para ver esquema
              </div>
              <ScrollArea className="flex-1">
                <div className="divide-y">
                  {inferredTypes.map(type => (
                    <button
                      key={type.name}
                      onClick={() => setSelectedType(type)}
                      className={cn(
                        "w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-accent transition-colors",
                        selectedType?.name === type.name && "bg-primary/10 border-l-2 border-l-primary"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{type.name}</p>
                        <p className="text-xs text-muted-foreground">{type.schema.length} campos · {type.docCount} doc(s)</p>
                      </div>
                      <ChevronRight className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        selectedType?.name === type.name && "rotate-90 text-primary"
                      )} />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Tabla de esquema — scroll propio */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 shrink-0 border-b">
                {selectedType ? `Esquema: ${selectedType.name}` : "Selecciona un tipo para ver su esquema"}
              </div>
              <ScrollArea className="flex-1">
                {selectedSchema && selectedSchema.schema.length > 0 ? (
                  <>
                    {/* Desktop: tabla */}
                    <table className="w-full text-sm hidden sm:table">
                      <thead className="sticky top-0 bg-muted/80 z-10">
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
                              {field.required
                                ? <Badge variant="destructive" className="text-xs">Sí</Badge>
                                : <Badge variant="secondary" className="text-xs">No</Badge>}
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">{field.description || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Mobile: cards */}
                    <div className="flex sm:hidden flex-col gap-2 p-4">
                      {selectedSchema.schema.map((field, i) => (
                        <div key={i} className="rounded-lg border bg-card px-4 py-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold">{field.label || field.name}</p>
                            <div className="flex gap-1 shrink-0">
                              <Badge variant="outline" className="text-xs">{field.type}</Badge>
                              {field.required
                                ? <Badge variant="destructive" className="text-xs">Req.</Badge>
                                : <Badge variant="secondary" className="text-xs">Opc.</Badge>}
                            </div>
                          </div>
                          {field.label && field.label !== field.name && (
                            <p className="text-xs text-muted-foreground font-mono mb-1">({field.name})</p>
                          )}
                          {field.description && (
                            <p className="text-xs text-muted-foreground">{field.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-10 text-center text-sm text-muted-foreground">
                    {selectedType
                      ? "Sin campos inferidos para este tipo"
                      : "Selecciona un tipo de la lista para ver su esquema"}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="px-4 py-3 border-t shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          {pendingDocs.length > 0 && (
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2 w-full sm:w-auto sm:order-3">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Procesando..." : `Aceptar y extraer (${pendingDocs.length} docs)`}
            </Button>
          )}
          <div className="flex gap-2 sm:order-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button variant="outline" className="gap-2 flex-1 sm:flex-none" onClick={() => window.dispatchEvent(new CustomEvent("openNewTypeModal"))}>
              <Plus className="h-4 w-4" />Nuevo tipo manual
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}
