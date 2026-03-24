"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Eye, EyeOff, ScanEye, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { authService } from "@/lib/api/auth.service"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      const response = await authService.login({ email, password })
      authService.saveAuth(response)

      toast({
        title: "¡Bienvenido!",
        description: `Has iniciado sesión como ${response.user.email}`,
      })

      router.push("/")
    } catch (error: any) {
      toast({
        title: "Error de autenticación",
        description: error.response?.data?.message || "Credenciales inválidas",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative flex-col justify-center items-center p-12 text-white">
        <div className="max-w-md space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <ScanEye className="h-10 w-10 text-white" />
            <span className="text-3xl font-primary font-bold text-white">ONAI OCR</span>
          </div>

          {/* Tagline */}
          <p className="text-xl font-secondary text-white/90 leading-relaxed">
            Procesamiento inteligente de documentos con IA
          </p>

          {/* Feature Bullets */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0" />
              <span className="font-secondary text-white/90">OCR con Mistral AI</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0" />
              <span className="font-secondary text-white/90">Clasificación automática con Gemini</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0" />
              <span className="font-secondary text-white/90">Integración con Google Drive</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md rounded-2xl border-0 shadow-none">
          <CardHeader className="space-y-2 pb-6">
            {/* Mobile logo */}
            <div className="flex items-center gap-2 justify-center lg:hidden mb-4">
              <ScanEye className="h-8 w-8 text-primary" />
              <span className="text-2xl font-primary font-bold text-primary">ONAI OCR</span>
            </div>
            <CardTitle className="text-2xl font-primary font-bold">Iniciar Sesión</CardTitle>
            <CardDescription className="font-secondary">
              Ingrese tus credenciales para continuar
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="font-secondary">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  className="font-secondary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-secondary">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="pr-10 font-secondary"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    disabled={isLoading}
                  />
                  <Label
                    htmlFor="remember"
                    className="text-sm font-normal font-secondary cursor-pointer"
                  >
                    Recordarme
                  </Label>
                </div>
                <Link
                  href="#"
                  className="text-sm text-primary hover:underline font-secondary"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-4">
              <Button
                type="submit"
                className="w-full rounded-full font-secondary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
              <div className="text-sm text-center text-muted-foreground font-secondary">
                ¿No tienes cuenta?{" "}
                <Link href="/register" className="text-primary hover:underline font-semibold">
                  Regístrate
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
