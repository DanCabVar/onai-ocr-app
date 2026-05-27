import { SubscriptionPlan } from '../database/entities/subscription.entity';

export interface CheckoutResult {
  url: string;
  provider: 'polar' | 'stripe';
  sessionId?: string;
}

export interface PortalResult {
  url: string;
  provider: 'polar' | 'stripe';
}

export interface BillingProvider {
  readonly providerName: 'polar' | 'stripe';
  createCheckoutSession(
    userId: number,
    email: string,
    targetPlan: SubscriptionPlan,
  ): Promise<CheckoutResult>;
  createPortalSession(userId: number): Promise<PortalResult>;
}
