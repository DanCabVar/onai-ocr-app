"use client"

import { Settings as SettingsIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Personaliza tu experiencia en ONAI OCR
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Opciones
          </CardTitle>
          <CardDescription>
            Próximamente podrás configurar tus preferencias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <SettingsIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Página de configuración en desarrollo</p>
            <p className="text-sm mt-2">
              Aquí podrás gestionar tus preferencias, notificaciones y más
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

