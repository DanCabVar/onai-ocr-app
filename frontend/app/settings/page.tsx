"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Settings as SettingsIcon,
  User,
  CreditCard,
  Palette,
  LogIn,
  Eye,
  EyeOff,
  Check,
  Crown,
  Loader2,
  Globe,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api/client"
import { authService } from "@/lib/api/auth.service"

interface UserData {
  id: number
  email: string
  name?: string
}

interface Subscription {
  plan: string
  documentsUsed: number
  documentsLimit: number
  price: number
}

interface Plan {
  id: string
  name: string
  price: number | null
  documentsLimit: number | null
  description: string
  features: string[]
}

const DEFAULT_PLANS: Plan[] = [
  {
    id: "free",
    name: "FREE",
    price: 0,
    documentsLimit: 50,
    description: "Para comenzar",
    features: ["50 documentos/mes", "OCR básico", "1 tipo de documento"],
  },
  {
    id: "starter",
    name: "STARTER",
    price: 29,
    documentsLimit: 500,
    description: "Para pequeños negocios",
    features: ["500 documentos/mes", "OCR avanzado", "5 tipos de documento", "Soporte email"],
  },
  {
    id: "pro",
    name: "PRO",
    price: 49,
    documentsLimit: 1000,
    description: "Para empresas en crecimiento",
    features: ["1.000 documentos/mes", "OCR avanzado + IA", "Tipos ilimitados", "Soporte prioritario", "API access"],
  },
  {
    id: "enterprise",
    name: "ENTERPRISE",
    price: null,
    documentsLimit: null,
    description: "Solución a medida",
    features: ["Documentos ilimitados", "IA personalizada", "SLA dedicado", "Soporte 24/7", "On-premise disponible"],
  },
]

export default function SettingsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  const [user, setUser] = useState<UserData | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Profile form
  const [name, setName] = useState("")
  const [savingName, setSavingName] = useState(false)

  // Password form
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Subscription
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS)
  const [loadingSub, setLoadingSub] = useState(false)

  useEffect(() => {
    setMounted(true)
    const storedUser = authService.getStoredUser()
    const authenticated = authService.isAuthenticated()
    setIsAuthenticated(authenticated)

    if (storedUser) {
      setUser(storedUser)
      setName(storedUser.name || "")
    }

    if (authenticated) {
      fetchSubscription()
      fetchPlans()
    }
  }, [])

  const fetchSubscription = async () => {
    setLoadingSub(true)
    try {
      const response = await apiClient.get("/subscriptions")
      const data = response.data
      // Map backend shape to frontend shape
      setSubscription({
        plan: (data.plan || "free").toUpperCase(),
        documentsUsed: data.docsUsed ?? data.documentsUsed ?? 0,
        documentsLimit: data.docsLimit === -1 ? Infinity : (data.docsLimit ?? data.documentsLimit ?? 50),
        price: data.price ?? 0,
      })
    } catch {
      // Use defaults if endpoint fails
      setSubscription({
        plan: "FREE",
        documentsUsed: 0,
        documentsLimit: 50,
        price: 0,
      })
    } finally {
      setLoadingSub(false)
    }
  }

  const fetchPlans = async () => {
    try {
      const response = await apiClient.get("/subscriptions/plans")
      if (response.data && Array.isArray(response.data)) {
        setPlans(response.data)
      }
    } catch {
      // Keep default plans
    }
  }

  const handleSaveName = async () => {
    if (!name.trim()) return
    setSavingName(true)
    try {
      await apiClient.patch("/auth/profile", { name: name.trim() })
      const updatedUser = { ...user!, name: name.trim() }
      setUser(updatedUser)
      localStorage.setItem("user", JSON.stringify(updatedUser))
      toast({ title: "Perfil actualizado", description: "Tu nombre se ha guardado correctamente." })
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el nombre.", variant: "destructive" })
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Error", description: "Completa todos los campos.", variant: "destructive" })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" })
      return
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" })
      return
    }

    setSavingPassword(true)
    try {
      await apiClient.patch("/auth/change-password", {
        currentPassword,
        newPassword,
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast({ title: "Contraseña actualizada", description: "Tu contraseña se ha cambiado correctamente." })
    } catch {
      toast({ title: "Error", description: "No se pudo cambiar la contraseña. Verifica tu contraseña actual.", variant: "destructive" })
    } finally {
      setSavingPassword(false)
    }
  }

  if (!mounted) return null

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="text-muted-foreground mt-1">Personaliza tu experiencia en ONAI OCR</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <LogIn className="h-16 w-16 text-muted-foreground/50" />
            <h2 className="text-xl font-semibold">Inicia sesión para continuar</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Necesitas una cuenta para acceder a la configuración, gestionar tu suscripción y personalizar tu experiencia.
            </p>
            <Button onClick={() => router.push("/login")} size="lg" className="mt-2">
              <LogIn className="mr-2 h-4 w-4" />
              Iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const usagePercent = subscription
    ? subscription.documentsLimit === Infinity || subscription.documentsLimit <= 0
      ? 0
      : Math.round((subscription.documentsUsed / subscription.documentsLimit) * 100)
    : 0

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-1">Personaliza tu experiencia en ONAI OCR</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Suscripción</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Preferencias</span>
          </TabsTrigger>
        </TabsList>

        {/* ==================== PERFIL ==================== */}
        <TabsContent value="profile" className="space-y-6">
          {/* Info usuario */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Información personal
              </CardTitle>
              <CardDescription>Gestiona tu información de perfil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ""} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">El email no se puede cambiar</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveName} disabled={savingName || !name.trim()}>
                  {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar nombre
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cambiar contraseña */}
          <Card>
            <CardHeader>
              <CardTitle>Cambiar contraseña</CardTitle>
              <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Contraseña actual</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleChangePassword}
                  disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                >
                  {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cambiar contraseña
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== SUSCRIPCIÓN ==================== */}
        <TabsContent value="subscription" className="space-y-6">
          {/* Plan actual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Tu plan actual
              </CardTitle>
              <CardDescription>Resumen de tu suscripción y uso</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSub ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : subscription ? (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-base px-3 py-1">
                        {subscription.plan}
                      </Badge>
                      <span className="text-2xl font-bold">
                        {subscription.price === 0
                          ? "Gratis"
                          : `$${subscription.price}/mes`}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Documentos procesados</span>
                      <span className="font-medium">
                        {subscription.documentsUsed} / {subscription.documentsLimit === Infinity ? "∞" : subscription.documentsLimit}
                      </span>
                    </div>
                    <Progress value={usagePercent} className="h-3" />
                    <p className="text-xs text-muted-foreground">
                      {subscription.documentsLimit === Infinity
                        ? `${subscription.documentsUsed} documentos procesados · Ilimitado`
                        : `${usagePercent}% utilizado · ${subscription.documentsLimit - subscription.documentsUsed} documentos restantes`}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No se pudo cargar la información del plan.</p>
              )}
            </CardContent>
          </Card>

          {/* Planes disponibles */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Planes disponibles</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => {
                const isCurrent = subscription?.plan?.toUpperCase() === plan.name.toUpperCase()
                const currentPlanIndex = plans.findIndex(
                  (p) => p.name.toUpperCase() === subscription?.plan?.toUpperCase()
                )
                const planIndex = plans.findIndex((p) => p.id === plan.id)
                const isUpgrade = planIndex > currentPlanIndex

                return (
                  <Card
                    key={plan.id}
                    className={`relative flex flex-col ${
                      isCurrent ? "border-primary ring-2 ring-primary/20" : ""
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">
                          <Check className="mr-1 h-3 w-3" />
                          Actual
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                      <div className="pt-2">
                        {plan.price !== null ? (
                          <span className="text-3xl font-bold">
                            ${plan.price}
                            <span className="text-sm font-normal text-muted-foreground">/mes</span>
                          </span>
                        ) : (
                          <span className="text-xl font-bold">Personalizado</span>
                        )}
                      </div>
                      {plan.documentsLimit && (
                        <p className="text-sm text-muted-foreground">
                          {plan.documentsLimit.toLocaleString()} documentos/mes
                        </p>
                      )}
                      {!plan.documentsLimit && plan.price === null && (
                        <p className="text-sm text-muted-foreground">Documentos ilimitados</p>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-2 text-sm">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <div className="p-4 pt-0 mt-auto">
                      {isCurrent ? (
                        <Button variant="outline" className="w-full" disabled>
                          Plan actual
                        </Button>
                      ) : isUpgrade ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="w-full">
                              <Button className="w-full" disabled>
                                <Crown className="mr-2 h-4 w-4" />
                                Upgrade
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Próximamente</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button variant="ghost" className="w-full" disabled>
                          —
                        </Button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        </TabsContent>

        {/* ==================== PREFERENCIAS ==================== */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Apariencia
              </CardTitle>
              <CardDescription>Personaliza el aspecto de la aplicación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Modo oscuro</Label>
                  <p className="text-sm text-muted-foreground">
                    Cambia entre tema claro y oscuro
                  </p>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>

              {/* Language selector */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Idioma
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Selecciona el idioma de la interfaz
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="px-3 py-1">
                    🇪🇸 Español
                  </Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="px-3 py-1 opacity-50 cursor-not-allowed">
                        🇺🇸 English
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Próximamente</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="px-3 py-1 opacity-50 cursor-not-allowed">
                        🇧🇷 Português
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Próximamente</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
