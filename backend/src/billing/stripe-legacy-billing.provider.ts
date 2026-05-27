import { Injectable } from '@nestjs/common';
import { BillingProvider } from './billing.types';
import { StripeService } from '../stripe/stripe.service';
import { SubscriptionPlan } from '../database/entities/subscription.entity';

@Injectable()
export class StripeLegacyBillingProvider implements BillingProvider {
  readonly providerName = 'stripe' as const;

  constructor(private readonly stripeService: StripeService) {}

  async createCheckoutSession(
    userId: number,
    email: string,
    targetPlan: SubscriptionPlan,
  ) {
    const result = await this.stripeService.createCheckoutSession(
      userId,
      email,
      targetPlan,
    );
    return { ...result, provider: 'stripe' as const };
  }

  async createPortalSession(userId: number) {
    const result = await this.stripeService.createCustomerPortalSession(userId);
    return { ...result, provider: 'stripe' as const };
  }
}
