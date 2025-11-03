import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { DocumentType } from './document-type.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'document_type_id', nullable: true })
  documentTypeId: number;

  @Column()
  filename: string;

  @Column({ name: 'google_drive_link', type: 'text', nullable: true })
  googleDriveLink: string;

  @Column({ name: 'google_drive_file_id', nullable: true })
  googleDriveFileId: string;

  @Column({ name: 'extracted_data', type: 'jsonb', nullable: true })
  extractedData: Record<string, any>;

  @Column({ name: 'inferred_data', type: 'jsonb', nullable: true })
  inferredData: Record<string, any>; // Campos inferidos para documentos "Otros"

  @Column({ name: 'ocr_raw_text', type: 'text', nullable: true })
  ocrRawText: string;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidenceScore: number;

  @Column({ default: 'processing' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => DocumentType, (documentType) => documentType.documents, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_type_id' })
  documentType: DocumentType;
}

