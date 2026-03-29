import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: any | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      // Lazy-import to avoid issues when key is not set
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Resend } = require('resend');
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY no configurada — los emails se mostrarán en consola');
    }
  }

  async sendVerificationCode(email: string, code: string, name?: string): Promise<void> {
    const displayName = name || email;

    if (!this.resend) {
      // Modo dev: mostrar código en consola
      this.logger.log('='.repeat(50));
      this.logger.log(`📧 EMAIL DE VERIFICACIÓN (modo dev)`);
      this.logger.log(`Para: ${email}`);
      this.logger.log(`Nombre: ${displayName}`);
      this.logger.log(`Código: ${code}`);
      this.logger.log('='.repeat(50));
      return;
    }

    const html = this.buildVerificationEmailHtml(displayName, code);

    try {
      await this.resend.emails.send({
        from: 'ONAI OCR <noreply@moti.cl>',
        to: email,
        subject: `Tu código de verificación: ${code}`,
        html,
      });
      this.logger.log(`Email de verificación enviado a ${email}`);
    } catch (error) {
      this.logger.error(`Error enviando email a ${email}: ${error.message}`);
      throw error;
    }
  }

  private buildVerificationEmailHtml(name: string, code: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifica tu cuenta</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1d4ed8;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">ONAI OCR</h1>
              <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Plataforma de procesamiento de documentos</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 16px;font-size:16px;color:#374151;">Hola <strong>${name}</strong>,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
                Ingresa el siguiente código para verificar tu cuenta. El código expira en <strong>15 minutos</strong>.
              </p>
              <!-- Código grande -->
              <div style="background:#f0f9ff;border:2px solid #bae6fd;border-radius:12px;padding:28px;text-align:center;margin:0 0 28px;">
                <span style="font-size:48px;font-weight:800;letter-spacing:12px;color:#1d4ed8;font-family:'Courier New',monospace;">${code}</span>
              </div>
              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;text-align:center;">
                Si no solicitaste este código, ignora este email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} ONAI · Este es un email automático, no respondas a este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
