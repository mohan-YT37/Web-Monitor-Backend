import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsString, Max, Min, ValidateNested } from 'class-validator';

export class MenuPermissionItemDto {
  @IsString()
  @IsNotEmpty()
  menu_public_id!: string;

  @IsInt() @Min(0) @Max(1) view!: number;
  @IsInt() @Min(0) @Max(1) create!: number;
  @IsInt() @Min(0) @Max(1) edit!: number;
  @IsInt() @Min(0) @Max(1) delete!: number;
}

export class UpdateRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuPermissionItemDto)
  permissions!: MenuPermissionItemDto[];
}