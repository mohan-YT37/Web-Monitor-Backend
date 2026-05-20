
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MonitorService } from './monitor.service';
import { MonitorGateway } from './monitor.gateway';

@Injectable()
export class MonitorScheduler {
  private readonly logger = new Logger(MonitorScheduler.name);

  constructor(
    private readonly monitorService: MonitorService,
    private readonly gateway: MonitorGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleIntervalMonitoring() {
    this.logger.log(
      `[SCHEDULER] Running interval checks at ${new Date().toLocaleTimeString()}`,
    );

    try {
      const updatedMonitors = await this.monitorService.runMonitoring();

      if (updatedMonitors.length > 0) {
        this.gateway.sendBatchUpdate(updatedMonitors);
        this.logger.log(
          `[SCHEDULER] Completed - ${updatedMonitors.length} monitors updated`,
        );
      }
    } catch (err: any) {
      this.logger.error(`[SCHEDULER] Error: ${err.message}`);
    }
  }
}
