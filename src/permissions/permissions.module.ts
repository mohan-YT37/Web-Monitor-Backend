import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../roles/entities/role.entity';
import { Menu } from '../menus/entities/menu.entity';
import { RolePermission } from './entities/role-permission.entity';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Menu, RolePermission])],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
