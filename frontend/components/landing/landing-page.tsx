"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ScanEye, FileSearch, BrainCircuit, Database, MessageSquareText,
  Upload, Cpu, Search, Check, ChevronDown, ArrowRight,
  Twitter, Github, Linkedin, Mail
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LandingHeader } from "./landing-header"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ocr-app.moti.cl"

/* ═══════════════════════════════ HERO ═══════════════════════════════ */
function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-16 overflow-hidden">
      {/* Gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium animate-fade-in">
          <ScanEye className="w-4 h-4" />
          Potenciado por IA de última generación
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight animate-fade-in-up">
          Procesamiento Inteligente
          <br />
          <span className="text-primary">de Documentos con IA</span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-fade-in-up animation-delay-200">
          Clasifica, extrae datos y consulta tus documentos usando inteligencia artificial.
          Sin templates rígidos. Sin configuración manual.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-400">
          <a href={`${APP_URL}/register`}>
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8 h-12 gap-2">
              Comenzar Gratis
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
          <a href="#how-it-works">
            <Button size="lg" variant="outline" className="text-base px-8 h-12">
              Ver Demo
            </Button>
          </a>
        </div>

        <p className="mt-4 text-sm text-muted-foreground animate-fade-in-up animation-delay-400">
          Sin tarjeta de crédito · 50 documentos gratis · Configuración en 2 minutos
        </p>
      </div>
    </section>
  )
}

/* ═══════════════════════════════ TRUST ═══════════════════════════════ */
function TrustSection() {
  const logos = ["Empresa A", "Empresa B", "Empresa C", "Empresa D", "Empresa E"]
  return (
    <section className="py-16 border-y border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <p className="text-center text-sm text-muted-foreground mb-8 uppercase tracking-wider">
          Empresas que confían en nosotros
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16">
          {logos.map((name) => (
            <div
              key={name}
              className="text-muted-foreground/40 font-primary text-lg font-bold select-none"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════ FEATURES ═══════════════════════════════ */
const features = [
  {
    icon: FileSearch,
    title: "OCR Multimodal",
    description: "Extrae texto de PDFs, imágenes, facturas escaneadas y más. Soporte para múltiples idiomas y formatos.",
  },
  {
    icon: BrainCircuit,
    title: "Clasificación Automática",
    description: "La IA identifica y clasifica tus documentos automáticamente. Sin reglas manuales, sin templates.",
  },
  {
    icon: Database,
    title: "Extracción de Datos",
    description: "Extrae campos estructurados (montos, fechas, RUTs, etc.) y expórtalos a tu sistema.",
  },
  {
    icon: MessageSquareText,
    title: "Chat SQL sobre Datos",
    description: "Pregunta en lenguaje natural y obtén respuestas de tus documentos procesados. Como hablarle a tu base de datos.",
  },
]

function FeaturesSection() {
  return (
    <section id="features" className="py-24 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">Todo lo que necesitas</h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            Una plataforma completa para gestionar tus documentos con inteligencia artificial
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <Card
              key={f.title}
              className="group bg-card/50 border-border/50 hover:border-primary/30 hover:bg-card transition-all duration-300"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════ HOW IT WORKS ═══════════════════════════════ */
const steps = [
  {
    icon: Upload,
    number: "01",
    title: "Sube tus documentos",
    description: "Arrastra y suelta tus archivos — PDFs, imágenes, facturas, boletas. Procesamos cualquier formato.",
  },
  {
    icon: Cpu,
    number: "02",
    title: "La IA los procesa",
    description: "Nuestros modelos de IA clasifican, extraen texto y estructuran los datos automáticamente.",
  },
  {
    icon: Search,
    number: "03",
    title: "Consulta tus datos",
    description: "Busca, filtra y pregunta en lenguaje natural. Exporta a CSV, JSON o conecta vía API.",
  },
]

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-muted/30 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold">Cómo funciona</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Tres pasos simples para transformar tus documentos en datos estructurados
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, i) => (
            <div key={step.number} className="relative text-center">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px border-t-2 border-dashed border-border" />
              )}
              <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-primary/10 mb-6">
                <step.icon className="w-10 h-10 text-primary" />
                <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {step.number}
                </span>
              </div>
              <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════ PRICING ═══════════════════════════════ */
const plans = [
  {
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    docs: "50 docs/mes",
    description: "Para probar la plataforma",
    features: ["50 documentos/mes", "OCR básico", "1 tipo de documento", "Chat SQL limitado", "Soporte email"],
    cta: "Comenzar Gratis",
    highlighted: false,
  },
  {
    name: "Starter",
    monthlyPrice: 29,
    yearlyPrice: 24,
    docs: "500 docs/mes",
    description: "Para pequeños equipos",
    features: ["500 documentos/mes", "OCR multimodal", "5 tipos de documento", "Chat SQL completo", "API REST", "Soporte prioritario"],
    cta: "Comenzar",
    highlighted: false,
  },
  {
    name: "Pro",
    monthlyPrice: 49,
    yearlyPrice: 41,
    docs: "1,000 docs/mes",
    description: "Para empresas en crecimiento",
    features: ["1,000 documentos/mes", "OCR multimodal avanzado", "Tipos ilimitados", "Chat SQL + exportación", "API REST + webhooks", "Soporte dedicado", "SLA 99.9%"],
    cta: "Comenzar",
    highlighted: true,
  },
  {
    name: "Enterprise",
    monthlyPrice: -1,
    yearlyPrice: -1,
    docs: "Ilimitado",
    description: "Para grandes operaciones",
    features: ["Documentos ilimitados", "Modelos IA personalizados", "On-premise disponible", "Integraciones custom", "Account manager", "SLA personalizado", "Facturación a medida"],
    cta: "Contactar Ventas",
    highlighted: false,
  },
]

function PricingSection() {
  const [yearly, setYearly] = useState(false)

  return (
    <section id="pricing" className="py-24 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">Planes y Precios</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Empieza gratis, escala cuando lo necesites
          </p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-muted rounded-full p-1">
            <button
              onClick={() => setYearly(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                !yearly ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                yearly ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anual
              <span className="ml-1.5 text-xs opacity-80">-17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const price = yearly ? plan.yearlyPrice : plan.monthlyPrice
            return (
              <Card
                key={plan.name}
                className={`relative flex flex-col ${
                  plan.highlighted
                    ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
                    : "border-border/50"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    Más Popular
                  </div>
                )}
                <CardHeader className="pb-4">
                  <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                  <div className="mt-2">
                    {price === -1 ? (
                      <span className="text-3xl font-bold">Custom</span>
                    ) : price === 0 ? (
                      <span className="text-3xl font-bold">$0</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold">${price}</span>
                        <span className="text-muted-foreground text-sm">/mes</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <a href={plan.name === "Enterprise" ? "#cta" : `${APP_URL}/register`} className="mt-6">
                    <Button
                      className={`w-full ${
                        plan.highlighted
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : ""
                      }`}
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </a>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════ FAQ ═══════════════════════════════ */
const faqs = [
  {
    q: "¿Qué tipos de documentos puedo procesar?",
    a: "Soportamos PDFs, imágenes (JPG, PNG), facturas electrónicas (XML), boletas, contratos, y más. Nuestro OCR multimodal se adapta a cualquier formato.",
  },
  {
    q: "¿Necesito entrenar la IA con mis documentos?",
    a: "No. Nuestros modelos pre-entrenados entienden documentos desde el primer upload. Si necesitas mayor precisión, puedes definir tipos de documento personalizados.",
  },
  {
    q: "¿Qué tan seguro es subir mis documentos?",
    a: "Todos los datos se transmiten con TLS y se almacenan encriptados. No compartimos ni usamos tus documentos para entrenar modelos. Cumplimos con estándares de seguridad enterprise.",
  },
  {
    q: "¿Puedo integrar ONAI OCR con mi sistema actual?",
    a: "Sí. Ofrecemos API REST completa, webhooks para notificaciones en tiempo real, y exportación a CSV/JSON. Plan Enterprise incluye integraciones custom.",
  },
  {
    q: "¿Cómo funciona el Chat SQL?",
    a: "Es como hablarle a tu base de datos. Pregunta en español (o inglés) cosas como '¿Cuánto gasté en facturas de proveedores en marzo?' y obtendrás respuestas de tus documentos procesados.",
  },
  {
    q: "¿Puedo cambiar de plan en cualquier momento?",
    a: "Sí, puedes subir o bajar de plan cuando quieras. Los cambios se aplican en el siguiente ciclo de facturación. Sin contratos de permanencia.",
  },
]

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="py-24 bg-muted/30 scroll-mt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">Preguntas Frecuentes</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            ¿Dudas? Aquí las respuestas más comunes
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-border/50 rounded-lg overflow-hidden bg-card/50"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-accent/50 transition-colors"
              >
                <span className="font-medium pr-4">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === i ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <p className="px-5 pb-5 text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════ CTA FINAL ═══════════════════════════════ */
function CTASection() {
  return (
    <section id="cta" className="py-24 scroll-mt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="relative p-12 sm:p-16 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
          <h2 className="text-3xl sm:text-4xl font-bold">Empieza gratis hoy</h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            Crea tu cuenta en 30 segundos. Sin tarjeta de crédito. 50 documentos gratis cada mes.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="tu@email.com"
              className="h-12 bg-background"
            />
            <a href={`${APP_URL}/register`}>
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-8 whitespace-nowrap">
                Crear Cuenta
              </Button>
            </a>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Al registrarte aceptas nuestros{" "}
            <a href="#" className="underline hover:text-foreground">Términos de Servicio</a>{" "}
            y{" "}
            <a href="#" className="underline hover:text-foreground">Política de Privacidad</a>
          </p>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════ FOOTER ═══════════════════════════════ */
function Footer() {
  return (
    <footer className="border-t border-border/50 bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <ScanEye className="w-6 h-6 text-primary" />
              <span className="font-primary text-base font-bold text-primary">ONAI OCR</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Procesamiento inteligente de documentos con IA. Por ONAI.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="mailto:contacto@onai.cl" className="text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Producto</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">Características</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">Precios</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">API Docs</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Changelog</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Empresa</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Sobre Nosotros</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Contacto</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Trabaja con Nosotros</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Términos de Servicio</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Privacidad</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Cookies</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">SLA</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ONAI. Todos los derechos reservados.
          </p>
          <p className="text-sm text-muted-foreground">
            Hecho con ❤️ en Chile 🇨🇱
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ═══════════════════════════════ MAIN ═══════════════════════════════ */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />
      <HeroSection />
      <TrustSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  )
}
