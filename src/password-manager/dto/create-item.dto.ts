import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
  IsNumber,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

class CustomField {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class CreateItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Item name should not be empty' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Username should not be empty' })
  username!: string;

  @IsString()
  @IsNotEmpty({ message: 'Email should not be empty' })
  email!: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsNotEmpty({ message: 'Password should not be empty' })
  password!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomField)
  @IsOptional()
  custom_fields?: CustomField[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Folder ID is required' })
  folder_id!: number;
}
