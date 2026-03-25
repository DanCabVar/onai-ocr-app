import {
  Injectable,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionPlan,
  PLAN_LIMITS,
  PLAN_PRICES,
} from '../database/entities/subscription.entity';
import { StripeService } from '../stripe/stripe.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Get or create a subscription for a user (defaults to free plan).
   */
  async getOrCreate(userId: number): Promise<Subscription> {
    let sub = await this.subscriptionRepository.findOne({
      where: { userId },
    });

    if (sub) {
      // Auto-reset period if expired
      if (sub.periodEnd && new Date() > sub.periodEnd) {
        sub = await this.resetPeriod(sub);
      }
      return sub;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    sub = this.subscriptionRepository.create({
      userId,
      plan: 'free',
      docsUsedThisPeriod: 0,
      periodStart: now,
      periodEnd,
      active: true,
    });

    await this.subscriptionRepository.save(sub);
    this.logger.log(`Created free subscription for user ${userId}`);
    return sub;
  }

  /**
   * Get plan limits for a user.
   */
  async getLimits(userId: number): Promise<typeof PLAN_LIMITS['free']> {
    const sub = await this.getOrCreate(userId);
    return PLAN_LIMITS[sub.plan];
  }

  /**
   * Check if user can process another document.
   * Throws ForbiddenException if limit reached.
   */
  async checkDocumentLimit(userId: number): Promise<void> {
    const sub = await this.getOrCreate(userId);
    const limits = PLAN_LIMITS[sub.plan];

    // -1 = unlimited
    if (limits.docsPerMonth === -1) return;

    if (sub.docsUsedThisPeriod >= limits.docsPerMonth) {
      throw new ForbiddenException(
        `Límite de documentos alcanzado (${limits.docsPerMonth}/mes en plan ${sub.plan}). ` +
          'Actualiza tu plan para procesar más documentos.',
      );
    }
  }

  /**
   * Check if user can create another document type.
   */
  async checkDocTypeLimit(userId: number, currentCount: number): Promise<void> {
    const sub = await this.getOrCreate(userId);
    const limits = PLAN_LIMITS[sub.plan];

    if (limits.docTypesMax === -1) return;

    if (currentCount >= limits.docTypesMax) {
      throw new ForbiddenException(
        `Límite de tipos de documento alcanzado (${limits.docTypesMax} en plan ${sub.plan}). ` +
          'Actualiza tu plan para crear más tipos.',
      );
    }
  }

  /**
   * Increment document usage counter after successful processing.
   */
  async incrementUsage(userId: number): Promise<void> {
    await this.subscriptionRepository.increment(
      { userId },
      'docsUsedThisPeriod',
      1,
    );
  }

  /**
   * Update a user's plan (direct, without Stripe).
   */
  async updatePlan(
    userId: number,
    plan: SubscriptionPlan,
  ): Promise<Subscription> {
    const sub = await this.getOrCreate(userId);
    sub.plan = plan;

    // Reset period on plan change
    const now = new Date();
    sub.periodStart = now;
    sub.periodEnd = new Date(now);
    sub.periodEnd.setMonth(sub.periodEnd.getMonth() + 1);
    sub.docsUsedThisPeriod = 0;

    await this.subscriptionRepository.save(sub);
    this.logger.log(`User ${userId} plan updated to ${plan}`);
    return sub;
  }

  // ─── Stripe-integrated methods ────────────────────────────────────

  /**
   * Upgrade plan via Stripe Checkout.
   * Returns the Stripe Checkout URL for the user to complete payment.
   */
  async upgradePlan(
    userId: number,
    email: string,
    planSlug: SubscriptionPlan,
  ): Promise<{ url: string; sessionId: string }> {
    // Ensure subscription record exists
    await this.getOrCreate(userId);
    return this.stripeService.createCheckoutSession(userId, email, planSlug);
  }

  /**
   * Sync subscription data from Stripe by subscription ID.
   * Fetches latest data from Stripe API and updates local DB.
   */
  async syncFromStripe(stripeSubscriptionId: string): Promise<Subscription> {
    return this.stripeService.syncFromStripe(stripeSubscriptionId);
  }

  /**
   * Get Stripe Customer Portal URL for a user to manage their billing.
   */
  async getPortalUrl(userId: number): Promise<{ url: string }> {
    // Ensure subscription record exists
    await this.getOrCreate(userId);
    return this.stripeService.createCustomerPortalSession(userId);
  }

  // ─── Status ───────────────────────────────────────────────────────

  /**
   * Get subscription status for display.
   */
  async getStatus(userId: number): Promise<{
    plan: SubscriptionPlan;
    docsUsed: number;
    docsLimit: number;
    docTypesLimit: number;
    maxFileSizeMb: number;
    price: number | null;
    periodEnd: Date | null;
    active: boolean;
  }> {
    const sub = await this.getOrCreate(userId);
    const limits = PLAN_LIMITS[sub.plan];

    return {
      plan: sub.plan,
      docsUsed: sub.docsUsedThisPeriod,
      docsLimit: limits.docsPerMonth,
      docTypesLimit: limits.docTypesMax,
      maxFileSizeMb: limits.maxFileSizeMb,
      price: PLAN_PRICES[sub.plan],
      periodEnd: sub.periodEnd,
      active: sub.active,
    };
  }

  /**
   * Reset billing period.
   */
  private async resetPeriod(sub: Subscription): Promise<Subscription> {
    const now = new Date();
    sub.periodStart = now;
    sub.periodEnd = new Date(now);
    sub.periodEnd.setMonth(sub.periodEnd.getMonth() + 1);
    sub.docsUsedThisPeriod = 0;

    await this.subscriptionRepository.save(sub);
    this.logger.log(`Period reset for user ${sub.userId}`);
    return sub;
  }
}
