"use client"

import { HelpCircle, FileText, FolderOpen, Upload, Mail, Clock, MessageCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const faqDocuments = [
  {
    id: "doc-1",
    question: "Que formatos de archivo son compatibles?",
    answer: (
      <>
        Actualmente soportamos los siguientes formatos:
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>PDF (.pdf)</li>
          <li>JPEG (.jpg, .jpeg)</li>
          <li>PNG (.png)</li>
        </ul>
      </>
    ),
  },
  {
    id: "doc-2",
    question: "Como funciona el reconocimiento OCR?",
    answer:
      "El sistema utiliza tecnologia de reconocimiento optico de caracteres (OCR) combinada con inteligencia artificial para extraer texto e informacion estructurada de tus documentos. El proceso es automatico una vez que subes un archivo.",
  },
  {
    id: "doc-3",
    question: "Como funciona la extraccion automatica de campos?",
    answer:
      "Una vez que defines un tipo de documento con sus campos, el sistema utiliza la API de Mistral para analizar cada documento subido y extraer automaticamente los valores correspondientes a cada campo definido en el esquema.",
  },
  {
    id: "doc-4",
    question: "Como funciona el OCR con la API de Mistral?",
    answer:
      "Cuando subes un documento, el sistema lo envía a la API de Mistral que utiliza modelos de vision avanzados para leer y comprender el contenido. Luego, basandose en los campos que definiste en tu tipo de documento, extrae la informacion relevante de forma estructurada.",
  },
]

const faqTypes = [
  {
    id: "type-1",
    question: "Que son los Tipos de Documento?",
    answer:
      "Los Tipos de Documento te permiten definir que campos quieres extraer automaticamente de tus documentos. Por ejemplo, puedes crear un tipo 'Factura' con campos como numero de factura, fecha, total, etc.",
  },
  {
    id: "type-2",
    question: "Como creo un nuevo tipo de documento?",
    answer: (
      <>
        Para crear un nuevo tipo de documento:
        <ol className="list-decimal list-inside mt-2 space-y-1">
          <li>Ve a &quot;Tipos de Documento&quot; en el menu</li>
          <li>Haz clic en &quot;Nuevo Tipo&quot;</li>
          <li>Ingresa el nombre y descripcion</li>
          <li>Define los campos que quieres extraer (nombre, etiqueta, tipo)</li>
          <li>Puedes copiar y pegar campos desde Excel</li>
          <li>Guarda el tipo de documento</li>
        </ol>
      </>
    ),
  },
  {
    id: "type-3",
    question: "Que es la inferencia desde muestras?",
    answer:
      "La inferencia desde muestras te permite crear un tipo de documento automaticamente. Solo sube algunos documentos de ejemplo y el sistema analizara su estructura para sugerir los campos que deberian extraerse. Esto ahorra tiempo al no tener que definir los campos manualmente.",
  },
  {
    id: "type-4",
    question: "Que es la homologacion de campos?",
    answer:
      "La homologacion de campos permite estandarizar los nombres y formatos de los campos extraidos entre diferentes tipos de documentos. Esto asegura consistencia en los datos y facilita la integracion con otros sistemas.",
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
          Necesitas ayuda adicional? Contacta a nuestro equipo de soporte en{" "}
          <a href="mailto:soporte@onai-ocr.com" className="font-medium text-primary underline">
            soporte@onai-ocr.com
          </a>{" "}
          para obtener asistencia personalizada.
        </AlertDescription>
      </Alert>

      {/* Two-column FAQ Grid */}
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

      {/* Bottom Section — Contact */}
      <Card className="rounded-2xl">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-semibold font-primary">No encontraste lo que buscabas?</h2>
            <p className="text-muted-foreground font-secondary max-w-md mx-auto">
              Nuestro equipo de soporte esta disponible para ayudarte con cualquier duda o problema.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground font-secondary">
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                soporte@onai-ocr.com
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Lunes a Viernes, 9:00 - 18:00
              </span>
            </div>
            <Button className="rounded-full mt-2" asChild>
              <a href="mailto:soporte@onai-ocr.com">Contactar Soporte</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
