"use client"

import { FileText, Scale, Shield, Database, XCircle, AlertTriangle, Globe } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const lastUpdated = "25 de marzo de 2026"

export default function TermsPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold font-primary">Términos de Servicio</h1>
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
              Bienvenido a <strong className="text-foreground">ONAI OCR</strong>, una plataforma de procesamiento
              inteligente de documentos operada por <strong className="text-foreground">ONAI Consulting</strong>
              {" "}(&quot;ONAI&quot;, &quot;nosotros&quot;, &quot;nuestro&quot;). Al acceder o usar nuestro servicio,
              aceptas estos Términos de Servicio. Si no estás de acuerdo, no utilices la plataforma.
            </p>
          </CardContent>
        </Card>

        {/* 1. Descripción del Servicio */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <FileText className="h-5 w-5 text-primary" />
              1. Descripción del Servicio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>
              ONAI OCR es una plataforma SaaS (Software as a Service) que permite a los usuarios subir documentos
              para su procesamiento mediante tecnologías de reconocimiento óptico de caracteres (OCR) e inteligencia
              artificial. El servicio incluye:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Extracción automática de texto y datos estructurados de documentos</li>
              <li>Clasificación inteligente de documentos mediante IA</li>
              <li>Definición de tipos de documento y esquemas de campos personalizados</li>
              <li>Almacenamiento seguro de documentos y datos extraídos</li>
              <li>Exportación de datos en diversos formatos</li>
            </ul>
          </CardContent>
        </Card>

        {/* 2. Registro y Cuenta */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <Shield className="h-5 w-5 text-primary" />
              2. Registro y Cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>Para usar ONAI OCR necesitas crear una cuenta proporcionando información veraz y actualizada. Eres responsable de:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Mantener la confidencialidad de tus credenciales de acceso</li>
              <li>Todas las actividades que ocurran bajo tu cuenta</li>
              <li>Notificarnos inmediatamente si sospechas de uso no autorizado</li>
            </ul>
            <p>
              Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos o que permanezcan
              inactivas por más de 12 meses.
            </p>
          </CardContent>
        </Card>

        {/* 3. Uso Aceptable */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <AlertTriangle className="h-5 w-5 text-primary" />
              3. Uso Aceptable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>Al usar ONAI OCR, te comprometes a:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Usar el servicio solo para fines lícitos y conforme a la legislación chilena vigente</li>
              <li>No subir documentos que contengan malware, virus u otro código malicioso</li>
              <li>No intentar acceder a datos o cuentas de otros usuarios</li>
              <li>No usar el servicio para procesar documentos ilegales o fraudulentos</li>
              <li>No realizar ingeniería inversa, descompilar o desensamblar el software</li>
              <li>No exceder los límites de uso de tu plan de suscripción de forma abusiva</li>
              <li>No usar bots, scrapers o herramientas automatizadas para extraer datos del servicio sin autorización</li>
            </ul>
            <p>
              El incumplimiento de estas condiciones puede resultar en la suspensión inmediata de tu cuenta sin
              derecho a reembolso.
            </p>
          </CardContent>
        </Card>

        {/* 4. Propiedad de Datos */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <Database className="h-5 w-5 text-primary" />
              4. Propiedad de Datos y Privacidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>
              <strong className="text-foreground">Tus documentos son tuyos.</strong> ONAI no reclama ningún derecho
              de propiedad sobre los documentos que subes ni sobre los datos extraídos de ellos.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong className="text-foreground">Acceso limitado:</strong> ONAI no accede al contenido de tus
                documentos excepto cuando es estrictamente necesario para proveer el servicio de procesamiento
                (OCR, clasificación, extracción de datos).
              </li>
              <li>
                <strong className="text-foreground">Almacenamiento seguro:</strong> Los documentos y datos extraídos
                se almacenan en servidores seguros utilizando Cloudflare R2, con cifrado en tránsito y en reposo.
              </li>
              <li>
                <strong className="text-foreground">Sin uso para entrenamiento:</strong> Tus documentos y datos NO
                se utilizan para entrenar modelos de inteligencia artificial propios ni de terceros.
              </li>
              <li>
                <strong className="text-foreground">Eliminación:</strong> Puedes eliminar tus documentos y datos en
                cualquier momento. Al cerrar tu cuenta, todos tus datos serán eliminados de forma permanente en un
                plazo máximo de 30 días.
              </li>
            </ul>
            <p>
              Para más detalles, consulta nuestra{" "}
              <a href="/privacy" className="text-primary underline hover:text-primary/80">
                Política de Privacidad
              </a>.
            </p>
          </CardContent>
        </Card>

        {/* 5. Planes y Pagos */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              💳 5. Planes, Pagos y Facturación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>ONAI OCR ofrece planes gratuitos y de pago con distintos límites de procesamiento</li>
              <li>Los pagos se procesan a través de Stripe y se cobran de forma recurrente según el ciclo de tu plan</li>
              <li>Los precios pueden cambiar con 30 días de aviso previo</li>
              <li>No se realizan reembolsos por períodos parciales de uso</li>
              <li>Si tu pago falla, tendrás un período de gracia de 7 días antes de la suspensión del servicio</li>
            </ul>
          </CardContent>
        </Card>

        {/* 6. Cancelación */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <XCircle className="h-5 w-5 text-primary" />
              6. Cancelación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>Puedes cancelar tu cuenta en cualquier momento desde la configuración de tu perfil.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>La cancelación es efectiva al final del período de facturación actual</li>
              <li>Mantendrás acceso al servicio hasta que finalice el período ya pagado</li>
              <li>
                Tras la cancelación, tus documentos y datos serán eliminados permanentemente dentro de 30 días
              </li>
              <li>
                Puedes exportar tus datos antes de cancelar usando la función de exportación disponible en tu cuenta
              </li>
            </ul>
            <p>
              ONAI se reserva el derecho de cancelar cuentas que violen estos términos, con notificación previa al
              usuario cuando sea razonablemente posible.
            </p>
          </CardContent>
        </Card>

        {/* 7. Límites de Responsabilidad */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              ⚖️ 7. Límites de Responsabilidad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>
              ONAI OCR se proporciona &quot;tal cual&quot; (<em>as is</em>) y &quot;según disponibilidad&quot; (<em>as available</em>).
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                No garantizamos que el servicio sea ininterrumpido, libre de errores o que los resultados del OCR
                sean 100% precisos
              </li>
              <li>
                La precisión de la extracción de datos depende de la calidad de los documentos subidos y de las
                capacidades de los modelos de IA utilizados
              </li>
              <li>
                ONAI no será responsable por daños indirectos, incidentales, especiales o consecuentes derivados
                del uso del servicio
              </li>
              <li>
                La responsabilidad máxima de ONAI estará limitada al monto total pagado por el usuario en los
                últimos 12 meses
              </li>
              <li>
                No somos responsables por pérdida de datos causada por factores fuera de nuestro control razonable
              </li>
            </ul>
            <p>
              Se recomienda mantener copias de respaldo de todos los documentos originales subidos a la plataforma.
            </p>
          </CardContent>
        </Card>

        {/* 8. Propiedad Intelectual */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              🔒 8. Propiedad Intelectual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>
              La plataforma ONAI OCR, incluyendo su código, diseño, marca, logotipos y documentación, es propiedad
              exclusiva de ONAI Consulting y está protegida por las leyes de propiedad intelectual de Chile y
              tratados internacionales aplicables.
            </p>
            <p>
              Se te otorga una licencia limitada, no exclusiva, no transferible y revocable para usar el servicio
              conforme a estos términos y al plan contratado.
            </p>
          </CardContent>
        </Card>

        {/* 9. Modificaciones */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              📝 9. Modificaciones a los Términos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán
              notificados por email y/o mediante un aviso en la plataforma con al menos 15 días de anticipación.
            </p>
            <p>
              El uso continuado del servicio después de la entrada en vigencia de los cambios constituye tu
              aceptación de los nuevos términos.
            </p>
          </CardContent>
        </Card>

        {/* 10. Ley Aplicable */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-primary text-lg">
              <Globe className="h-5 w-5 text-primary" />
              10. Ley Aplicable y Jurisdicción
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground font-secondary leading-relaxed">
            <p>
              Estos Términos de Servicio se rigen por las leyes de la República de Chile. Cualquier controversia
              derivada de estos términos o del uso del servicio será sometida a la jurisdicción de los tribunales
              ordinarios de la ciudad de Santiago de Chile.
            </p>
            <p>
              En caso de que alguna disposición de estos términos sea declarada inválida o inaplicable, las
              disposiciones restantes continuarán en pleno vigor y efecto.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="rounded-2xl border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="font-secondary text-muted-foreground">
                ¿Tienes preguntas sobre estos términos?
              </p>
              <p className="font-secondary">
                Contáctanos en{" "}
                <a href="mailto:legal@onaiconsulting.cl" className="text-primary underline hover:text-primary/80">
                  legal@onaiconsulting.cl
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
