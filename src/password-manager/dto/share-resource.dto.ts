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

export type ExpireOption = 'never' | '1hour' | '24hours' | '1week' | '1month';
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
  permission_type!: PermissionType;

  @IsString()
  @IsNotEmpty({ message: 'Visibility is required' })
  @IsEnum(['personal', 'public'], {
    message: 'Visibility must be personal or public',
  })
  visibility!: 'personal' | 'public';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SharedUserDto)
  @IsOptional()
  shared_with?: SharedUserDto[];

  @IsString()
  @IsOptional()
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
