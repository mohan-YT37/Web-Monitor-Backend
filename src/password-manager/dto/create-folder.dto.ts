import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
  IsNumber,
} from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @IsNotEmpty({ message: 'Folder name should not be empty' })
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  permissions?: number[]; // User IDs who can access this folder
}
