"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, Eye, EyeOff, ScanEye, CheckCircle2, Mail, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { authService } from "@/lib/api/auth.service"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ocr-app.moti.cl"

// ─── OTP Input Component ────────────────────────────────────────────────────

function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, "").split("").slice(0, 6)

  const handleChange = (index: number, char: string) => {
    const cleaned = char.replace(/\D/g, "").slice(-1)
    const next = [...digits]
    next[index] = cleaned
    const joined = next.join("").slice(0, 6)
    onChange(joined)
    if (cleaned && index < 5) {
      inputs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    onChange(text)
    const focusIdx = Math.min(text.length, 5)
    inputs.current[focusIdx]?.focus()
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          className="w-11 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:outline-none focus:border-primary disabled:opacity-50 bg-background border-input transition-colors"
        />
      ))}
    </div>
  )
}

// ─── Register Form ──────────────────────────────────────────────────────────

function RegisterForm({ onSuccess }: { onSuccess: (email: string) => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast({ title: "Error", description: "Por favor completa todos los campos requeridos", variant: "destructive" })
      return
    }
    if (password.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" })
      return
    }
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden", variant: "destructive" })
      return
    }

    try {
      setIsLoading(true)
      await authService.register({ email, password, name: name || undefined })
      onSuccess(email)
    } catch (error: any) {
      toast({
        title: "Error de registro",
        description: error.response?.data?.message || "Error al crear la cuenta",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md rounded-2xl border-0 shadow-none">
      <CardHeader className="space-y-2 pb-6">
        <div className="flex items-center gap-2 justify-center lg:hidden mb-4">
          <ScanEye className="h-8 w-8 text-primary" />
          <span className="text-2xl font-primary font-bold text-primary">ONAI OCR</span>
        </div>
        <CardTitle className="text-2xl font-primary font-bold">Crear Cuenta</CardTitle>
        <CardDescription className="font-secondary">Configura tus datos para seguir acá</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="font-secondary">Nombre</Label>
            <Input id="name" type="text" placeholder="Tu nombre completo" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} autoComplete="name" className="font-secondary" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="font-secondary">Email</Label>
            <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} autoComplete="email" required className="font-secondary" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="font-secondary">Contraseña</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} autoComplete="new-password" required className="pr-10 font-secondary" />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="font-secondary">Confirmar Contraseña</Label>
            <div className="relative">
              <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} autoComplete="new-password" required className="pr-10 font-secondary" />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={isLoading}>
                {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox id="terms" checked={acceptTerms} onCheckedChange={(checked) => setAcceptTerms(checked as boolean)} disabled={isLoading} />
            <Label htmlFor="terms" className="text-sm font-normal font-secondary cursor-pointer">Acepto los términos y condiciones</Label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 pt-4">
          <Button type="submit" className="w-full rounded-full font-secondary" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando cuenta...</> : "Crear Cuenta"}
          </Button>
          <div className="text-sm text-center text-muted-foreground font-secondary">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-primary hover:underline font-semibold">Inicia Sesión</Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

// ─── Verify Email Step ──────────────────────────────────────────────────────

function VerifyEmailStep({ email, onBack }: { email: string; onBack: () => void }) {
  const [code, setCode] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast({ title: "Error", description: "Ingresa los 6 dígitos del código", variant: "destructive" })
      return
    }
    try {
      setIsVerifying(true)
      const response = await authService.verifyEmail({ email, code })
      authService.saveAuth(response)
      toast({ title: "¡Email verificado!", description: "Redirigiendo al dashboard..." })

      const hostname = typeof window !== "undefined" ? window.location.hostname : ""
      if (hostname === "ocr.moti.cl") {
        window.location.href = `${APP_URL}/dashboard`
      } else {
        window.location.href = `${APP_URL}/dashboard`
      }
    } catch (error: any) {
      toast({
        title: "Código inválido",
        description: error.response?.data?.message || "El código es incorrecto o expiró",
        variant: "destructive",
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    try {
      setIsResending(true)
      await authService.resendVerification({ email })
      setCooldown(60)
      setCode("")
      toast({ title: "Código reenviado", description: "Revisa tu bandeja de entrada" })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "No se pudo reenviar el código",
        variant: "destructive",
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Card className="w-full max-w-md rounded-2xl border-0 shadow-none">
      <CardHeader className="space-y-2 pb-6 text-center">
        <div className="flex items-center gap-2 justify-center lg:hidden mb-4">
          <ScanEye className="h-8 w-8 text-primary" />
          <span className="text-2xl font-primary font-bold text-primary">ONAI OCR</span>
        </div>
        <div className="flex justify-center mb-2">
          <div className="bg-primary/10 rounded-full p-4">
            <Mail className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-primary font-bold">Verifica tu email</CardTitle>
        <CardDescription className="font-secondary">
          Enviamos un código de 6 dígitos a<br />
          <span className="font-semibold text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <OtpInput value={code} onChange={setCode} disabled={isVerifying} />
        <Button
          className="w-full rounded-full font-secondary"
          onClick={handleVerify}
          disabled={isVerifying || code.length !== 6}
        >
          {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</> : "Verificar código"}
        </Button>
        <div className="text-center space-y-2">
          {cooldown > 0 ? (
            <p className="text-sm text-muted-foreground font-secondary">
              Puedes reenviar en <span className="font-semibold text-foreground">{cooldown}s</span>
            </p>
          ) : (
            <Button variant="ghost" className="text-sm font-secondary" onClick={handleResend} disabled={isResending}>
              {isResending ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Reenviando...</> : "Reenviar código"}
            </Button>
          )}
          <div>
            <Button variant="ghost" size="sm" className="text-muted-foreground font-secondary" onClick={onBack}>
              <ArrowLeft className="h-3 w-3 mr-1" />
              Volver al registro
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const [step, setStep] = useState<"register" | "verify">("register")
  const [registeredEmail, setRegisteredEmail] = useState("")

  const handleRegistered = (email: string) => {
    setRegisteredEmail(email)
    setStep("verify")
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative flex-col justify-center items-center p-12 text-white">
        <div className="max-w-md space-y-8">
          <div className="flex items-center gap-3">
            <ScanEye className="h-10 w-10 text-white" />
            <span className="text-3xl font-primary font-bold text-white">ONAI OCR</span>
          </div>
          <p className="text-xl font-secondary text-white/90 leading-relaxed">
            Únete a la plataforma de procesamiento inteligente de documentos
          </p>
          <div className="space-y-4 pt-4">
            {[
              "Procesa documentos rápidamente",
              "Extracción automática de textos",
              "Clasificación inteligente con IA",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-white flex-shrink-0" />
                <span className="font-secondary text-white/90">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        {step === "register" ? (
          <RegisterForm onSuccess={handleRegistered} />
        ) : (
          <VerifyEmailStep email={registeredEmail} onBack={() => setStep("register")} />
        )}
      </div>
    </div>
  )
}
