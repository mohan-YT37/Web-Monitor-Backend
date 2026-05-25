import { IsEmail, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Username should not be empty' })
  username?: string;

  @IsNotEmpty({ message: 'Email should not be empty' })
  @IsEmail({}, { message: 'Email format is invalid' })
  email?: string;

  @IsNotEmpty({ message: 'Role should not be empty' })
  @IsString()
  role?: string;

  @IsNumber()
  active!: number;
}
