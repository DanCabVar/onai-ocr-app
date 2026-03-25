import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import {
  Subscription,
  SubscriptionPlan,
} from '../database/entities/subscription.entity';

/**
 * Map Stripe price IDs → internal plan names.
 * Configured via env: STRIPE_PRICE_STARTER_MONTHLY, STRIPE_PRICE_PRO_MONTHLY
 */
interface PriceMap {
  [priceId: string]: SubscriptionPlan;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;
  private readonly webhookSecret: string;
  private readonly priceToplan: PriceMap = {};
  private readonly planToPriceId: Record<string, string> = {};
  private readonly frontendUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-04-30.basil' as any,
      });
      this.logger.log('Stripe initialized ✅');
    } else {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — Stripe features disabled. Add it to .env to enable.',
      );
    }

    // Build price ↔ plan mappings from env
    const starterPrice = this.configService.get<string>(
      'STRIPE_PRICE_STARTER_MONTHLY',
    );
    const proPrice = this.configService.get<string>(
      'STRIPE_PRICE_PRO_MONTHLY',
    );

    if (starterPrice) {
      this.priceToplan[starterPrice] = 'starter';
      this.planToPriceId['starter'] = starterPrice;
    }
    if (proPrice) {
      this.priceToplan[proPrice] = 'pro';
      this.planToPriceId['pro'] = proPrice;
    }
  }

  /** Ensure Stripe is initialized before calling API. */
  private ensureStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException(
        'Stripe no está configurado. Agrega STRIPE_SECRET_KEY en .env',
      );
    }
    return this.stripe;
  }

  // ─── Public API ────────────────────────────────────────────────────

  /**
   * Create a Stripe Checkout session for upgrading to a paid plan.
   */
  async createCheckoutSession(
    userId: number,
    email: string,
    targetPlan: SubscriptionPlan,
  ): Promise<{ url: string; sessionId: string }> {
    const stripe = this.ensureStripe();

    if (targetPlan === 'free') {
      throw new BadRequestException('No se requiere pago para el plan free.');
    }

    const priceId = this.planToPriceId[targetPlan];
    if (!priceId) {
      throw new BadRequestException(
        `Plan "${targetPlan}" no tiene precio configurado en Stripe. ` +
          `Configura STRIPE_PRICE_${targetPlan.toUpperCase()}_MONTHLY en .env`,
      );
    }

    // Get or create Stripe customer
    const sub = await this.findOrFailSubscription(userId);
    let customerId = sub.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId: String(userId) },
      });
      customerId = customer.id;

      await this.subscriptionRepository.update(
        { userId },
        { stripeCustomerId: customerId },
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.frontendUrl}/settings?stripe=success`,
      cancel_url: `${this.frontendUrl}/settings?stripe=cancelled`,
      metadata: { userId: String(userId), targetPlan },
    });

    this.logger.log(
      `Checkout session created for user ${userId} → ${targetPlan}`,
    );
    return { url: session.url!, sessionId: session.id };
  }

  /**
   * Create a Stripe Customer Portal session for managing billing.
   */
  async createCustomerPortalSession(
    userId: number,
  ): Promise<{ url: string }> {
    const stripe = this.ensureStripe();

    const sub = await this.findOrFailSubscription(userId);

    if (!sub.stripeCustomerId) {
      throw new BadRequestException(
        'No tienes una suscripción activa con Stripe.',
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${this.frontendUrl}/settings`,
    });

    return { url: session.url };
  }

  /**
   * Verify and handle a Stripe webhook event.
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const stripe = this.ensureStripe();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err: any) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`,
      );
      throw new BadRequestException('Webhook signature verification failed');
    }

    this.logger.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case 'invoice.payment_failed':
        await this.onPaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Sync subscription data from a Stripe subscription ID.
   * Useful for manual reconciliation.
   */
  async syncFromStripe(stripeSubscriptionId: string): Promise<Subscription> {
    const stripe = this.ensureStripe();

    const stripeSub =
      await stripe.subscriptions.retrieve(stripeSubscriptionId);

    const customerId =
      typeof stripeSub.customer === 'string'
        ? stripeSub.customer
        : stripeSub.customer.id;

    const sub = await this.subscriptionRepository.findOne({
      where: { stripeCustomerId: customerId },
    });

    if (!sub) {
      throw new BadRequestException(
        `No subscription found for Stripe customer ${customerId}`,
      );
    }

    // Determine plan from price
    const priceId = stripeSub.items.data[0]?.price?.id;
    if (priceId && this.priceToplan[priceId]) {
      sub.plan = this.priceToplan[priceId];
      sub.stripePriceId = priceId;
    }

    sub.stripeSubscriptionId = stripeSubscriptionId;
    sub.active =
      stripeSub.status === 'active' || stripeSub.status === 'trialing';

    // Period dates are on items in Stripe SDK v20+
    const firstItem = stripeSub.items.data[0];
    if (firstItem?.current_period_start) {
      sub.periodStart = new Date(firstItem.current_period_start * 1000);
    }
    if (firstItem?.current_period_end) {
      sub.periodEnd = new Date(firstItem.current_period_end * 1000);
    }

    await this.subscriptionRepository.save(sub);
    this.logger.log(
      `Synced subscription for user ${sub.userId} from Stripe`,
    );
    return sub;
  }

  // ─── Webhook Handlers (private) ───────────────────────────────────

  private async onCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const userId = parseInt(session.metadata?.userId || '0', 10);
    const targetPlan = (session.metadata?.targetPlan ||
      'starter') as SubscriptionPlan;

    if (!userId) {
      this.logger.error('Checkout completed but no userId in metadata');
      return;
    }

    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    await this.subscriptionRepository.update(
      { userId },
      {
        plan: targetPlan,
        stripeSubscriptionId: stripeSubscriptionId || undefined,
        stripeCustomerId: (session.customer as string) || undefined,
        active: true,
        docsUsedThisPeriod: 0,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    );

    this.logger.log(`✅ User ${userId} upgraded to ${targetPlan}`);
  }

  private async onSubscriptionUpdated(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof stripeSub.customer === 'string'
        ? stripeSub.customer
        : stripeSub.customer.id;

    const sub = await this.subscriptionRepository.findOne({
      where: { stripeCustomerId: customerId },
    });

    if (!sub) {
      this.logger.warn(
        `Subscription update for unknown customer: ${customerId}`,
      );
      return;
    }

    // Determine plan from price
    const priceId = stripeSub.items.data[0]?.price?.id;
    const plan = priceId ? this.priceToplan[priceId] : undefined;

    if (plan && plan !== sub.plan) {
      sub.plan = plan;
      sub.stripePriceId = priceId!;
      this.logger.log(`User ${sub.userId} plan changed to ${plan}`);
    }

    sub.active =
      stripeSub.status === 'active' || stripeSub.status === 'trialing';

    // Period dates are on items in Stripe SDK v20+
    const item = stripeSub.items.data[0];
    if (item?.current_period_start) {
      sub.periodStart = new Date(item.current_period_start * 1000);
    }
    if (item?.current_period_end) {
      sub.periodEnd = new Date(item.current_period_end * 1000);
    }

    await this.subscriptionRepository.save(sub);
  }

  private async onSubscriptionDeleted(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
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
    sub.stripeSubscriptionId = null as any;
    sub.stripePriceId = null as any;

    await this.subscriptionRepository.save(sub);
    this.logger.log(
      `User ${sub.userId} downgraded to free (subscription cancelled)`,
    );
  }

  private async onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : (invoice.customer as any)?.id;

    if (!customerId) return;

    const sub = await this.subscriptionRepository.findOne({
      where: { stripeCustomerId: customerId },
    });

    if (!sub) return;

    // Mark as past_due but don't deactivate — Stripe retries
    sub.active = false;
    await this.subscriptionRepository.save(sub);

    this.logger.warn(
      `⚠️ Payment failed for user ${sub.userId} — marked as past_due`,
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private async findOrFailSubscription(
    userId: number,
  ): Promise<Subscription> {
    const sub = await this.subscriptionRepository.findOne({
      where: { userId },
    });

    if (!sub) {
      throw new BadRequestException(
        `No subscription found for user ${userId}. Call getOrCreate first.`,
      );
    }

    return sub;
  }
}
