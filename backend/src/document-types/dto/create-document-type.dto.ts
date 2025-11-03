import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FieldDefinitionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNotEmpty()
  required: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateDocumentTypeDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinitionDto)
  fields: FieldDefinitionDto[];
}

