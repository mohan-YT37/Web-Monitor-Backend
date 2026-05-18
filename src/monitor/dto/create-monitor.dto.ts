// CreateMonitorDto with all backend-required fields
import { IsString, IsBoolean, IsNumber, IsOptional, IsEmail, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMonitorDto {
  @IsString()
  name!: string;

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
  retryCount?: number = 2;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  sslEnabled?: boolean = true;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  domainEnabled?: boolean = true;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  paused?: boolean = false;

  @IsString()
  @IsIn(['email', 'webhook', 'both'])
  @IsOptional()
  notificationType?: string = 'email';

  @IsEmail()
  @IsOptional()
  notification_email?: string;
}