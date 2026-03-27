import { IsString, IsNotEmpty, MinLength, IsOptional, IsString as IsStr } from 'class-validator';

export class QueryDto {
  @IsString()
  @IsNotEmpty({ message: 'La consulta no puede estar vacía' })
  @MinLength(3, { message: 'La consulta debe tener al menos 3 caracteres' })
  query: string;

  // Accept optional conversationId from frontend (new conversations send null)
  @IsOptional()
  conversationId?: string | null;
}
