// src/employee-roles/employee-roles.module.ts
import { Module } from '@nestjs/common';
import { EmployeeRolesService } from './employee-roles.service';
import { EmployeeRolesController } from './employee-roles.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeRole } from './entities/employee-role.entity';
import { PermissionsModule } from 'src/permissions/permissions.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeRole]),
    PermissionsModule,
  ],
  controllers: [EmployeeRolesController],
  providers: [EmployeeRolesService],
})
export class EmployeeRolesModule {}