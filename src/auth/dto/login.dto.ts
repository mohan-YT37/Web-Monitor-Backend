import { IsEmail, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email format is invalid' })
  email!: string;

  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;
}
