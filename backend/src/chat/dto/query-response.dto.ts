export class QueryResponseDto {
  response: string;
  executedQuery?: string | null;
  data?: Record<string, any>[] | null;
  rowCount?: number;
  timestamp: Date;
}
