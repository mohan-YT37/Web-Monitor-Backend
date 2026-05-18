import { Module } from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { MonitorController } from './monitor.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Monitor } from './entities/monitor.entity';
import { MonitorHistory } from './entities/monitor-history.entity';

import { MonitorGateway } from './monitor.gateway';

import { MonitorScheduler } from './monitor.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([Monitor, MonitorHistory])],
  controllers: [MonitorController],
  providers: [MonitorService, MonitorGateway, MonitorScheduler],
})
export class MonitorModule {}
