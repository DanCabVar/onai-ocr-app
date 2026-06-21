"use client"

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DocumentTypesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("document-types route error", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
        <h2 className="mb-2 text-xl font-semibold font-primary">Ocurrió un problema en Tipos de Documento</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          La vista falló mientras cargaba o procesaba la acción. Puedes reintentar sin salir de la página.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>Reintentar</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Recargar página
          </Button>
        </div>
      </div>
    </div>
  )
}
