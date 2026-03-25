import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  RawBodyRequest,
  Headers,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { SubscriptionPlan, PLAN_LIMITS } from '../database/entities/subscription.entity';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
  ) {}

  // ─── Authenticated endpoints ───

  @UseGuards(JwtAuthGuard)
  @Get()
  async getStatusShort(@CurrentUser() user: User) {
    return this.subscriptionsService.getStatus(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@CurrentUser() user: User) {
    return this.subscriptionsService.getStatus(user.id);
  }

  @Get('plans')
  getPlans() {
    return Object.entries(PLAN_LIMITS).map(([plan, limits]) => ({
      plan,
      ...limits,
      docsPerMonth: limits.docsPerMonth === -1 ? 'unlimited' : limits.docsPerMonth,
      docTypesMax: limits.docTypesMax === -1 ? 'unlimited' : limits.docTypesMax,
    }));
  }

  @UseGuards(JwtAuthGuard)
  @Patch('plan')
  async updatePlan(
    @CurrentUser() user: User,
    @Body('plan') plan: SubscriptionPlan,
  ) {
    const validPlans: SubscriptionPlan[] = ['free', 'starter', 'pro', 'enterprise'];
    if (!validPlans.includes(plan)) {
      throw new BadRequestException(`Plan inválido: ${plan}`);
    }
    return this.subscriptionsService.updatePlan(user.id, plan);
  }

  // ─── Stripe Checkout ───

  /**
   * POST /api/subscriptions/checkout — create Stripe Checkout session
   * Body: { plan: 'starter' | 'pro' | 'enterprise' }
   */
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
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
   * POST /api/subscriptions/portal — create Stripe Customer Portal session
   */
  @UseGuards(JwtAuthGuard)
  @Post('portal')
  async createPortal(@CurrentUser() user: User) {
    return this.stripeService.createPortalSession(user.id);
  }

  // ─── Stripe Webhook (no auth guard — verified by signature) ───

  /**
   * POST /api/subscriptions/webhook — Stripe webhook handler
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
      throw new BadRequestException('Raw body not available. Ensure rawBody is enabled.');
    }

    await this.stripeService.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
