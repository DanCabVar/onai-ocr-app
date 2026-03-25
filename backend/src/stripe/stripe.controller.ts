import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  RawBodyRequest,
  Headers,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { SubscriptionPlan } from '../database/entities/subscription.entity';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  /**
   * POST /api/stripe/create-checkout
   * Creates a Stripe Checkout session for upgrading plan.
   * Body: { plan: 'starter' | 'pro' | 'enterprise' }
   */
  @UseGuards(JwtAuthGuard)
  @Post('create-checkout')
  async createCheckout(
    @CurrentUser() user: User,
    @Body('plan') plan: SubscriptionPlan,
  ) {
    const paidPlans: SubscriptionPlan[] = ['starter', 'pro', 'enterprise'];
    if (!paidPlans.includes(plan)) {
      throw new BadRequestException(
        `Plan inválido para checkout: "${plan}". Opciones: starter, pro, enterprise.`,
      );
    }
    return this.stripeService.createCheckoutSession(user.id, user.email, plan);
  }

  /**
   * POST /api/stripe/create-portal
   * Creates a Stripe Customer Portal session for billing management.
   */
  @UseGuards(JwtAuthGuard)
  @Post('create-portal')
  async createPortal(@CurrentUser() user: User) {
    return this.stripeService.createCustomerPortalSession(user.id);
  }

  /**
   * POST /api/stripe/webhook
   * Receives Stripe webhook events. No auth guard — verified by signature.
   * Requires raw body for signature verification.
   */
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        'Raw body not available. Ensure rawBody is enabled in NestFactory.create().',
      );
    }

    await this.stripeService.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
