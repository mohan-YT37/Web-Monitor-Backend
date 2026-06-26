import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './entities/department.entity';
import { DepartmentController } from './departments.controller';
import { DepartmentService } from './departments.service';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Department]),PermissionsModule],
  controllers: [DepartmentController],
  providers: [DepartmentService],
})
export class DepartmentsModule {}
