import { Injectable } from '@nestjs/common';
import { BillingProvider } from './billing.types';
import { PolarService } from '../polar/polar.service';
import { SubscriptionPlan } from '../database/entities/subscription.entity';

@Injectable()
export class PolarBillingProvider implements BillingProvider {
  readonly providerName = 'polar' as const;

  constructor(private readonly polarService: PolarService) {}

  async createCheckoutSession(
    userId: number,
    email: string,
    targetPlan: SubscriptionPlan,
  ) {
    return this.polarService.createCheckoutSession(userId, email, targetPlan);
  }

  async createPortalSession(userId: number) {
    return this.polarService.createPortalSession(userId);
  }
}
