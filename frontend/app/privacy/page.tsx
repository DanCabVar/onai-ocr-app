"use client"

import { Shield, Eye, Database, Share2, Clock, UserCheck, Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const lastUpdated = "25 de marzo de 2026"

export default function PrivacyPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-primary">Política de Privacidad</h1>
        </div>
        <p className="text-muted-foreground font-secondary">
          Última actualización: {lastUpdated}
        </p>
      </div>

      <div className="space-y-6">
        {/* Intro */}
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <p className="text-muted-foreground font-secondary leading-relaxed">
              En <strong className="text-foreground">ONAI Consulting</strong> nos tomamos en serio la privacidad de
              tus datos. Esta política describe qué información recopilamos, cómo la usamos, con quién la
              compartimos y cómo la protegemos cuando utilizas{" "}
              <strong className="text-foreground">ONAI OCR</strong>.
            </p>
          </CardContent>
        </Card>

        {/* 1. Datos que Recopilamos */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <Eye className="h-5 w-5 text-primary" />
              1. Datos que Recopilamos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground font-secondary leading-relaxed">
            <div>
              <h3 className="font-semibold text-foreground mb-2">Datos de cuenta</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Nombre completo</li>
                <li>Dirección de correo electrónico</li>
                <li>Contraseña (almacenada de forma cifrada con hash)</li>
                <li>Información de facturación (procesada por Stripe; no almacenamos datos de tarjetas)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Datos de uso del servicio</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Documentos subidos (PDF, JPG, PNG)</li>
                <li>Datos extraídos de los documentos mediante OCR e IA</li>
                <li>Tipos de documento y esquemas de campos definidos por el usuario</li>
                <li>Historial de procesamiento y actividad en la plataforma</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Datos técnicos</h3>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Dirección IP</li>
                <li>Tipo de navegador y dispositivo</li>
                <li>Cookies esenciales para el funcionamiento del servicio</li>
                <li>Registros de acceso y errores</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 2. Cómo Usamos los Datos */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <Database className="h-5 w-5 text-primary" />
              2. Cómo Usamos los Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>Usamos tus datos <strong className="text-foreground">únicamente</strong> para:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Proveer y mantener el servicio de procesamiento de documentos</li>
              <li>Autenticar tu identidad y gestionar tu cuenta</li>
              <li>Procesar pagos y facturación</li>
              <li>Enviar notificaciones relacionadas con el servicio (límites de uso, actualizaciones)</li>
              <li>Mejorar el rendimiento y la seguridad de la plataforma</li>
              <li>Cumplir con obligaciones legales</li>
            </ul>
            <p className="mt-3">
              <strong className="text-foreground">No vendemos tus datos.</strong> No utilizamos tus documentos ni
              datos extraídos para publicidad, marketing a terceros, ni para entrenar modelos de IA.
            </p>
          </CardContent>
        </Card>

        {/* 3. Terceros */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <Share2 className="h-5 w-5 text-primary" />
              3. Servicios de Terceros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>
              Para proveer el servicio, compartimos datos de forma limitada con los siguientes proveedores:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="rounded-xl border p-4 space-y-1">
                <h4 className="font-semibold text-foreground">Mistral AI</h4>
                <p className="text-sm">Procesamiento OCR y extracción de datos de documentos</p>
              </div>
              <div className="rounded-xl border p-4 space-y-1">
                <h4 className="font-semibold text-foreground">Google Gemini</h4>
                <p className="text-sm">Clasificación inteligente de documentos</p>
              </div>
              <div className="rounded-xl border p-4 space-y-1">
                <h4 className="font-semibold text-foreground">Cloudflare R2</h4>
                <p className="text-sm">Almacenamiento seguro de archivos con cifrado</p>
              </div>
              <div className="rounded-xl border p-4 space-y-1">
                <h4 className="font-semibold text-foreground">Stripe</h4>
                <p className="text-sm">Procesamiento seguro de pagos y suscripciones</p>
              </div>
            </div>
            <p className="text-sm mt-3">
              Cada proveedor procesa los datos según sus propias políticas de privacidad y bajo estrictos acuerdos
              de procesamiento de datos. Los documentos enviados a Mistral AI y Google Gemini se procesan en tiempo
              real y no son retenidos por estos proveedores más allá de lo necesario para completar la solicitud.
            </p>
          </CardContent>
        </Card>

        {/* 4. Retención */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <Clock className="h-5 w-5 text-primary" />
              4. Retención de Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className="text-foreground">Cuenta activa:</strong> Tus datos se mantienen mientras tu
                cuenta esté activa y sean necesarios para proveer el servicio.
              </li>
              <li>
                <strong className="text-foreground">Cierre de cuenta:</strong> Al cerrar tu cuenta, todos tus datos
                personales, documentos y datos extraídos serán eliminados permanentemente dentro de 30 días.
              </li>
              <li>
                <strong className="text-foreground">Backups:</strong> Las copias de seguridad que contengan tus datos
                se purgan en un ciclo máximo de 90 días tras la eliminación.
              </li>
              <li>
                <strong className="text-foreground">Datos de facturación:</strong> Los registros de transacciones se
                conservan por el período requerido por la legislación tributaria chilena (6 años).
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* 5. Derechos */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <UserCheck className="h-5 w-5 text-primary" />
              5. Tus Derechos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>De acuerdo con la legislación chilena de protección de datos personales, tienes derecho a:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong className="text-foreground">Acceso:</strong> Solicitar una copia de todos los datos
                personales que tenemos sobre ti.
              </li>
              <li>
                <strong className="text-foreground">Rectificación:</strong> Corregir datos personales inexactos o
                incompletos.
              </li>
              <li>
                <strong className="text-foreground">Eliminación:</strong> Solicitar la eliminación de tus datos
                personales y documentos.
              </li>
              <li>
                <strong className="text-foreground">Portabilidad:</strong> Exportar tus datos en un formato
                estructurado y de uso común.
              </li>
              <li>
                <strong className="text-foreground">Oposición:</strong> Oponerte al tratamiento de tus datos para
                fines específicos.
              </li>
            </ul>
            <p>
              Para ejercer cualquiera de estos derechos, contáctanos en{" "}
              <a href="mailto:privacidad@onaiconsulting.cl" className="text-primary underline hover:text-primary/80">
                privacidad@onaiconsulting.cl
              </a>
              . Responderemos en un plazo máximo de 15 días hábiles.
            </p>
          </CardContent>
        </Card>

        {/* 6. Seguridad */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              🔐 6. Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>Implementamos medidas de seguridad técnicas y organizativas para proteger tus datos:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Cifrado en tránsito (TLS/HTTPS) y en reposo</li>
              <li>Autenticación segura con tokens JWT</li>
              <li>Contraseñas almacenadas con hash bcrypt</li>
              <li>Acceso a datos basado en roles y principio de mínimo privilegio</li>
              <li>Monitoreo continuo de seguridad y registros de auditoría</li>
            </ul>
          </CardContent>
        </Card>

        {/* 7. Cookies */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              🍪 7. Cookies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>Utilizamos únicamente cookies esenciales para:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Mantener tu sesión activa</li>
              <li>Recordar tus preferencias de interfaz (como el tema oscuro/claro)</li>
            </ul>
            <p>No utilizamos cookies de tracking, publicidad ni análisis de terceros.</p>
          </CardContent>
        </Card>

        {/* 8. Cambios */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              📝 8. Cambios a esta Política
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>
              Podemos actualizar esta política periódicamente. Los cambios significativos serán notificados por
              email con al menos 15 días de anticipación. La fecha de última actualización se indica al inicio de
              este documento.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="rounded-2xl border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h2 className="text-xl font-semibold font-primary">Contacto de Privacidad</h2>
              <p className="text-muted-foreground font-secondary max-w-md mx-auto">
                Para consultas sobre privacidad, ejercicio de derechos o reportar incidentes de seguridad:
              </p>
              <div className="space-y-1 text-sm font-secondary">
                <p>
                  <strong className="text-foreground">Email:</strong>{" "}
                  <a href="mailto:privacidad@onaiconsulting.cl" className="text-primary underline">
                    privacidad@onaiconsulting.cl
                  </a>
                </p>
                <p>
                  <strong className="text-foreground">Soporte general:</strong>{" "}
                  <a href="mailto:soporte@onaiconsulting.cl" className="text-primary underline">
                    soporte@onaiconsulting.cl
                  </a>
                </p>
              </div>
              <Button className="rounded-full mt-2" asChild>
                <a href="mailto:privacidad@onaiconsulting.cl">Contactar</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
