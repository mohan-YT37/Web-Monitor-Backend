import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  IsNumber,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type ExpireOption = '1hour' | '24hours' | '1week' | '1month' | 'never';
export type PermissionType = 'view' | 'edit';

export class SharedUserDto {
  @IsNumber()
  id!: number;

  @IsEnum(['view', 'edit'])
  permission!: PermissionType;
}

export class ShareResourceDto {
  @IsString()
  @IsNotEmpty({ message: 'Resource type is required' })
  @IsEnum(['folder', 'item'], {
    message: 'Resource type must be folder or item',
  })
  resource_type!: 'folder' | 'item';

  @IsString()
  @IsNotEmpty({ message: 'Permission type is required' })
  @IsEnum(['view', 'edit'], { message: 'Permission must be view or edit' })
  permission_type!: PermissionType; // Global permission (for public) or default

  @IsString()
  @IsNotEmpty({ message: 'Visibility is required' })
  @IsEnum(['personal', 'public'], {
    message: 'Visibility must be personal or public',
  })
  visibility!: 'personal' | 'public';

  /**
   * For personal: per-user { id, permission } entries
   * For public: empty array (global permission_type applies)
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SharedUserDto)
  @IsOptional()
  shared_with?: SharedUserDto[];

  /**
   * Expiry: '1hour' | '24hours' | '1week' | '1month' | 'never'
   */
  @IsString()
  @IsOptional()
  @IsEnum(['1hour', '24hours', '1week', '1month', 'never'], {
    message: 'expires_in must be 1hour, 24hours, 1week, 1month, or never',
  })
  expires_in?: ExpireOption;
}

export class VerifyShareOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'Share token is required' })
  share_token!: string;

  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  otp!: string;
}

export class CheckShareEmailDto {
  @IsString()
  @IsNotEmpty({ message: 'Share token is required' })
  share_token!: string;

  @IsString()
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}
