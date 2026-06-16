import {
  IsString,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsEmail,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateMonitorDto {
  @IsOptional()
  @IsNumber()
  client_id!: number | null;

  @IsString()
  client_name!: string;

  @IsString()
  website_name!: string;

  @IsString()
  url!: string;

  @Type(() => Number)
  @IsNumber()
  interval!: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  timeout?: number = 30;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  retry_count?: number = 2;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  ssl_enabled?: boolean = true;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  domain_enabled?: boolean = true;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  paused?: boolean = false;

  @IsString()
  @IsOptional()
  notification_type?: string = 'email';

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsEmail()
  @IsOptional()
  notification_email?: string;
}
