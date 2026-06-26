// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { PermissionsModule } from 'src/permissions/permissions.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PermissionsModule, 
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
