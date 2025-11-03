import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Document } from './document.entity';

export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  label: string;
  required: boolean;
  description?: string;
}

export interface FieldSchema {
  fields: FieldDefinition[];
}

@Entity('document_types')
export class DocumentType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'field_schema', type: 'jsonb' })
  fieldSchema: FieldSchema;

  @Column({ name: 'folder_path', nullable: true })
  folderPath: string;

  @Column({ name: 'google_drive_folder_id', nullable: true })
  googleDriveFolderId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Document, (document) => document.documentType)
  documents: Document[];
}

