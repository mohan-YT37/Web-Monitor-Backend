// src/passwords/password-logs/password-logs.module.ts
import { Module } from '@nestjs/common';
import { LogsService } from './password-logs.service';
import { LogsController } from './password-logs.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log } from './entities/password-log.entity';
import { User } from 'src/users/entities/user.entity';
import { PermissionsModule } from 'src/permissions/permissions.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([Log, User]),
    PermissionsModule,
  ],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}