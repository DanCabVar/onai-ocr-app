import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class QueryDto {
  @IsString()
  @IsNotEmpty({ message: 'La consulta no puede estar vacía' })
  @MinLength(3, { message: 'La consulta debe tener al menos 3 caracteres' })
  query: string;
}

