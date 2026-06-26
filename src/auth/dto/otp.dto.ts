// src/auth/dto/otp.dto.ts
import { IsEmail, IsNotEmpty, Length, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email format is invalid' })
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email format is invalid' })
  email!: string;

  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  code!: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Email format is invalid' })
  email!: string;

  @MinLength(6, {
    message: 'Password must be at least 6 characters',
  })
  newPassword!: string;
}

export class ResendOtpDto {
  @IsEmail({}, { message: 'Email format is invalid' })
  email!: string;
}
