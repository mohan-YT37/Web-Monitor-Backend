import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsEnum,
} from 'class-validator';
import { LogAction, LogResourceType } from 'src/common/enum/log.enum';

export class CreateLogDto {
  @IsNumber()
  @IsOptional()
  user_id?: number;

  @IsString()
  @IsOptional()
  user_name?: string;

  @IsString()
  @IsOptional()
  user_email?: string;

  @IsEnum(LogAction, {
    message: `Action must be one of: ${Object.values(LogAction).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Action is required' })
  action!: LogAction;

  @IsEnum(LogResourceType, {
    message: `Resource type must be one of: ${Object.values(LogResourceType).join(', ')}`,
  })
  @IsNotEmpty({ message: 'Resource type is required' })
  resource_type!: LogResourceType;

  @IsNumber()
  @IsOptional()
  resource_id?: number;

  @IsString()
  @IsOptional()
  resource_public_id?: string;

  @IsString()
  @IsOptional()
  resource_name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any> | null;
}