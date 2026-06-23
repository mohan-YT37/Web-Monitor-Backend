// dto/create-item.dto.ts
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FolderPermissionDto } from './create-folder.dto';

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
  @IsOptional()
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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FolderPermissionDto)
  @IsOptional()
  permissions?: FolderPermissionDto[];
}
