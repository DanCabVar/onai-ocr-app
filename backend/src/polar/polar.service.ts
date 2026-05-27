import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import axios from 'axios';
import {
  BillingStatus,
  Subscription,
  SubscriptionPlan,
} from '../database/entities/subscription.entity';
import { BillingWebhookEvent } from '../database/entities/billing-webhook-event.entity';

type PolarEventPayload = {
  id?: string;
  type?: string;
  data?: Record<string, any>;
};

@Injectable()
export class PolarService {
  private readonly logger = new Logger(PolarService.name);
  private readonly apiBaseUrl: string;
  private readonly accessToken: string;
  private readonly webhookSecret: string;
  private readonly frontendUrl: string;
  private readonly priceToPlan: Record<string, SubscriptionPlan> = {};
  private readonly planToProduct: Record<string, string> = {};

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(BillingWebhookEvent)
    private readonly webhookEventRepository: Repository<BillingWebhookEvent>,
  ) {
    this.apiBaseUrl =
      this.configService.get<string>('POLAR_API_BASE_URL') ||
      'https://api.polar.sh';
    this.accessToken = this.configService.get<string>('POLAR_ACCESS_TOKEN') || '';
    this.webhookSecret =
      this.configService.get<string>('POLAR_WEBHOOK_SECRET') || '';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const starterProduct = this.configService.get<string>('POLAR_PRODUCT_STARTER');
    const proProduct = this.configService.get<string>('POLAR_PRODUCT_PRO');
    const starterPrice = this.configService.get<string>('POLAR_PRICE_STARTER_MONTHLY');
    const proPrice = this.configService.get<string>('POLAR_PRICE_PRO_MONTHLY');

    if (starterProduct) this.planToProduct.starter = starterProduct;
    if (proProduct) this.planToProduct.pro = proProduct;
    if (starterPrice) this.priceToPlan[starterPrice] = 'starter';
    if (proPrice) this.priceToPlan[proPrice] = 'pro';
  }

  private ensureConfigured() {
    if (!this.accessToken) {
      throw new BadRequestException(
        'Polar no está configurado. Falta POLAR_ACCESS_TOKEN.',
      );
    }
  }

  async createCheckoutSession(
    userId: number,
    email: string,
    targetPlan: SubscriptionPlan,
  ): Promise<{ url: string; provider: 'polar'; sessionId?: string }> {
    this.ensureConfigured();
    if (targetPlan === 'free' || targetPlan === 'enterprise') {
      throw new BadRequestException(
        'Polar checkout solo aplica a planes starter/pro en esta fase.',
      );
    }

    const productId = this.planToProduct[targetPlan];
    if (!productId) {
      throw new BadRequestException(
        `Falta configuración POLAR_PRODUCT_${targetPlan.toUpperCase()}.`,
      );
    }

    const response = await axios.post(
      `${this.apiBaseUrl}/v1/checkouts/`,
      {
        products: [productId],
        external_customer_id: String(userId),
        customer_email: email,
        success_url: `${this.frontendUrl}/settings?billing=success`,
        metadata: {
          userId: String(userId),
          targetPlan,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      url: response.data?.url,
      sessionId: response.data?.id,
      provider: 'polar',
    };
  }

  async createPortalSession(
    userId: number,
  ): Promise<{ url: string; provider: 'polar' }> {
    this.ensureConfigured();

    const sub = await this.subscriptionRepository.findOne({ where: { userId } });
    const customerId = sub?.externalCustomerId;
    if (!customerId) {
      throw new BadRequestException('No existe cliente Polar para este usuario.');
    }

    const response = await axios.post(
      `${this.apiBaseUrl}/v1/customer-sessions/`,
      {
        external_customer_id: customerId,
      },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return { url: response.data?.url, provider: 'polar' };
  }

  verifyWebhookSignature(rawBody: Buffer, signature?: string): void {
    if (!this.webhookSecret) {
      throw new BadRequestException(
        'POLAR_WEBHOOK_SECRET no está configurado en el backend.',
      );
    }
    if (!signature) {
      throw new UnauthorizedException('Missing Polar signature header');
    }

    const candidate = signature.startsWith('sha256=')
      ? signature.slice('sha256='.length)
      : signature;
    const expected = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const left = Buffer.from(candidate, 'utf8');
    const right = Buffer.from(expected, 'utf8');
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new UnauthorizedException('Invalid Polar webhook signature');
    }
  }

  async handleWebhook(rawBody: Buffer, signature?: string): Promise<void> {
    this.verifyWebhookSignature(rawBody, signature);
    const payload = JSON.parse(rawBody.toString('utf8')) as PolarEventPayload;
    const eventId = payload.id || `${payload.type || 'unknown'}:${Date.now()}`;

    const existing = await this.webhookEventRepository.findOne({
      where: { provider: 'polar', eventId },
    });
    if (existing) {
      this.logger.warn(`Duplicate Polar webhook ignored: ${eventId}`);
      return;
    }

    await this.webhookEventRepository.insert({ provider: 'polar', eventId });

    const data = payload.data || {};
    const userId = Number(
      data?.metadata?.userId ||
        data?.customer?.external_id ||
        data?.external_customer_id,
    );
    if (!userId) {
      this.logger.warn(`Polar webhook without user identifier: ${payload.type}`);
      return;
    }

    const sub = await this.subscriptionRepository.findOne({ where: { userId } });
    if (!sub) return;

    if (payload.type?.includes('checkout')) {
      const targetPlan = (data?.metadata?.targetPlan || 'starter') as SubscriptionPlan;
      sub.plan = targetPlan;
    }

    sub.billingProvider = 'polar';
    sub.externalCustomerId = String(
      data?.customer?.external_id || data?.external_customer_id || userId,
    );
    sub.externalSubscriptionId =
      data?.subscription_id || data?.subscription?.id || sub.externalSubscriptionId;
    sub.externalPriceId =
      data?.price_id || data?.product_price_id || sub.externalPriceId;
    sub.billingStatus = this.mapBillingStatus(payload.type, data?.status);
    sub.active = sub.billingStatus === 'active' || sub.plan === 'free';

    const periodStart = data?.period_start || data?.current_period_start;
    const periodEnd = data?.period_end || data?.current_period_end;
    if (periodStart) sub.periodStart = new Date(periodStart);
    if (periodEnd) sub.periodEnd = new Date(periodEnd);

    if (sub.externalPriceId && this.priceToPlan[sub.externalPriceId]) {
      sub.plan = this.priceToPlan[sub.externalPriceId];
    }

    if (sub.billingStatus === 'canceled') {
      sub.plan = 'free';
      sub.active = true;
    }

    await this.subscriptionRepository.save(sub);
  }

  private mapBillingStatus(
    eventType?: string,
    status?: string,
  ): BillingStatus | null {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'active' || eventType?.includes('active')) return 'active';
    if (normalized === 'past_due' || normalized === 'past-due') return 'past_due';
    if (normalized === 'canceled' || eventType?.includes('canceled')) return 'canceled';
    if (normalized === 'incomplete') return 'incomplete';
    return null;
  }
}
