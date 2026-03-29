export class DocumentResponseDto {
  id: number;
  filename: string;
  fileType: string;
  extractedData: Record<string, any>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

