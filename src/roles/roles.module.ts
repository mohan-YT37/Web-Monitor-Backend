import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { RoleController } from './roles.controller';
import { RoleService } from './roles.service';
import { MenusModule } from 'src/menus/menus.module';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Role]), PermissionsModule, MenusModule],
  controllers: [RoleController],
  providers: [RoleService],
})
export class RolesModule {}
