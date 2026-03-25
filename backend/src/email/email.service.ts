import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Lightweight email service using Resend API via fetch.
 * No SDK dependency — just a POST to https://api.resend.com/emails.
 * Best-effort: logs errors but never throws (fire-and-forget pattern).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string | undefined;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM') || 'ONAI OCR <noreply@ocr.moti.cl>';
  }

  /**
   * Send an email via Resend. Returns true on success, false on failure.
   */
  async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not set — skipping email send');
      return false;
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: [to],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Resend API error (${res.status}): ${body}`);
        return false;
      }

      this.logger.log(`✉️ Email sent to ${to}: "${subject}"`);
      return true;
    } catch (error) {
      this.logger.error(`Email send failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Send verification code email.
   */
  async sendVerificationCode(to: string, code: string, name?: string): Promise<boolean> {
    const greeting = name ? `Hola ${name}` : 'Hola';
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e;">Verifica tu email</h2>
        <p>${greeting},</p>
        <p>Tu código de verificación para ONAI OCR es:</p>
        <div style="background: #f0f0f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e;">${code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">Este código expira en 15 minutos.</p>
        <p style="color: #666; font-size: 14px;">Si no solicitaste esto, puedes ignorar este email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">ONAI OCR — ocr.moti.cl</p>
      </div>
    `;

    return this.send(to, `${code} — Código de verificación ONAI OCR`, html);
  }
}
