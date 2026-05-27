import { Module } from '@nestjs/common';
import { PolarModule } from '../polar/polar.module';
import { StripeModule } from '../stripe/stripe.module';
import { BillingService } from './billing.service';
import { PolarBillingProvider } from './polar-billing.provider';
import { StripeLegacyBillingProvider } from './stripe-legacy-billing.provider';

@Module({
  imports: [PolarModule, StripeModule],
  providers: [BillingService, PolarBillingProvider, StripeLegacyBillingProvider],
  exports: [BillingService],
})
export class BillingModule {}
