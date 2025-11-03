import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('google_tokens')
export class GoogleToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken: string;

  @Column({ name: 'expires_at', type: 'bigint', nullable: true })
  expiresAt: number; // Timestamp en milisegundos

  @Column({ name: 'scope', type: 'text', nullable: true })
  scope: string;

  @Column({ name: 'token_type', default: 'Bearer' })
  tokenType: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

