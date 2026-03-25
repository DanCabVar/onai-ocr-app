import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/user.entity';
import { SubscriptionPlan, PLAN_LIMITS } from '../database/entities/subscription.entity';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * GET /api/subscriptions/status — current subscription status
   */
  @Get('status')
  async getStatus(@CurrentUser() user: User) {
    return this.subscriptionsService.getStatus(user.id);
  }

  /**
   * GET /api/subscriptions/plans — available plans with limits
   */
  @Get('plans')
  getPlans() {
    return Object.entries(PLAN_LIMITS).map(([plan, limits]) => ({
      plan,
      ...limits,
      docsPerMonth: limits.docsPerMonth === -1 ? 'unlimited' : limits.docsPerMonth,
      docTypesMax: limits.docTypesMax === -1 ? 'unlimited' : limits.docTypesMax,
    }));
  }

  /**
   * PATCH /api/subscriptions/plan — update plan (admin/billing integration point)
   */
  @Patch('plan')
  async updatePlan(
    @CurrentUser() user: User,
    @Body('plan') plan: SubscriptionPlan,
  ) {
    const validPlans: SubscriptionPlan[] = ['free', 'starter', 'pro', 'enterprise'];
    if (!validPlans.includes(plan)) {
      throw new Error(`Plan inválido: ${plan}`);
    }
    return this.subscriptionsService.updatePlan(user.id, plan);
  }
}
