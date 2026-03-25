import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'enterprise';

/**
 * Plan limits (documents per month).
 * Enterprise = unlimited (represented as Infinity at runtime, -1 in DB).
 */
export const PLAN_LIMITS: Record<SubscriptionPlan, {
  docsPerMonth: number;
  docTypesMax: number;
  maxFileSizeMb: number;
  batchInferMax: number;
}> = {
  free:       { docsPerMonth: 20,    docTypesMax: 3,   maxFileSizeMb: 5,  batchInferMax: 5  },
  starter:    { docsPerMonth: 200,   docTypesMax: 10,  maxFileSizeMb: 10, batchInferMax: 10 },
  pro:        { docsPerMonth: 2000,  docTypesMax: 50,  maxFileSizeMb: 25, batchInferMax: 10 },
  enterprise: { docsPerMonth: -1,    docTypesMax: -1,  maxFileSizeMb: 50, batchInferMax: 10 },
};

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ name: 'user_id' })
  userId: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'free',
  })
  plan: SubscriptionPlan;

  /** Docs processed in current billing period */
  @Column({ name: 'docs_used_this_period', type: 'int', default: 0 })
  docsUsedThisPeriod: number;

  /** Start of current billing period */
  @Column({ name: 'period_start', type: 'timestamptz', nullable: true })
  periodStart: Date;

  /** End of current billing period */
  @Column({ name: 'period_end', type: 'timestamptz', nullable: true })
  periodEnd: Date;

  /** Whether the subscription is active */
  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
