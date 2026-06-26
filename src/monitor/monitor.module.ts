// src/monitor/monitor.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MonitorService } from './monitor.service';
import { MonitorController } from './monitor.controller';
import { Monitor } from './entities/monitor.entity';
import { MonitorHistory } from './entities/monitor-history.entity';
import { MonitorGateway } from './monitor.gateway';
import { MonitorScheduler } from './monitor.scheduler';
import { MailModule } from 'src/mail/mail.module';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Monitor, MonitorHistory]),
    ScheduleModule.forRoot(),
    MailModule,
    PermissionsModule, 
  ],
  controllers: [MonitorController],
  providers: [MonitorService, MonitorGateway, MonitorScheduler],
  exports: [MonitorService],
})
export class MonitorModule {}
