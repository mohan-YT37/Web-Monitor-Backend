import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
  IsNumber,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FolderPermissionDto {
  @IsNumber()
  user_id!: number;

  @IsString()
  user_name!: string;

  @IsString()
  @IsIn(['view', 'edit'])
  access!: 'view' | 'edit';
}

export class CreateFolderDto {
  @IsString()
  @IsNotEmpty({ message: 'Folder name should not be empty' })
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FolderPermissionDto)
  @IsOptional()
  permissions?: FolderPermissionDto[];
}
