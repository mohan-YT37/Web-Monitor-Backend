import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateMenuDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsOptional()
  path?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  parent_public_id?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}