import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Username should not be empty' })
  username?: string;

  @IsNotEmpty({ message: 'Email should not be empty' })
  @IsEmail({}, { message: 'Email format is invalid' })
  email?: string;

  @ValidateIf(
    (_, value) => value !== '' && value !== null && value !== undefined,
  )
  @IsString()
  @MinLength(6, {
    message: 'Password must be at least 6 characters',
  })
  password?: string | null;

  @IsNotEmpty({ message: 'Role should not be empty' })
  @IsString()
  role?: string;

  @IsNumber()
  active!: number;
}
