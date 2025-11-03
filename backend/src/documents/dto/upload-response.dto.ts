export class UploadResponseDto {
  status: string;
  message: string;
  document?: {
    id: number;
    filename: string;
    fileType: string;
    status: string;
  };
  data?: any;
}

