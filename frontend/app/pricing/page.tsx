"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Check,
  X,
  Zap,
  Crown,
  Building2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Shield,
  Headphones,
  Server,
  Brain,
  Clock,
  Download,
  Users,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

// ── Plan Data ──────────────────────────────────────────────────

interface Plan {
  name: string
  description: string
  monthlyPrice: number | null
  annualPrice: number | null
  docsPerMonth: string
  icon: React.ElementType
  popular?: boolean
  enterprise?: boolean
  features: string[]
  cta: string
  ctaLink: string
  color: string
  badgeColor: string
}

const plans: Plan[] = [
  {
    name: "Free",
    description: "Para comenzar a explorar el procesamiento de documentos con IA",
    monthlyPrice: 0,
    annualPrice: 0,
    docsPerMonth: "50",
    icon: FileText,
    features: [
      "50 documentos/mes",
      "OCR básico con IA",
      "Clasificación automática",
      "Exportación CSV",
      "1 tipo de documento",
      "Retención 30 días",
    ],
    cta: "Comenzar Gratis",
    ctaLink: "/register",
    color: "border-zinc-500/30",
    badgeColor: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  },
  {
    name: "Starter",
    description: "Para profesionales y pequeñas empresas con volumen moderado",
    monthlyPrice: 29,
    annualPrice: 278,
    docsPerMonth: "500",
    icon: Zap,
    features: [
      "500 documentos/mes",
      "OCR avanzado multi-modelo",
      "Clasificación + extracción",
      "Exportación CSV, JSON, Excel",
      "10 tipos de documento",
      "API access",
      "Retención 90 días",
      "Soporte email",
    ],
    cta: "Comenzar",
    ctaLink: "/register?plan=starter",
    color: "border-blue-500/30",
    badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  {
    name: "Pro",
    description: "Para empresas que necesitan procesamiento a escala con prioridad",
    monthlyPrice: 49,
    annualPrice: 470,
    docsPerMonth: "1.000",
    icon: Crown,
    popular: true,
    features: [
      "1.000 documentos/mes",
      "OCR avanzado multi-modelo",
      "Clasificación + extracción",
      "Todos los formatos de exportación",
      "Tipos de documento ilimitados",
      "API access completo",
      "Procesamiento prioritario",
      "Retención 1 año",
      "Webhooks",
      "Soporte prioritario",
    ],
    cta: "Comenzar",
    ctaLink: "/register?plan=pro",
    color: "border-purple-500/30",
    badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
  {
    name: "Enterprise",
    description: "Solución personalizada para grandes organizaciones",
    monthlyPrice: null,
    annualPrice: null,
    docsPerMonth: "Ilimitado",
    icon: Building2,
    enterprise: true,
    features: [
      "Documentos ilimitados",
      "Servidores dedicados",
      "Modelos open source on-premise",
      "SLA 99.9%",
      "SSO / SAML",
      "API sin rate limits",
      "Retención personalizada",
      "Account manager dedicado",
      "Integración personalizada",
      "Soporte 24/7",
    ],
    cta: "Contáctenos",
    ctaLink: "mailto:ventas@onai.cl",
    color: "border-amber-500/30",
    badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  },
]

// ── Feature Comparison ─────────────────────────────────────────

interface FeatureRow {
  feature: string
  icon: React.ElementType
  free: string | boolean
  starter: string | boolean
  pro: string | boolean
  enterprise: string | boolean
}

const comparisonFeatures: FeatureRow[] = [
  { feature: "Documentos / mes", icon: FileText, free: "50", starter: "500", pro: "1.000", enterprise: "Ilimitado" },
  { feature: "Tipos de documento", icon: FileText, free: "1", starter: "10", pro: "Ilimitado", enterprise: "Ilimitado" },
  { feature: "OCR con IA", icon: Brain, free: "Básico", starter: "Multi-modelo", pro: "Multi-modelo", enterprise: "Dedicado" },
  { feature: "Clasificación automática", icon: Sparkles, free: true, starter: true, pro: true, enterprise: true },
  { feature: "Extracción de datos", icon: Download, free: false, starter: true, pro: true, enterprise: true },
  { feature: "Exportación CSV", icon: Download, free: true, starter: true, pro: true, enterprise: true },
  { feature: "Exportación JSON/Excel", icon: Download, free: false, starter: true, pro: true, enterprise: true },
  { feature: "API Access", icon: Zap, free: false, starter: true, pro: true, enterprise: true },
  { feature: "Webhooks", icon: Zap, free: false, starter: false, pro: true, enterprise: true },
  { feature: "Procesamiento prioritario", icon: Clock, free: false, starter: false, pro: true, enterprise: true },
  { feature: "Servidores dedicados", icon: Server, free: false, starter: false, pro: false, enterprise: true },
  { feature: "SSO / SAML", icon: Shield, free: false, starter: false, pro: false, enterprise: true },
  { feature: "Modelos open source", icon: Brain, free: false, starter: false, pro: false, enterprise: true },
  { feature: "SLA", icon: Shield, free: "—", starter: "99%", pro: "99.5%", enterprise: "99.9%" },
  { feature: "Soporte", icon: Headphones, free: "Docs", starter: "Email", pro: "Prioritario", enterprise: "24/7 dedicado" },
  { feature: "Retención de datos", icon: Clock, free: "30 días", starter: "90 días", pro: "1 año", enterprise: "Personalizada" },
  { feature: "Usuarios", icon: Users, free: "1", starter: "3", pro: "10", enterprise: "Ilimitado" },
]

// ── FAQ ─────────────────────────────────────────────────────────

const faqItems = [
  {
    question: "¿Puedo cambiar de plan en cualquier momento?",
    answer: "Sí, puedes actualizar o degradar tu plan cuando quieras. Al actualizar, se te cobrará la diferencia prorrateada. Al degradar, el cambio se aplicará al siguiente ciclo de facturación.",
  },
  {
    question: "¿Qué pasa si supero el límite de documentos?",
    answer: "Te notificaremos cuando alcances el 80% de tu cuota. Si la superas, los documentos adicionales quedarán en cola hasta el siguiente período o puedes actualizar tu plan al instante.",
  },
  {
    question: "¿Qué métodos de pago aceptan?",
    answer: "Aceptamos tarjetas de crédito y débito (Visa, Mastercard, American Express) a través de Stripe. Para planes Enterprise, también ofrecemos facturación por transferencia bancaria.",
  },
  {
    question: "¿Hay un período de prueba?",
    answer: "El plan Free es gratuito para siempre con 50 documentos/mes. Además, los planes Starter y Pro incluyen 14 días de prueba gratis sin tarjeta de crédito.",
  },
  {
    question: "¿Qué modelos de IA utilizan?",
    answer: "Utilizamos una combinación de Mistral y Gemini para OCR y clasificación. En el plan Enterprise, ofrecemos la opción de modelos open source ejecutados en tu propia infraestructura para máxima privacidad.",
  },
  {
    question: "¿Mis datos están seguros?",
    answer: "Absolutamente. Todos los documentos se encriptan en tránsito (TLS 1.3) y en reposo (AES-256). No utilizamos tus documentos para entrenar modelos. Cumplimos con GDPR y las regulaciones de protección de datos chilenas.",
  },
  {
    question: "¿Puedo cancelar cuando quiera?",
    answer: "Sí, sin compromisos ni penalizaciones. Puedes cancelar desde tu panel de configuración. Mantendrás acceso hasta el final del período ya pagado.",
  },
]

// ── Page ────────────────────────────────────────────────────────

export default function PricingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 md:py-20">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/30">
            <Sparkles className="h-3 w-3 mr-1" />
            Pricing
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Planes para cada necesidad
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Desde freelancers hasta grandes empresas. Comienza gratis y escala cuando lo necesites.
          </p>

          {/* Toggle Mensual / Anual */}
          <div className="flex items-center justify-center gap-3">
            <Label
              htmlFor="billing-toggle"
              className={`text-sm cursor-pointer ${!annual ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              Mensual
            </Label>
            <Switch
              id="billing-toggle"
              checked={annual}
              onCheckedChange={setAnnual}
            />
            <Label
              htmlFor="billing-toggle"
              className={`text-sm cursor-pointer ${annual ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              Anual
            </Label>
            {annual && (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                20% descuento
              </Badge>
            )}
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto mb-20">
          {plans.map((plan) => {
            const Icon = plan.icon
            const price = plan.enterprise
              ? null
              : annual
              ? plan.annualPrice
              : plan.monthlyPrice

            return (
              <Card
                key={plan.name}
                className={`relative flex flex-col ${plan.color} ${
                  plan.popular ? "ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/10" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-purple-600 text-white border-0 shadow-lg">
                      Más popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-lg ${plan.popular ? "bg-purple-500/20" : "bg-muted"}`}>
                      <Icon className={`h-5 w-5 ${plan.popular ? "text-purple-400" : "text-muted-foreground"}`} />
                    </div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                  </div>
                  <CardDescription className="text-sm min-h-[40px]">{plan.description}</CardDescription>

                  <div className="pt-2">
                    {plan.enterprise ? (
                      <div className="text-2xl font-bold">Personalizado</div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">
                          ${annual ? Math.round((plan.annualPrice || 0) / 12) : plan.monthlyPrice}
                        </span>
                        <span className="text-muted-foreground text-sm">/mes</span>
                      </div>
                    )}
                    {annual && !plan.enterprise && plan.monthlyPrice! > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ${plan.annualPrice}/año (ahorras ${(plan.monthlyPrice! * 12 - plan.annualPrice!).toLocaleString("en-US")})
                      </p>
                    )}
                  </div>

                  <div className="pt-2">
                    <Badge variant="outline" className={plan.badgeColor}>
                      {plan.docsPerMonth} docs/mes
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-4">
                  <Button
                    asChild
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    size="lg"
                  >
                    <Link href={plan.ctaLink}>{plan.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="max-w-7xl mx-auto mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              Comparación detallada
            </h2>
            <p className="text-muted-foreground">
              Todas las features lado a lado
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-medium text-muted-foreground min-w-[200px]">Feature</th>
                      <th className="text-center p-4 font-medium min-w-[100px]">Free</th>
                      <th className="text-center p-4 font-medium min-w-[100px]">Starter</th>
                      <th className="text-center p-4 font-medium min-w-[100px]">
                        <span className="text-purple-400">Pro</span>
                      </th>
                      <th className="text-center p-4 font-medium min-w-[100px]">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonFeatures.map((row, idx) => {
                      const RowIcon = row.icon
                      return (
                        <tr key={row.feature} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                          <td className="p-4">
                            <div className="flex items-center gap-2 text-sm">
                              <RowIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                              {row.feature}
                            </div>
                          </td>
                          {(["free", "starter", "pro", "enterprise"] as const).map((plan) => (
                            <td key={plan} className="p-4 text-center">
                              {typeof row[plan] === "boolean" ? (
                                row[plan] ? (
                                  <Check className="h-4 w-4 text-green-500 mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-zinc-600 mx-auto" />
                                )
                              ) : (
                                <span className="text-sm">{row[plan]}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              Preguntas Frecuentes
            </h2>
            <p className="text-muted-foreground">
              Todo lo que necesitas saber sobre nuestros planes
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, idx) => (
              <AccordionItem key={idx} value={`faq-${idx}`}>
                <AccordionTrigger className="text-left text-sm md:text-base">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* CTA Bottom */}
        <div className="text-center mt-16 max-w-2xl mx-auto">
          <Card className="bg-gradient-to-br from-primary/5 via-background to-purple-500/5 border-primary/20">
            <CardContent className="p-8">
              <h3 className="text-xl md:text-2xl font-bold mb-2">¿Listo para automatizar tu procesamiento de documentos?</h3>
              <p className="text-muted-foreground mb-6">Comienza gratis, sin tarjeta de crédito. Actualiza cuando lo necesites.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg">
                  <Link href="/register">Comenzar Gratis</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="mailto:ventas@onai.cl">Hablar con Ventas</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
