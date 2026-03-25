import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Subscription, SubscriptionPlan } from '../database/entities/subscription.entity';
import { SubscriptionsService } from './subscriptions.service';

/** Map Stripe price IDs to internal plan names.
 *  Configure via env: STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_ENTERPRISE
 */
interface PriceMap {
  [priceId: string]: SubscriptionPlan;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly priceToplan: PriceMap;
  private readonly planToPriceId: Record<string, string>;
  private readonly successUrl: string;
  private readonly cancelUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured — Stripe features disabled');
    }

    this.stripe = new Stripe(secretKey || '', { apiVersion: '2025-04-30.basil' });
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';

    // Build price ↔ plan mappings from env
    const starterPrice = this.configService.get<string>('STRIPE_PRICE_STARTER') || '';
    const proPrice = this.configService.get<string>('STRIPE_PRICE_PRO') || '';
    const enterprisePrice = this.configService.get<string>('STRIPE_PRICE_ENTERPRISE') || '';

    this.priceToplan = {};
    this.planToPriceId = {};

    if (starterPrice) {
      this.priceToplan[starterPrice] = 'starter';
      this.planToPriceId['starter'] = starterPrice;
    }
    if (proPrice) {
      this.priceToplan[proPrice] = 'pro';
      this.planToPriceId['pro'] = proPrice;
    }
    if (enterprisePrice) {
      this.priceToplan[enterprisePrice] = 'enterprise';
      this.planToPriceId['enterprise'] = enterprisePrice;
    }

    this.successUrl = this.configService.get<string>('FRONTEND_URL') + '/settings?stripe=success';
    this.cancelUrl = this.configService.get<string>('FRONTEND_URL') + '/settings?stripe=cancelled';

    this.logger.log('Stripe service initialized');
  }

  /**
   * Create a Stripe Checkout session for upgrading to a paid plan.
   */
  async createCheckoutSession(
    userId: number,
    email: string,
    targetPlan: SubscriptionPlan,
  ): Promise<{ url: string; sessionId: string }> {
    if (targetPlan === 'free') {
      throw new BadRequestException('No se requiere pago para el plan free.');
    }

    const priceId = this.planToPriceId[targetPlan];
    if (!priceId) {
      throw new BadRequestException(`Plan "${targetPlan}" no tiene precio configurado en Stripe.`);
    }

    // Get or create Stripe customer
    const sub = await this.subscriptionsService.getOrCreate(userId);
    let customerId = sub.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email,
        metadata: { userId: String(userId) },
      });
      customerId = customer.id;

      await this.subscriptionRepository.update(
        { userId },
        { stripeCustomerId: customerId },
      );
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: this.successUrl,
      cancel_url: this.cancelUrl,
      metadata: { userId: String(userId), targetPlan },
    });

    this.logger.log(`Checkout session created for user ${userId} → ${targetPlan}`);
    return { url: session.url!, sessionId: session.id };
  }

  /**
   * Create a Stripe Customer Portal session for managing billing.
   */
  async createPortalSession(userId: number): Promise<{ url: string }> {
    const sub = await this.subscriptionsService.getOrCreate(userId);

    if (!sub.stripeCustomerId) {
      throw new BadRequestException('No tienes una suscripción activa con Stripe.');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: this.configService.get<string>('FRONTEND_URL') + '/settings',
    });

    return { url: session.url };
  }

  /**
   * Handle Stripe webhook events.
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Webhook signature verification failed');
    }

    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = parseInt(session.metadata?.userId || '0', 10);
    const targetPlan = (session.metadata?.targetPlan || 'starter') as SubscriptionPlan;

    if (!userId) {
      this.logger.error('Checkout completed but no userId in metadata');
      return;
    }

    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    // Update subscription in DB
    await this.subscriptionRepository.update(
      { userId },
      {
        plan: targetPlan,
        stripeSubscriptionId: stripeSubscriptionId || null,
        stripeCustomerId: session.customer as string,
        active: true,
        docsUsedThisPeriod: 0,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    );

    this.logger.log(`✅ User ${userId} upgraded to ${targetPlan}`);
  }

  private async handleSubscriptionUpdated(stripeSub: Stripe.Subscription): Promise<void> {
    const customerId =
      typeof stripeSub.customer === 'string'
        ? stripeSub.customer
        : stripeSub.customer.id;

    const sub = await this.subscriptionRepository.findOne({
      where: { stripeCustomerId: customerId },
    });

    if (!sub) {
      this.logger.warn(`Subscription update for unknown customer: ${customerId}`);
      return;
    }

    // Determine plan from price
    const priceId = stripeSub.items.data[0]?.price?.id;
    const plan = priceId ? this.priceToplan[priceId] : undefined;

    if (plan && plan !== sub.plan) {
      sub.plan = plan;
      sub.stripePriceId = priceId;
      this.logger.log(`User ${sub.userId} plan changed to ${plan}`);
    }

    sub.active = stripeSub.status === 'active' || stripeSub.status === 'trialing';

    if (stripeSub.current_period_start) {
      sub.periodStart = new Date(stripeSub.current_period_start * 1000);
    }
    if (stripeSub.current_period_end) {
      sub.periodEnd = new Date(stripeSub.current_period_end * 1000);
    }

    await this.subscriptionRepository.save(sub);
  }

  private async handleSubscriptionDeleted(stripeSub: Stripe.Subscription): Promise<void> {
    const customerId =
      typeof stripeSub.customer === 'string'
        ? stripeSub.customer
        : stripeSub.customer.id;

    const sub = await this.subscriptionRepository.findOne({
      where: { stripeCustomerId: customerId },
    });

    if (!sub) return;

    // Downgrade to free
    sub.plan = 'free';
    sub.active = true; // free is always active
    sub.stripeSubscriptionId = null;
    sub.stripePriceId = null;

    await this.subscriptionRepository.save(sub);
    this.logger.log(`User ${sub.userId} downgraded to free (subscription cancelled)`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : (invoice.customer as any)?.id;

    if (!customerId) return;

    const sub = await this.subscriptionRepository.findOne({
      where: { stripeCustomerId: customerId },
    });

    if (!sub) return;

    this.logger.warn(`Payment failed for user ${sub.userId}`);
    // Don't immediately deactivate — Stripe retries. Just log.
  }
}
