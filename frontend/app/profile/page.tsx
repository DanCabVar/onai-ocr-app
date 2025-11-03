"use client"

import { useEffect, useState } from "react"
import { User, Mail } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authService } from "@/lib/api/auth.service"

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const storedUser = authService.getStoredUser()
    setUser(storedUser)
  }, [])

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground mt-1">
          Información de tu cuenta
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
          <CardDescription>
            Detalles de tu cuenta en ONAI OCR
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
              <User className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="text-lg font-semibold">{user.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
              <Mail className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-lg font-semibold">{user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

