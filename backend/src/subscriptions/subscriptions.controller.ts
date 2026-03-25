import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import {
  SubscriptionPlan,
  PLAN_LIMITS,
  PLAN_PRICES,
} from '../database/entities/subscription.entity';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
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
    const planDescriptions: Record<string, { description: string; features: string[] }> = {
      free: {
        description: 'Para comenzar',
        features: [`${PLAN_LIMITS.free.docsPerMonth} documentos/mes`, 'OCR básico', `${PLAN_LIMITS.free.docTypesMax} tipo(s) de documento`],
      },
      starter: {
        description: 'Para pequeños negocios',
        features: [`${PLAN_LIMITS.starter.docsPerMonth} documentos/mes`, 'OCR avanzado', `${PLAN_LIMITS.starter.docTypesMax} tipos de documento`, 'Soporte email'],
      },
      pro: {
        description: 'Para empresas en crecimiento',
        features: [`${PLAN_LIMITS.pro.docsPerMonth.toLocaleString()} documentos/mes`, 'OCR avanzado + IA', 'Tipos ilimitados', 'Soporte prioritario', 'API access'],
      },
      enterprise: {
        description: 'Solución a medida',
        features: ['Documentos ilimitados', 'IA personalizada', 'SLA dedicado', 'Soporte 24/7', 'On-premise disponible'],
      },
    };

    return Object.entries(PLAN_LIMITS).map(([plan, limits]) => ({
      id: plan,
      name: plan.toUpperCase(),
      plan,
      price: PLAN_PRICES[plan as SubscriptionPlan],
      documentsLimit: limits.docsPerMonth === -1 ? null : limits.docsPerMonth,
      docsPerMonth: limits.docsPerMonth === -1 ? 'unlimited' : limits.docsPerMonth,
      docTypesMax: limits.docTypesMax === -1 ? 'unlimited' : limits.docTypesMax,
      maxFileSizeMb: limits.maxFileSizeMb,
      ...planDescriptions[plan],
    }));
  }

  @UseGuards(JwtAuthGuard)
  @Patch('plan')
  async updatePlan(
    @CurrentUser() user: User,
    @Body('plan') plan: SubscriptionPlan,
  ) {
    const validPlans: SubscriptionPlan[] = [
      'free',
      'starter',
      'pro',
      'enterprise',
    ];
    if (!validPlans.includes(plan)) {
      throw new BadRequestException(`Plan inválido: ${plan}`);
    }
    return this.subscriptionsService.updatePlan(user.id, plan);
  }

  // ─── Stripe convenience endpoints (delegates to SubscriptionsService) ───

  /**
   * POST /api/subscriptions/checkout
   * Convenience endpoint: creates Stripe Checkout session via SubscriptionsService.
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
    return this.subscriptionsService.upgradePlan(user.id, user.email, plan);
  }

  /**
   * POST /api/subscriptions/portal
   * Convenience endpoint: creates Stripe Customer Portal session.
   */
  @UseGuards(JwtAuthGuard)
  @Post('portal')
  async createPortal(@CurrentUser() user: User) {
    return this.subscriptionsService.getPortalUrl(user.id);
  }
}
