"use client"

import { useEffect, useState } from "react"
import { Calendar, FileText, Mail, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authService } from "@/lib/api/auth.service"
import { useToast } from "@/hooks/use-toast"

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    const storedUser = authService.getStoredUser()
    setUser(storedUser)
    if (storedUser) {
      setFormName(storedUser.name || "")
      setFormEmail(storedUser.email || "")
    }
  }, [])

  const handleCancel = () => {
    if (user) {
      setFormName(user.name || "")
      setFormEmail(user.email || "")
    }
    setCurrentPassword("")
    setNewPassword("")
  }

  const handleSave = () => {
    toast({
      title: "Funcionalidad proximamente",
      description: "La edicion de perfil estara disponible pronto.",
    })
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-primary">Mi Perfil</h1>
        </div>
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <User className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium font-primary">Sesión no disponible</p>
            <p className="text-sm text-muted-foreground font-secondary text-center max-w-md">
              No se encontraron datos de usuario. Inicia sesión para ver tu perfil.
            </p>
            <Button className="rounded-full mt-2" onClick={() => window.location.href = "/login"}>
              Iniciar Sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const initials = (user.name || "U").charAt(0).toUpperCase()
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })
    : "N/A"

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-primary">Mi Perfil</h1>
        <p className="text-muted-foreground mt-1 font-secondary">
          Gestiona tu informacion personal y configuracion de cuenta
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card — Profile Summary */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="font-primary">Resumen del Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar + Name + Badge */}
            <div className="flex flex-col items-center text-center gap-3 pb-4 border-b">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground text-3xl font-bold">
                {initials}
              </div>
              <div>
                <p className="text-xl font-semibold font-primary">{user.name}</p>
                <p className="text-sm text-muted-foreground font-secondary">{user.email}</p>
              </div>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">
                Administrador
              </Badge>
            </div>

            {/* Info Rows */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-secondary">Nombre</p>
                  <p className="text-sm font-medium font-secondary truncate">{user.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-secondary">Email</p>
                  <p className="text-sm font-medium font-secondary truncate">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-secondary">Miembro desde</p>
                  <p className="text-sm font-medium font-secondary">{memberSince}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-secondary">Documentos procesados</p>
                  <p className="text-sm font-medium font-secondary">{user.documentsProcessed ?? "N/A"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Card — Edit Form */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="font-primary">Editar Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="font-secondary">Nombre completo</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Tu nombre completo"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="font-secondary">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="tu@email.com"
              />
            </div>

            {/* Change Password Section */}
            <div className="pt-4 border-t space-y-4">
              <h3 className="text-sm font-semibold font-primary">Cambiar Contrasena</h3>

              <div className="space-y-2">
                <Label htmlFor="current-password" className="font-secondary">Contrasena actual</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Ingresa tu contrasena actual"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="font-secondary">Nueva contrasena</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimo 8 caracteres"
                />
                <p className="text-xs text-muted-foreground">Minimo 8 caracteres</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" className="rounded-full" onClick={handleCancel}>
                Cancelar
              </Button>
              <Button className="rounded-full" onClick={handleSave}>
                Guardar Cambios
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
