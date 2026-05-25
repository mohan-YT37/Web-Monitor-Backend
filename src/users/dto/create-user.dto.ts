import {
  IsEmail,
  IsOptional,
  MinLength,
  IsString,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Username should not be empty' })
  username?: string;

  @IsNotEmpty({ message: 'Email should not be empty' })
  @IsEmail({}, { message: 'Email format is invalid' })
  email?: string;

  @IsNotEmpty({ message: 'Password should not be empty' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @IsNotEmpty({ message: 'Role should not be empty' })
  @IsString()
  role?: string;

  @IsNumber()
  active!: number;
}
