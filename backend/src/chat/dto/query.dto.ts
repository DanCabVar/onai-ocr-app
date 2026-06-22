import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatHistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class QueryDto {
  @IsString()
  @IsNotEmpty({ message: 'La consulta no puede estar vacía' })
  @MinLength(3, { message: 'La consulta debe tener al menos 3 caracteres' })
  query: string;

  @IsOptional()
  conversationId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryMessageDto)
  history?: ChatHistoryMessageDto[];
}
