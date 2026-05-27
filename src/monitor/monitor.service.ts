import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import axios from 'axios';
import * as ping from 'ping';
import * as dns from 'dns';
import sslChecker from 'ssl-checker';
import { Monitor } from './entities/monitor.entity';
import { MonitorHistory } from './entities/monitor-history.entity';
import * as XLSX from 'xlsx';
import * as nodemailer from 'nodemailer';
import {
  successResponse,
  errorResponse,
} from 'src/common/response/response.util';
import { CatchError } from 'src/common/response/error.utils';
import { MonitorGateway } from './monitor.gateway';
import type { UpdateMonitorDto } from './dto/update-monitor.dto';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class MonitorService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(Monitor)
    private monitorRepo: Repository<Monitor>,
    @InjectRepository(MonitorHistory)
    private historyRepo: Repository<MonitorHistory>,
    @Inject(forwardRef(() => MonitorGateway))
    private monitorGateway: MonitorGateway,
  ) {
    if (process.env.MAIL_USER && process.env.MAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });
    }
  }

  private logMonitorResult(monitor: Monitor) {
    console.log(`STATUS         : ${monitor.status}`);
    console.log(`RESPONSE       : ${monitor.response_time || 0} ms`);
    console.log(`PING           : ${monitor.ping_response || 0} ms`);
    console.log(`IP ADDRESS     : ${monitor.ip_address || 'Unavailable'}`);

    console.log(`SSL STATUS     : ${monitor.ssl_status || 'N/A'}`);
    console.log(`SSL DAYS LEFT  : ${monitor.ssl_days_left || 0}`);

    console.log(`DOMAIN STATUS  : ${monitor.domain_status || 'N/A'}`);
    console.log(`DOMAIN DAYS    : ${monitor.domain_days_left || 0}`);

    console.log(`UPTIME         : ${monitor.uptime_percentage}%`);
    console.log(`TOTAL CHECKS   : ${monitor.total_checks}`);
    console.log(`SUCCESS        : ${monitor.success_checks}`);
    console.log(`FAILED         : ${monitor.failed_checks}`);

    if (monitor.last_error) {
      console.log(`LAST ERROR     : ${monitor.last_error}`);
    }
  }

  private logMonitoringStart(total: number) {
    console.log('\n');
    console.log(`================ MONITORING STARTED =================`);
    console.log(`TOTAL MONITORS : ${total}`);
    console.log(`TIME           : ${new Date().toLocaleString()}`);
  }

  private logMonitoringEnd() {
    console.log('\n');
    console.log(`================ MONITORING FINISHED ================`);
    console.log(`TIME           : ${new Date().toLocaleString()}`);
  }

  private getRootDomain(hostname: string): string {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      const secondLevel = parts[parts.length - 2];
      if (['co', 'com', 'org', 'net', 'gov', 'io'].includes(secondLevel)) {
        return parts.slice(-3).join('.');
      }
    }
    return parts.slice(-2).join('.');
  }

  private async checkSSL(hostname: string, monitor: Monitor): Promise<void> {
    if (!monitor.ssl_enabled) return;

    try {
      const sslData = await sslChecker(hostname, {
        method: 'GET',
        port: 443,
        rejectUnauthorized: false,
      });

      monitor.ssl_expiry_date = sslData.validTo || 'Unavailable';
      monitor.valid_from = sslData.validFrom || '';
      monitor.ssl_days_left = sslData.daysRemaining || 0;
      monitor.validation_error = sslData.validationError || '';

      if (sslData.valid) {
        monitor.ssl_status =
          sslData.daysRemaining <= 7 ? 'SSL Expiring Soon' : 'SSL Valid';
      } else if (sslData.daysRemaining <= 0) {
        monitor.ssl_status = 'SSL Expired';
      } else if (sslData.validationError) {
        monitor.ssl_status = sslData.validationError;
      } else {
        monitor.ssl_status = 'Invalid SSL';
      }
    } catch (error: any) {
      monitor.ssl_expiry_date = 'No SSL';
      monitor.ssl_days_left = 0;
      monitor.valid_from = '';
      monitor.validation_error = error?.message || 'SSL Validation Failed';

      if (error?.message?.includes('self signed certificate')) {
        monitor.ssl_status = 'Self Signed Certificate';
      } else if (error?.message?.includes('certificate has expired')) {
        monitor.ssl_status = 'SSL Certificate Expired';
      } else {
        monitor.ssl_status = 'No SSL / Invalid SSL';
      }
    }
  }

  private async checkDomain(hostname: string, monitor: Monitor): Promise<void> {
    if (!monitor.domain_enabled) return;

    try {
      const rootDomain = this.getRootDomain(hostname);

      const rdapUrl = `https://rdap.org/domain/${rootDomain}`;

      const rdapResponse = await axios.get(rdapUrl, {
        timeout: 3000,
      });

      const rdapData = rdapResponse.data;

      const expirationEvent = rdapData.events?.find(
        (event: any) => event.eventAction === 'expiration',
      );

      const expiryDate = expirationEvent?.eventDate;

      if (expiryDate) {
        monitor.domain_expiry_date = expiryDate;

        const expire = new Date(expiryDate).getTime();

        const now = Date.now();

        monitor.domain_days_left = Math.floor(
          (expire - now) / (1000 * 60 * 60 * 24),
        );

        // DOMAIN STATUS

        if (monitor.domain_days_left <= 0) {
          monitor.domain_status = 'Domain Expired';
        } else if (monitor.domain_days_left <= 7) {
          monitor.domain_status = 'Domain Expiring Soon';
        } else {
          monitor.domain_status = 'Domain Active';
        }
      } else {
        monitor.domain_expiry_date = 'Unavailable';
        monitor.domain_days_left = 0;
        monitor.domain_status = 'Domain Unknown';
      }
    } catch (error) {
      monitor.domain_expiry_date = 'Unavailable';
      monitor.domain_days_left = 0;
      monitor.domain_status = 'Domain Check Failed';
    }
    console.log('domain_status', monitor?.domain_status);
  }

  private async sendDownNotification(monitor: Monitor): Promise<void> {
    if (!monitor.notification_email || !this.transporter) return;

    try {
      await this.transporter.sendMail({
        from: `${process.env.MAIL_FROM || 'Monitor'} <${process.env.MAIL_USER}>`,
        to: monitor.notification_email,
        subject: `[DOWN] Website is Down: ${monitor.website_name}`,
        html: `
          <div style="font-family:Arial;padding:20px">
            <h2 style="color:red">Website Down Alert</h2>
            <p><b>${monitor.website_name}</b> is currently DOWN</p>
            <p><b>URL:</b> ${monitor.url}</p>
            <p><b>Error:</b> ${monitor.last_error || 'Connection failed'}</p>
            <p><b>Down Time:</b> ${new Date().toLocaleString()}</p>
            <hr/>
            <p style="font-size:12px;color:gray">Monitor ID: ${monitor.public_id}</p>
          </div>
        `,
      });
      console.log(`[EMAIL] Down notification sent for ${monitor.website_name}`);
    } catch (err: any) {
      console.log(
        `[EMAIL] Failed to send for ${monitor.website_name}:`,
        err.message,
      );
    }
  }

  private async sendRecoveryNotification(
    monitor: Monitor,
    downtimeMinutes: number,
  ): Promise<void> {
    if (!monitor.notification_email || !this.transporter) return;

    try {
      await this.transporter.sendMail({
        from: `${process.env.MAIL_FROM || 'Monitor'} <${process.env.MAIL_USER}>`,
        to: monitor.notification_email,
        subject: `[RECOVERED] Website is Back Up: ${monitor.website_name}`,
        html: `
          <div style="font-family:Arial;padding:20px">
            <h2 style="color:green">Website Recovered</h2>
            <p><b>${monitor.website_name}</b> is now UP again</p>
            <p><b>URL:</b> ${monitor.url}</p>
            <p><b>Recovered At:</b> ${new Date().toLocaleString()}</p>
            <p><b>Total Downtime:</b> ${downtimeMinutes} minute(s)</p>
            <hr/>
            <p style="font-size:12px;color:gray">Monitor ID: ${monitor.public_id}</p>
          </div>
        `,
      });
      console.log(
        `[EMAIL] Recovery notification sent for ${monitor.website_name}`,
      );
    } catch (err: any) {
      console.log(
        `[EMAIL] Failed to send for ${monitor.website_name}:`,
        err.message,
      );
    }
  }

  private async getMonitorWithFullHistory(monitorId: number): Promise<Monitor> {
    const monitor = await this.monitorRepo.findOne({
      where: { id: monitorId },
      relations: ['history'],
    });

    if (!monitor) {
      throw new Error(`Monitor with id ${monitorId} not found`);
    }

    return monitor;
  }

  async performInstantCheck(
    monitor: Monitor,
    sendNotification = false,
  ): Promise<Monitor> {
    const startTime = Date.now();
    let finalUrl = monitor.url;
    if (!finalUrl.startsWith('http')) {
      finalUrl = `https://${finalUrl}`;
    }

    try {
      const response = await axios.get(finalUrl, {
        timeout: 3000,
        validateStatus: () => true,
      });

      const responseTime = Date.now() - startTime;
      monitor.response_time = responseTime;
      monitor.last_checked = new Date().toISOString();

      if (response.status >= 200 && response.status < 400) {
        monitor.status = 'UP';
        monitor.last_error = '';
        monitor.success_checks = 1;
        monitor.last_up_at = new Date().toISOString();
      } else {
        monitor.status = 'DOWN';
        monitor.last_error = `HTTP ${response.status}`;
        monitor.failed_checks = 1;
        monitor.last_down_at = new Date().toISOString();
      }

      monitor.total_checks = 1;
      monitor.uptime_percentage = monitor.success_checks === 1 ? 100 : 0;

      const parsedUrl = new URL(finalUrl);
      const hostname = parsedUrl.hostname;

      await Promise.allSettled([
        // DNS
        dns.promises
          .lookup(hostname)
          .then((dnsResult) => {
            monitor.ip_address = dnsResult.address;
          })
          .catch(() => {
            monitor.ip_address = 'Unavailable';
          }),

        // Ping
        ping.promise
          .probe(hostname, { timeout: 2 })
          .then((pingResult) => {
            monitor.ping_response = Number(pingResult.time || 0);
          })
          .catch(() => {
            monitor.ping_response = 0;
          }),

        // SSL
        this.checkSSL(hostname, monitor),

        // Domain
        this.checkDomain(hostname, monitor),
      ]);

      // Save monitor first
      const savedMonitor = await this.monitorRepo.save(monitor);

      // Create history record
      const history = this.historyRepo.create({
        monitor: savedMonitor,
        status: savedMonitor.status,
        response_time: responseTime,
        created_at: new Date(),
      });
      await this.historyRepo.save(history);

      if (savedMonitor.status === 'DOWN' && sendNotification) {
        await this.sendDownNotification(savedMonitor);
      }

      // Get full monitor with history for WebSocket
      const fullMonitor = await this.getMonitorWithFullHistory(savedMonitor.id);

      // Send WebSocket update with full history
      this.monitorGateway.sendMonitorUpdate(fullMonitor);
      this.logMonitorResult(fullMonitor);
      return fullMonitor;
    } catch (error: any) {
      monitor.status = 'DOWN';
      monitor.failed_checks = 1;
      monitor.total_checks = 1;
      monitor.last_checked = new Date().toISOString();
      monitor.last_down_at = new Date().toISOString();
      monitor.uptime_percentage = 0;

      if (error.code === 'ECONNABORTED') {
        monitor.last_error = 'Connection Timeout';
      } else if (error.code === 'ENOTFOUND') {
        monitor.last_error = 'DNS Not Found';
      } else if (error.code === 'ECONNREFUSED') {
        monitor.last_error = 'Connection Refused';
      } else {
        monitor.last_error = error.message || 'Unknown Error';
      }

      const savedMonitor = await this.monitorRepo.save(monitor);

      const history = this.historyRepo.create({
        monitor: savedMonitor,
        status: 'DOWN',
        response_time: 0,
        created_at: new Date(),
      });
      await this.historyRepo.save(history);

      if (sendNotification) {
        await this.sendDownNotification(savedMonitor);
      }

      const fullMonitor = await this.getMonitorWithFullHistory(savedMonitor.id);
      this.monitorGateway.sendMonitorUpdate(fullMonitor);

      this.logMonitorResult(fullMonitor);
      return fullMonitor;
    }
  }

  async performIntervalCheck(monitor: Monitor): Promise<Monitor> {
    if (monitor.paused) {
      if (monitor.status !== 'PAUSED') {
        monitor.status = 'PAUSED';
        await this.monitorRepo.save(monitor);
      }
      console.log(
        `******* ${monitor.website_name} is PAUSED in performIntervalCheck *******`,
      );
      return monitor;
    }

    const previousStatus = monitor.status;
    let finalUrl = monitor.url;
    if (!finalUrl.startsWith('http')) {
      finalUrl = `https://${finalUrl}`;
    }

    const start = Date.now();

    try {
      const response = await axios.get(finalUrl, {
        timeout: 3000,
        validateStatus: () => true,
      });

      const responseTime = Date.now() - start;

      if (response.status >= 200 && response.status < 400) {
        const wasDown = monitor.status === 'DOWN';
        monitor.status = 'UP';
        monitor.last_error = '';
        monitor.success_checks += 1;

        if (wasDown) {
          monitor.last_up_at = new Date().toISOString();
          let downtimeMinutes = 0;
          if (monitor.last_down_at) {
            downtimeMinutes = Math.floor(
              (Date.now() - new Date(monitor.last_down_at).getTime()) /
                (1000 * 60),
            );
          }

          await this.sendRecoveryNotification(monitor, downtimeMinutes);
        } else if (previousStatus === 'UP') {
        }
      } else {
        const wasUp = monitor.status === 'UP';
        monitor.status = 'DOWN';
        monitor.last_error = `HTTP ${response.status}`;
        monitor.failed_checks += 1;

        if (wasUp) {
          monitor.last_down_at = new Date().toISOString();

          await this.sendDownNotification(monitor);
        } else if (previousStatus === 'DOWN') {
          console.log(
            `[${monitor.website_name}] STATUS: DOWN | Error: ${monitor.last_error}`,
          );
        }
      }

      monitor.total_checks += 1;
      monitor.response_time = responseTime;
      monitor.last_checked = new Date().toISOString();
      monitor.uptime_percentage = Number(
        ((monitor.success_checks / monitor.total_checks) * 100).toFixed(2),
      );

      // Update response time statistics
      const recentHistory = await this.historyRepo.find({
        where: { monitor: { id: monitor.id } },
        order: { created_at: 'DESC' },
        take: 100,
      });

      const responseTimes = recentHistory
        .map((h) => h.response_time)
        .filter((t) => t && t > 0);

      if (responseTimes.length > 0) {
        monitor.avg_response = Math.floor(
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        );
        monitor.min_response = Math.min(...responseTimes);
        monitor.max_response = Math.max(...responseTimes);
      }

      // Save monitor first
      const savedMonitor = await this.monitorRepo.save(monitor);

      // Create history record
      const history = this.historyRepo.create({
        monitor: savedMonitor,
        status: savedMonitor.status,
        response_time: responseTime,
        created_at: new Date(),
      });
      await this.historyRepo.save(history);

      // Get full monitor with history for WebSocket
      const fullMonitor = await this.getMonitorWithFullHistory(savedMonitor.id);

      // Send WebSocket update with full history
      this.monitorGateway.sendMonitorUpdate(fullMonitor);

      this.logMonitorResult(fullMonitor);
      return fullMonitor;
    } catch (error: any) {
      const wasUp = monitor.status === 'UP';
      monitor.status = 'DOWN';
      monitor.failed_checks += 1;
      monitor.total_checks += 1;
      monitor.last_checked = new Date().toISOString();
      monitor.uptime_percentage = Number(
        ((monitor.success_checks / monitor.total_checks) * 100).toFixed(2),
      );

      if (error.code === 'ECONNABORTED') {
        monitor.last_error = 'Connection Timeout';
      } else if (error.code === 'ENOTFOUND') {
        monitor.last_error = 'DNS Not Found';
      } else if (error.code === 'ECONNREFUSED') {
        monitor.last_error = 'Connection Refused';
      } else if (error.response?.status === 404) {
        monitor.last_error = '404 Not Found';
      } else if (error.response?.status >= 500) {
        monitor.last_error = 'Server Error';
      } else {
        monitor.last_error = error.message || 'Unknown Error';
      }

      if (wasUp) {
        monitor.last_down_at = new Date().toISOString();
        await this.sendDownNotification(monitor);
      } else if (previousStatus === 'DOWN') {
        console.log(
          `[${monitor.website_name}] STATUS: DOWN | Error: ${monitor.last_error}`,
        );
      }

      const savedMonitor = await this.monitorRepo.save(monitor);

      const history = this.historyRepo.create({
        monitor: savedMonitor,
        status: 'DOWN',
        response_time: 0,
        created_at: new Date(),
      });
      await this.historyRepo.save(history);

      const fullMonitor = await this.getMonitorWithFullHistory(savedMonitor.id);
      this.monitorGateway.sendMonitorUpdate(fullMonitor);

      this.logMonitorResult(fullMonitor);
      return fullMonitor;
    }
  }

  async create(data: CreateMonitorDto, user: any) {
    try {
      const existingMonitor = await this.monitorRepo.findOne({
        where: [{ url: data.url }, { website_name: data.website_name }],
      });

      if (existingMonitor) {
        return errorResponse(
          'Monitor already exists with this name or URL',
          409,
        );
      }

      const monitor = this.monitorRepo.create({
        website_name: data.website_name,
        url: data.url,
        interval: data.interval || 5,
        ssl_enabled: data.ssl_enabled ?? true,
        domain_enabled: data.domain_enabled ?? true,
        paused: data?.paused ?? false,
        notification_type: data?.notification_type,
        notification_email: data.notification_email || '',
        status: 'PENDING',

        timeout: data?.timeout,
        retry_count: data?.retry_count,

        created_by: user?.id,
      });

      const savedMonitor = await this.monitorRepo.save(monitor);

      const checkedMonitor = await this.performInstantCheck(
        savedMonitor,
        false,
      );

      return successResponse(
        checkedMonitor,
        'Monitor created Successfully',
        201,
      );
    } catch (error) {
      CatchError(error);
    }
  }

  async runMonitoring(): Promise<Monitor[]> {
    // const monitors = await this.monitorRepo.find({
    //   relations: ['history'],
    // });
    const monitors = await this.monitorRepo.find();

    this.logMonitoringStart(monitors.length);
    const updatedMonitors: Monitor[] = [];

    const results = await Promise.allSettled(
      monitors.map(async (monitor) => {
        if (monitor.paused) return monitor;

        if (!monitor.last_checked) return monitor;

        const lastChecked = new Date(monitor.last_checked).getTime();

        const now = Date.now();

        const intervalMs = monitor.interval * 60 * 1000;

        if (now - lastChecked >= intervalMs) {
          return this.performIntervalCheck(monitor);
        }

        return monitor;
      }),
    );

    const finalResults = results
      .filter((r) => r.status === 'fulfilled')
      .map((r: any) => r.value);

    this.logMonitoringEnd();

    return finalResults;
  }

  @Cron('0 30 17 * * *', {
    timeZone: 'Asia/Kolkata',
  })
  async sendDailyDownReport() {
    try {
      const downSites = await this.monitorRepo.find({
        where: {
          status: 'DOWN',
        },
      });

      if (!downSites.length) {
        console.log('No down sites for daily report');
        return;
      }

      const rows = downSites
        .map(
          (site) => `
          <tr>
            <td>${site.website_name}</td>
            <td>${site.url}</td>
            <td>${site.last_error || '-'}</td>
            <td>${site.response_time || 0} ms</td>
            <td>${site.last_checked || '-'}</td>
          </tr>
        `,
        )
        .join('');

      if (!this.transporter) {
        console.log('Mail transporter not configured');
        return;
      }

      await this.transporter.sendMail({
        from: `${process.env.MAIL_FROM} <${process.env.MAIL_USER}>`,
        to: process.env.REPORT_EMAIL,
        subject: `Daily Down Sites Report`,
        html: `
        <div style="font-family:Arial">
          <h2>Currently Down Sites</h2>

          <table border="1" cellpadding="8" cellspacing="0">
            <thead>
              <tr>
                <th>Website</th>
                <th>URL</th>
                <th>Error</th>
                <th>Response</th>
                <th>Last Checked</th>
              </tr>
            </thead>

            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `,
      });

      console.log('Daily report mail sent');
    } catch (error) {
      console.log('Daily report failed', error);
    }
  }

  async findAll(
    query?: { search?: string; filter?: string; sort?: string },
    user?: any,
  ) {
    try {
      const qb = this.monitorRepo
        .createQueryBuilder('monitor')
        .leftJoinAndSelect('monitor.history', 'history');

      qb.andWhere('monitor.created_by = :userId', {
        userId: user?.id,
      });

      // Search
      if (query?.search) {
        qb.andWhere(
          '(monitor.website_name LIKE :search OR monitor.url LIKE :search)',
          {
            search: `%${query.search}%`,
          },
        );
      }

      // Filter
      if (query?.filter) {
        switch (query.filter.toUpperCase()) {
          case 'UP':
            qb.andWhere('monitor.status = :status', {
              status: 'UP',
            });
            break;

          case 'DOWN':
            qb.andWhere('monitor.status = :status', {
              status: 'DOWN',
            });
            break;

          case 'PAUSED':
            qb.andWhere('monitor.paused = :paused', {
              paused: true,
            });
            break;
        }
      }

      // Sort
      if (query?.sort) {
        switch (query.sort.toUpperCase()) {
          case 'A_Z':
            qb.orderBy('monitor.website_name', 'ASC');
            break;

          case 'Z_A':
            qb.orderBy('monitor.website_name', 'DESC');
            break;

          case 'OLDEST':
            qb.orderBy('monitor.created_at', 'ASC');
            break;

          case 'NEWEST':
          default:
            qb.orderBy('monitor.created_at', 'DESC');
            break;
        }
      } else {
        qb.orderBy('monitor.created_at', 'DESC');
      }

      const [data, count] = await qb.getManyAndCount();

      if (!data || data.length === 0) {
        return successResponse([], 'No monitors found', 200);
      }

      return successResponse(data, 'Monitors fetched successfully', 200);
    } catch (error) {
      CatchError(error);
    }
  }

  async findOne(public_id: string, user: any) {
    try {
      const monitor = await this.monitorRepo.findOne({
        where: { public_id, created_by: user?.id },
        relations: ['history'],
      });

      if (!monitor) {
        return errorResponse('Monitor not found', 404);
      }

      if (monitor.history) {
        monitor.history.sort(
          (a, b) => b.created_at.getTime() - a.created_at.getTime(),
        );
      }

      return successResponse(monitor, 'Monitor fetched successfully');
    } catch (error) {
      CatchError(error);
    }
  }

  async update(public_id: string, data: UpdateMonitorDto, user: any) {
    try {
      const monitor = await this.monitorRepo.findOne({
        where: { public_id, created_by: user?.id },
      });

      if (!monitor) {
        return errorResponse('Monitor not found', 404);
      }

      if (data.url && data.url !== monitor.url) {
        const existing = await this.monitorRepo.findOne({
          where: { url: data.url },
        });
        if (existing) {
          return errorResponse('URL already exists', 409);
        }
      }

      Object.assign(monitor, {
        website_name: data.website_name ?? monitor.website_name,
        url: data.url ?? monitor.url,
        interval: data.interval ?? monitor.interval,
        paused: data.paused ?? monitor.paused,
        ssl_enabled: data.ssl_enabled ?? monitor.ssl_enabled,
        domain_enabled: data.domain_enabled ?? monitor.domain_enabled,
        notification_type: data?.notification_type,
        notification_email:
          data.notification_email ?? monitor.notification_email,
        timeout: data?.timeout,
        retry_count: data?.retry_count,
      });
      monitor.updated_by = user?.id;

      if (typeof data.paused === 'boolean') {
        if (data.paused) {
          monitor.status = 'PAUSED';
        } else {
          monitor.status = monitor.last_error ? 'DOWN' : 'UP';
        }
      }

      const updated = await this.monitorRepo.save(monitor);
      const fullMonitor = await this.getMonitorWithFullHistory(updated.id);
      this.monitorGateway.sendMonitorUpdate(fullMonitor);

      return successResponse(updated, 'Monitor updated successfully', 200);
    } catch (error) {
      CatchError(error);
    }
  }

  async remove(public_id: string, user: any) {
    try {
      const monitor = await this.monitorRepo.findOne({
        where: { public_id },
      });

      if (!monitor) {
        const id = parseInt(public_id);
        if (!isNaN(id)) {
          const monitorById = await this.monitorRepo.findOne({
            where: { id },
          });
          if (monitorById) {
            await this.historyRepo.delete({ monitor: { id: monitorById.id } });
            await this.monitorRepo.delete({ id: monitorById.id });
            return successResponse(null, 'Monitor deleted successfully', 200);
          }
        }

        return errorResponse(
          `Monitor not found with public_id: ${public_id}`,
          404,
        );
      }

      monitor.deleted_by = user?.id;

      await this.monitorRepo.save(monitor);

      await this.historyRepo.delete({ monitor: { id: monitor.id } });
      await this.monitorRepo.delete({ public_id });

      return successResponse(null, 'Monitor deleted successfully', 200);
    } catch (error) {
      CatchError(error);
    }
  }

  async bulkDelete(public_ids: string[], user: any) {
    try {
      if (!public_ids.length) {
        return errorResponse('No monitor ids provided', 400);
      }

      let monitors = await this.monitorRepo.find({
        where: { public_id: In(public_ids) },
      });

      const numericIds = public_ids
        .filter((id) => !isNaN(parseInt(id)))
        .map((id) => parseInt(id));

      if (numericIds.length > 0 && monitors.length === 0) {
        monitors = await this.monitorRepo.find({
          where: { id: In(numericIds) },
        });
      }

      if (!monitors.length) {
        return errorResponse(
          `No monitors found with provided IDs: ${public_ids.join(', ')}`,
          404,
        );
      }

      const ids = monitors.map((m) => m.id);
      for (const monitor of monitors) {
        monitor.deleted_by = user?.id;
      }

      await this.monitorRepo.save(monitors);
      await this.historyRepo.delete({ monitor: { id: In(ids) } });
      await this.monitorRepo.delete({ id: In(ids) });
      return successResponse(
        { deleted: monitors.length },
        'Monitors deleted successfully',
        200,
      );
    } catch (error) {
      CatchError(error);
    }
  }

  async bulkUpload(user: any, file: Express.Multer.File) {
    try {
      if (!file) {
        return errorResponse('File is required', 400);
      }

      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(sheet);
      // console.log('bulk_upload', data);

      const requiredFields = [
        'website_name',
        'url',
        'interval',
        'ssl_enabled',
        'domain_enabled',
      ];

      const excelHeaders = Object.keys(data[0] || {});

      const missingFields = requiredFields.filter(
        (field) => !excelHeaders.includes(field),
      );

      if (missingFields.length > 0) {
        return errorResponse(
          `${missingFields.join(', ')} field(s) are missing in Excel file`,
          400,
        );
      }

      if (!data.length) {
        return errorResponse('Excel file is empty', 400);
      }

      const urls = data.map((item) => item.url);
      const existing = await this.monitorRepo.find({
        where: { url: In(urls) },
      });
      const existingUrls = new Set(existing.map((item) => item.url));

      const newMonitorsData = data
        .filter((item) => !existingUrls.has(item.url))
        .map((item) => ({
          website_name: item.website_name,
          url: item.url,
          interval: item.interval || 5,
          ssl_enabled: item.ssl_enabled !== false,
          domain_enabled: item.domain_enabled !== false,
          notification_email: item.notification_email || '',
          status: 'PENDING',
          created_by: user?.id,
        }));

      if (!newMonitorsData.length) {
        return errorResponse('All monitors already exist', 409);
      }

      const createdMonitors: Monitor[] = [];
      for (const monitorData of newMonitorsData) {
        const monitor = this.monitorRepo.create(monitorData);
        const saved = await this.monitorRepo.save(monitor);
        createdMonitors.push(saved);
      }

      const checkedMonitors = await Promise.all(
        createdMonitors.map((monitor) =>
          this.performInstantCheck(monitor, false),
        ),
      );

      return successResponse(
        {
          inserted: checkedMonitors.length,
          skipped: existingUrls.size,
          data: checkedMonitors,
        },
        'Bulk upload completed with instant checks',
        201,
      );
    } catch (error) {
      CatchError(error);
    }
  }

  async getFilters() {
    return successResponse(
      [
        { value: '', label: 'All' },
        { value: 'UP', label: 'Up' },
        { value: 'DOWN', label: 'Down' },
        { value: 'PAUSED', label: 'Paused' },
      ],
      'Filter options fetched successfully',
      200,
    );
  }

  async getIntervals() {
    return successResponse(
      [
        {
          value: 1,
          label: 'Every 1 minute',
          description: 'Most frequent checks',
          recommended: false,
        },
        {
          value: 5,
          label: 'Every 5 minutes',
          description: 'Recommended for critical sites',
          recommended: true,
        },
        {
          value: 10,
          label: 'Every 10 minutes',
          description: 'Standard monitoring',
          recommended: false,
        },
        {
          value: 15,
          label: 'Every 15 minutes',
          description: 'For less critical sites',
          recommended: false,
        },
        {
          value: 30,
          label: 'Every 30 minutes',
          description: 'Basic monitoring',
          recommended: false,
        },
        {
          value: 60,
          label: 'Every 1 hour',
          description: 'Minimal monitoring',
          recommended: false,
        },
      ],
      'Interval options fetched successfully',
      200,
    );
  }

  async getSorts() {
    return successResponse(
      [
        { value: 'A_Z', label: 'A to Z' },
        { value: 'Z_A', label: 'Z to A' },
        { value: 'NEWEST', label: 'Newest First' },
        { value: 'OLDEST', label: 'Oldest First' },
      ],
      'Sort options fetched successfully',
      200,
    );
  }

  async getTimeRanges() {
    return successResponse(
      [
        { value: '1h', label: 'Last hour' },
        { value: '24h', label: 'Last 24 hours' },
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
      ],
      'Time range options fetched successfully',
    );
  }

  async getNotificationTypes() {
    return successResponse(
      [
        { value: 'email', label: 'Email' },
        { value: 'sms', label: 'SMS' },
        { value: 'telegram', label: 'Telegram' },
        { value: 'webhook', label: 'Webhook' },
      ],
      'Notification Type options fetched successfully',
    );
  }

  async getRetryOptions() {
    return successResponse(
      [
        { value: 1, label: 'One' },
        { value: 2, label: 'Two' },
        { value: 3, label: 'Three' },
        { value: 4, label: 'Four' },
        { value: 5, label: 'Five' },
        { value: 6, label: 'Six' },
      ],
      'Retry options fetched successfully',
    );
  }
}
