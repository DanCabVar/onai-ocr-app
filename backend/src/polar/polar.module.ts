import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../database/entities/subscription.entity';
import { BillingWebhookEvent } from '../database/entities/billing-webhook-event.entity';
import { PolarService } from './polar.service';
import { PolarController } from './polar.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, BillingWebhookEvent])],
  providers: [PolarService],
  controllers: [PolarController],
  exports: [PolarService],
})
export class PolarModule {}
