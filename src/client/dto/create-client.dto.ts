import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateClientDto {
  // Client Details
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  client_name!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  company_name!: string;

  // Emails
  @IsEmail()
  @IsNotEmpty()
  email_1!: string;

  @IsOptional()
  @IsEmail()
  email_2?: string;

  // Mobile Numbers
  @IsString()
  @IsNotEmpty()
  @Length(8, 20)
  mobile_no_1!: string;

  @IsOptional()
  @IsString()
  @Length(8, 20)
  mobile_no_2?: string;

  // Contact
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  contact_person!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  contact_type!: string;

  // Status
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  active?: number;
}
