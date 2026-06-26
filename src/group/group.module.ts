// src/group/group.module.ts
import { Module } from '@nestjs/common';
import { GroupsController } from './group.controller';
import { GroupsService } from './group.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from './entities/group.entity';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group]),
    PermissionsModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupModule {}
