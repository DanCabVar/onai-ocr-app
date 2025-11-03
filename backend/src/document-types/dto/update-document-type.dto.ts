import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FieldDefinitionDto } from './create-document-type.dto';

export class UpdateDocumentTypeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FieldDefinitionDto)
  fields?: FieldDefinitionDto[];
}

