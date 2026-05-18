import { Injectable } from '@nestjs/common';

import { Cron } from '@nestjs/schedule';

import { MonitorService } from './monitor.service';

import { MonitorGateway } from './monitor.gateway';

@Injectable()
export class MonitorScheduler {
  constructor(
    private readonly monitorService: MonitorService,
    private readonly gateway: MonitorGateway,
  ) {}

  // Every 10 seconds
  @Cron('*/10 * * * * *') //Run function every 10 seconds
  async handleMonitoring() {
    try {
      const monitors = await this.monitorService.runMonitoring();

      this.gateway.sendMonitorUpdate(monitors);
    } catch (err) {
      console.log(err);
    }
  }
}
