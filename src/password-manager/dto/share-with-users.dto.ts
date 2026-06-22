import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FolderPermissionDto } from './create-folder.dto';

export class ShareWithUsersDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one user to share with' })
  @ValidateNested({ each: true })
  @Type(() => FolderPermissionDto)
  users!: FolderPermissionDto[];
}