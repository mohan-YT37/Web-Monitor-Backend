// src/tags/tags.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from './entities/tag.entity';
import { TagController } from './tags.controller';
import { TagService } from './tags.service';
import { PermissionsModule } from 'src/permissions/permissions.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([Tag]),
    PermissionsModule, 
  ],
  controllers: [TagController],
  providers: [TagService],
})
export class TagsModule {}