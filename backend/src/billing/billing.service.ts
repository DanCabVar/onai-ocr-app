import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingProvider,
  Subscription,
} from '../database/entities/subscription.entity';
import { SubscriptionPlan } from '../database/entities/subscription.entity';
import { PolarBillingProvider } from './polar-billing.provider';
import { StripeLegacyBillingProvider } from './stripe-legacy-billing.provider';

@Injectable()
export class BillingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly polarProvider: PolarBillingProvider,
    private readonly stripeLegacyProvider: StripeLegacyBillingProvider,
  ) {}

  private getDefaultProvider(): BillingProvider {
    const configured =
      this.configService.get<BillingProvider>('BILLING_DEFAULT_PROVIDER') ||
      'polar';
    return configured === 'stripe' ? 'stripe' : 'polar';
  }

  private resolveProviderForSubscription(
    sub: Subscription,
    intent: 'checkout' | 'portal',
  ) {
    const hasStripeLegacy = Boolean(
      sub.stripeSubscriptionId || sub.stripeCustomerId,
    );

    if (intent === 'checkout') {
      // Cutover rule: new checkouts go to default provider (Polar).
      return this.getDefaultProvider() === 'stripe'
        ? this.stripeLegacyProvider
        : this.polarProvider;
    }

    const provider =
      sub.billingProvider === 'stripe'
        ? this.stripeLegacyProvider
        : sub.billingProvider === 'polar'
          ? this.polarProvider
          : hasStripeLegacy
            ? this.stripeLegacyProvider
            : this.polarProvider;

    return provider;
  }

  async createCheckoutSession(
    sub: Subscription,
    userId: number,
    email: string,
    targetPlan: SubscriptionPlan,
  ) {
    const provider = this.resolveProviderForSubscription(sub, 'checkout');
    return provider.createCheckoutSession(userId, email, targetPlan);
  }

  async createPortalSession(sub: Subscription, userId: number) {
    const provider = this.resolveProviderForSubscription(sub, 'portal');
    return provider.createPortalSession(userId);
  }

  canSelfManageBilling(sub: Subscription): boolean {
    return sub.billingProvider === 'polar';
  }
}
