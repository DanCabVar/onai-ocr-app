"use client"

import {
  HelpCircle, FileText, FolderOpen, Upload, Mail, Clock, MessageCircle,
  CheckCircle, Zap, Search, Download, Settings
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const quickStartSteps = [
  {
    step: 1,
    icon: <Settings className="h-5 w-5" />,
    title: "Define tus Tipos de Documento",
    description:
      'Ve a "Tipos de Documento" y crea un esquema con los campos que quieres extraer (ej: número de factura, fecha, monto).',
  },
  {
    step: 2,
    icon: <Upload className="h-5 w-5" />,
    title: "Sube tus Documentos",
    description:
      "Arrastra y suelta tus archivos PDF, JPG o PNG en la sección de documentos. Puedes subir varios a la vez.",
  },
  {
    step: 3,
    icon: <Zap className="h-5 w-5" />,
    title: "Procesamiento Automático",
    description:
      "El sistema procesa cada documento con OCR + IA, extrayendo automáticamente los campos definidos en tu esquema.",
  },
  {
    step: 4,
    icon: <Search className="h-5 w-5" />,
    title: "Revisa los Resultados",
    description:
      "Verifica los datos extraídos en la vista de detalle del documento. Puedes corregir manualmente si es necesario.",
  },
  {
    step: 5,
    icon: <Download className="h-5 w-5" />,
    title: "Exporta tus Datos",
    description:
      "Descarga los datos extraídos en formato CSV, JSON o Excel para integrarlos con tus sistemas.",
  },
]

const faqDocuments = [
  {
    id: "doc-1",
    question: "¿Qué formatos de archivo son compatibles?",
    answer: (
      <>
        Actualmente soportamos los siguientes formatos:
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li><strong>PDF</strong> (.pdf) — incluye PDFs escaneados e imágenes</li>
          <li><strong>JPEG</strong> (.jpg, .jpeg) — fotografías de documentos</li>
          <li><strong>PNG</strong> (.png) — capturas de pantalla y escaneos</li>
        </ul>
        <p className="mt-2 text-sm">Tamaño máximo por archivo: 20 MB. Para mejores resultados, usa escaneos de al menos 300 DPI.</p>
      </>
    ),
  },
  {
    id: "doc-2",
    question: "¿Cómo funciona el reconocimiento OCR?",
    answer:
      "El sistema utiliza la API de Mistral AI con modelos de visión avanzados para leer y comprender el contenido de tus documentos. El proceso es automático: subes un archivo y el sistema extrae texto e información estructurada en segundos.",
  },
  {
    id: "doc-3",
    question: "¿Cómo funciona la extracción automática de campos?",
    answer:
      "Una vez que defines un tipo de documento con sus campos, el sistema utiliza IA para analizar cada documento subido y extraer automáticamente los valores correspondientes a cada campo definido en el esquema. Funciona con cualquier formato de documento.",
  },
  {
    id: "doc-4",
    question: "¿Qué precisión tiene el OCR?",
    answer:
      "La precisión depende de la calidad del documento original. Con documentos bien escaneados (300+ DPI, buena iluminación, texto legible), la precisión típica es superior al 95%. Documentos con baja resolución, texto manuscrito o fondos complejos pueden tener menor precisión.",
  },
  {
    id: "doc-5",
    question: "¿Cuántos documentos puedo procesar?",
    answer:
      "Depende de tu plan. El plan gratuito incluye un número limitado de documentos al mes. Los planes de pago ofrecen límites más amplios. Puedes ver tu uso actual en la sección de Configuración > Suscripción.",
  },
]

const faqTypes = [
  {
    id: "type-1",
    question: "¿Qué son los Tipos de Documento?",
    answer:
      'Los Tipos de Documento te permiten definir qué campos quieres extraer automáticamente de tus documentos. Por ejemplo, puedes crear un tipo "Factura" con campos como número de factura, fecha, total, RUT del emisor, etc.',
  },
  {
    id: "type-2",
    question: "¿Cómo creo un nuevo tipo de documento?",
    answer: (
      <>
        Para crear un nuevo tipo de documento:
        <ol className="list-decimal list-inside mt-2 space-y-1">
          <li>Ve a &quot;Tipos de Documento&quot; en el menú</li>
          <li>Haz clic en &quot;Nuevo Tipo&quot;</li>
          <li>Ingresa el nombre y descripción</li>
          <li>Define los campos que quieres extraer (nombre, etiqueta, tipo)</li>
          <li>Puedes copiar y pegar campos desde Excel</li>
          <li>Guarda el tipo de documento</li>
        </ol>
      </>
    ),
  },
  {
    id: "type-3",
    question: "¿Qué es la inferencia desde muestras?",
    answer:
      "La inferencia desde muestras te permite crear un tipo de documento automáticamente. Solo sube algunos documentos de ejemplo y el sistema analizará su estructura para sugerir los campos que deberían extraerse. Esto ahorra tiempo al no tener que definir los campos manualmente.",
  },
  {
    id: "type-4",
    question: "¿Qué es la homologación de campos?",
    answer:
      "La homologación de campos permite estandarizar los nombres y formatos de los campos extraídos entre diferentes tipos de documentos. Esto asegura consistencia en los datos y facilita la integración con otros sistemas.",
  },
]

const faqAccount = [
  {
    id: "acc-1",
    question: "¿Cómo cambio mi plan de suscripción?",
    answer:
      "Ve a Configuración > Suscripción para ver los planes disponibles y cambiar tu suscripción. Los cambios se aplican inmediatamente y se ajustan proporcionalmente en tu próxima factura.",
  },
  {
    id: "acc-2",
    question: "¿Mis documentos están seguros?",
    answer:
      "Sí. Tus documentos se almacenan con cifrado en Cloudflare R2. Solo tú tienes acceso a tus documentos. ONAI no accede al contenido excepto para el procesamiento OCR. Para más detalles, consulta nuestra Política de Privacidad.",
  },
  {
    id: "acc-3",
    question: "¿Puedo eliminar mi cuenta y todos mis datos?",
    answer:
      "Sí. Puedes solicitar la eliminación de tu cuenta desde Configuración > Perfil. Todos tus documentos y datos serán eliminados permanentemente dentro de 30 días. Recomendamos exportar tus datos antes de proceder.",
  },
]

export default function HelpPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-primary">Centro de Ayuda</h1>
        <p className="text-muted-foreground mt-1 font-secondary">
          Encuentra respuestas a tus preguntas sobre ONAI OCR
        </p>
      </div>

      {/* Alert Banner */}
      <Alert className="mb-8 border-primary/30 bg-primary/5 rounded-2xl">
        <HelpCircle className="h-4 w-4 text-primary" />
        <AlertDescription className="font-secondary">
          ¿Necesitas ayuda adicional? Contáctanos en{" "}
          <a href="mailto:soporte@onaiconsulting.cl" className="font-medium text-primary underline">
            soporte@onaiconsulting.cl
          </a>{" "}
          para obtener asistencia personalizada.
        </AlertDescription>
      </Alert>

      {/* Quick Start Guide */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold font-primary mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Guía Rápida — 5 pasos para empezar
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {quickStartSteps.map((step) => (
            <Card key={step.step} className="rounded-2xl relative">
              <CardContent className="pt-6 text-center space-y-3">
                <div className="flex justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                    {step.step}
                  </div>
                </div>
                <div className="flex justify-center text-primary">{step.icon}</div>
                <h3 className="font-semibold font-primary text-sm">{step.title}</h3>
                <p className="text-xs text-muted-foreground font-secondary">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left Column — Documentos y OCR */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              Documentos y OCR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqDocuments.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left font-secondary text-sm">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground font-secondary text-sm">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Right Column — Tipos de Documento */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <FolderOpen className="h-4 w-4 text-primary" />
              </div>
              Tipos de Documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqTypes.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left font-secondary text-sm">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground font-secondary text-sm">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Account & Security FAQ */}
      <Card className="rounded-2xl mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-primary text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-4 w-4 text-primary" />
            </div>
            Cuenta y Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqAccount.map((faq) => (
              <AccordionItem key={faq.id} value={faq.id}>
                <AccordionTrigger className="text-left font-secondary text-sm">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground font-secondary text-sm">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Bottom Section — Contact */}
      <Card className="rounded-2xl">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-semibold font-primary">¿No encontraste lo que buscabas?</h2>
            <p className="text-muted-foreground font-secondary max-w-md mx-auto">
              Nuestro equipo de soporte está disponible para ayudarte con cualquier duda o problema.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground font-secondary">
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                soporte@onaiconsulting.cl
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Lunes a Viernes, 9:00 - 18:00 (Chile)
              </span>
            </div>
            <Button className="rounded-full mt-2" asChild>
              <a href="mailto:soporte@onaiconsulting.cl">Contactar Soporte</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
