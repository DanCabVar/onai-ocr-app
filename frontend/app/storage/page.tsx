"use client"

import { HardDrive } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function StoragePage() {
  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-2xl font-semibold font-primary tracking-tight">Almacenamiento</h1>
          <p className="text-sm text-muted-foreground font-secondary mt-1">
            Gestiona el almacenamiento de tus documentos
          </p>
        </div>

        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-12 text-center">
            <HardDrive className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2 font-primary">Próximamente</h3>
            <p className="text-muted-foreground font-secondary max-w-md mx-auto">
              La integración de almacenamiento estará disponible pronto. Podrás conectar Google Drive, 
              S3 y otros servicios para organizar tus documentos procesados.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
