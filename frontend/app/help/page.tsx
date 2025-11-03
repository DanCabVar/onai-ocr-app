"use client"

import { HelpCircle, FileText, FolderOpen, Upload } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function HelpPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Centro de Ayuda</h1>
        <p className="text-muted-foreground mt-1">
          Encuentra respuestas a tus preguntas sobre ONAI OCR
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Preguntas Frecuentes
          </CardTitle>
          <CardDescription>
            Respuestas a las dudas más comunes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  ¿Qué son los Tipos de Documento?
                </div>
              </AccordionTrigger>
              <AccordionContent>
                Los Tipos de Documento te permiten definir qué campos quieres extraer automáticamente
                de tus documentos. Por ejemplo, puedes crear un tipo "Factura" con campos como
                número de factura, fecha, total, etc.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  ¿Cómo subo documentos?
                </div>
              </AccordionTrigger>
              <AccordionContent>
                Ve a la sección "Subir Documento" desde el menú principal. Puedes arrastrar y soltar
                archivos PDF, JPG o PNG. El sistema procesará automáticamente los documentos y
                extraerá la información según el tipo de documento definido.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  ¿Qué formatos de archivo son compatibles?
                </div>
              </AccordionTrigger>
              <AccordionContent>
                Actualmente soportamos los siguientes formatos:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>PDF (.pdf)</li>
                  <li>JPEG (.jpg, .jpeg)</li>
                  <li>PNG (.png)</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>¿Cómo crear un nuevo tipo de documento?</AccordionTrigger>
              <AccordionContent>
                1. Ve a "Tipos de Documento" en el menú<br />
                2. Haz clic en "Nuevo Tipo"<br />
                3. Ingresa el nombre y descripción<br />
                4. Define los campos que quieres extraer (nombre, etiqueta, tipo)<br />
                5. Puedes copiar y pegar campos desde Excel<br />
                6. Guarda el tipo de documento
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>¿Necesitas más ayuda?</CardTitle>
          <CardDescription>
            Contáctanos para soporte adicional
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Si tienes preguntas adicionales o necesitas soporte técnico, no dudes en contactarnos
            en support@onai-ocr.com
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

