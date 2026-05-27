import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('billing_webhook_events')
@Index(['provider', 'eventId'], { unique: true })
export class BillingWebhookEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  provider: 'polar' | 'stripe';

  @Column({ name: 'event_id', type: 'varchar', length: 150 })
  eventId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
