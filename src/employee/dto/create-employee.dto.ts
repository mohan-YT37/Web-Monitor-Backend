// create-employee.dto.ts
import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDateString,
  IsEnum,
  ValidateIf,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @MaxLength(120)
  emp_name!: string;

  @IsString()
  @MaxLength(120)
  father_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emp_blood_group?: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: Date;

  @IsOptional()
  @IsDateString()
  joining_date?: Date;

  @IsOptional()
  @IsDateString()
  relieve_date?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  qualification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  joining_role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  current_role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  group_name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(20)
  mobile_no!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergency_contact?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  joining_salary!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  current_salary!: number;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  @IsBoolean()
  bond?: boolean;

  @ValidateIf((o) => o.bond === true)
  @IsDateString()
  bond_start_date?: Date;

  @ValidateIf((o) => o.bond === true)
  @IsDateString()
  bond_end_date?: Date;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsOptional()
  @IsBoolean()
  return_document?: boolean;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  allowed_leave_days?: number;

  @IsOptional()
  @IsEnum(['temporary', 'permanent'])
  employee_type?: 'temporary' | 'permanent';

  @Transform(({ value }) => (value === 'null' ? null : value))
  @IsOptional()
  @IsString()
  document?: string | null;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  active?: number;

  @IsString()
  @MaxLength(100)
  username!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(255)
  password!: string;
}
