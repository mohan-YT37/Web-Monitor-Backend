import { Injectable } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository, ILike, In } from 'typeorm';

import axios from 'axios';

import * as ping from 'ping';

import * as dns from 'dns';

import sslChecker from 'ssl-checker';

import { Monitor } from './entities/monitor.entity';

import { MonitorHistory } from './entities/monitor-history.entity';

import * as XLSX from 'xlsx';

import * as nodemailer from 'nodemailer';
import {
  errorResponse,
  successResponse,
} from 'src/common/response/response.util';
import { CatchError } from 'src/common/response/error.utils';

@Injectable()
export class MonitorService {
  private transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  constructor(
    @InjectRepository(Monitor)
    private monitorRepo: Repository<Monitor>,

    @InjectRepository(MonitorHistory)
    private historyRepo: Repository<MonitorHistory>,
  ) {}

  async create(data: any) {
    try {
      const existingMonitor = await this.monitorRepo.findOne({
        where: [
          {
            url: data.url,
          },
          {
            name: data.name,
          },
        ],
      });

      if (existingMonitor) {
        return errorResponse('Monitor already exists', 409);
      }

      const monitor = this.monitorRepo.create({
        ...data,
        status: 'UP',
      });

      const savedMonitor = await this.monitorRepo.save(monitor);

      return successResponse(savedMonitor, 'Monitor created successfully', 201);
    } catch (error) {
      CatchError(error);
    }
  }

  async bulkUpload(file: Express.Multer.File) {
    try {
      if (!file) {
        return errorResponse('File is required', 400);
      }

      const workbook = XLSX.read(file.buffer, {
        type: 'buffer',
      });

      const sheetName = workbook.SheetNames[0];

      const sheet = workbook.Sheets[sheetName];

      const data: any[] = XLSX.utils.sheet_to_json(sheet);

      if (!data.length) {
        return errorResponse('Excel file is empty', 400);
      }

      const urls = data.map((item) => item.url);

      const existing = await this.monitorRepo.find({
        where: {
          url: In(urls),
        },
      });

      const existingUrls = existing.map((item) => item.url);

      const filteredData = data.filter(
        (item) => !existingUrls.includes(item.url),
      );

      if (!filteredData.length) {
        return errorResponse('All monitors already exist', 409);
      }

      const monitors = filteredData.map((item) =>
        this.monitorRepo.create({
          name: item.name,
          url: item.url,
          interval: item.interval || 5,
          ssl_enabled: item.ssl_enabled ?? true,
          domain_enabled: item.domain_enabled ?? true,
          notification_email: item.notification_email || '',
          status: 'UP',
        }),
      );

      const saved = await this.monitorRepo.save(monitors);

      return successResponse(
        {
          inserted: saved.length,
          skipped: existingUrls.length,
          data: saved,
        },
        'Bulk upload completed',
        201,
      );
    } catch (error) {
      CatchError(error);
    }
  }

  async findAll(query?: { search?: string; filter?: string; status?: string }) {
    try {
      const qb = this.monitorRepo
        .createQueryBuilder('monitor')
        .leftJoinAndSelect('monitor.history', 'history');

      // SEARCH
      if (query?.search) {
        qb.andWhere(
          `
        (
          monitor.name LIKE :search
          OR monitor.url LIKE :search
        )
      `,
          {
            search: `%${query.search}%`,
          },
        );
      }

      // STATUS
      if (query?.status) {
        switch (query.status) {
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
            qb.andWhere('monitor.paused = true');
            break;
        }
      }

      // FILTER
      switch (query?.filter) {
        case 'A_Z':
          qb.orderBy('monitor.name', 'ASC');
          break;

        default:
          qb.orderBy('monitor.id', 'DESC');
          break;
      }

      const monitors = await qb.getMany();

      return successResponse(
        monitors.map((item) => ({
          ...item,
          history: item.history || [],
        })),
        monitors.length ? 'Monitors fetched successfully' : 'No monitors found',
        200,
      );
    } catch (error) {
      CatchError(error);
    }
  }

  async findOne(public_id: string) {
    try {
      const monitor = await this.monitorRepo.findOne({
        where: {
          public_id,
        },
        relations: ['history'],
      });

      if (!monitor) {
        return errorResponse('Monitor not found', 404);
      }

      return successResponse(monitor, 'Monitor fetched successfully');
    } catch (error) {
      CatchError(error);
    }
  }

  async update(public_id: string, data: any) {
    try {
      const monitor = await this.monitorRepo.findOne({
        where: {
          public_id,
        },
      });

      if (!monitor) {
        return errorResponse('Monitor not found', 404);
      }

      // DUPLICATE URL CHECK
      if (data.url) {
        const existing = await this.monitorRepo.findOne({
          where: {
            url: data.url,
          },
        });

        if (existing && existing.public_id !== public_id) {
          return errorResponse('URL already exists', 409);
        }
      }

      Object.assign(monitor, {
        name: data.name ?? monitor.name,
        url: data.url ?? monitor.url,
        interval: data.interval ?? monitor.interval,
        paused: data.paused ?? monitor.paused,
        ssl_enabled: data.ssl_enabled ?? monitor.ssl_enabled,
        domain_enabled: data.domain_enabled ?? monitor.domain_enabled,
        notification_email:
          data.notification_email ?? monitor.notification_email,
      });

      const updated = await this.monitorRepo.save(monitor);

      return successResponse(updated, 'Monitor updated successfully');
    } catch (error) {
      CatchError(error);
    }
  }

  async remove(public_id: string) {
    try {
      const monitor = await this.monitorRepo.findOne({
        where: {
          public_id,
        },
      });

      if (!monitor) {
        return errorResponse('Monitor not found', 404);
      }

      await this.historyRepo.delete({
        monitor: {
          id: monitor.id,
        },
      });

      await this.monitorRepo.delete({
        public_id,
      });

      return successResponse([], 'Monitor deleted successfully');
    } catch (error) {
      CatchError(error);
    }
  }

  async bulkDelete(public_ids: string[]) {
    try {
      if (!public_ids.length) {
        return errorResponse('No monitor ids provided', 400);
      }

      const monitors = await this.monitorRepo.find({
        where: {
          public_id: In(public_ids),
        },
      });

      if (!monitors.length) {
        return errorResponse('No monitors found', 404);
      }

      const ids = monitors.map((item) => item.id);

      await this.historyRepo
        .createQueryBuilder()
        .delete()
        .from(MonitorHistory)
        .where('monitorId IN (:...ids)', {
          ids,
        })
        .execute();

      await this.monitorRepo.delete({
        public_id: In(public_ids),
      });

      return successResponse(
        {
          deleted: monitors.length,
        },
        'Monitors deleted successfully',
      );
    } catch (error) {
      CatchError(error);
    }
  }

  getRootDomain(hostname: string) {
    const parts = hostname.split('.');

    if (parts.length >= 3) {
      const secondLevel = parts[parts.length - 2];

      if (['co', 'com', 'org', 'net', 'gov'].includes(secondLevel)) {
        return parts.slice(-3).join('.');
      }
    }

    return parts.slice(-2).join('.');
  }

  async sendDownNotification(monitor: Monitor) {
    console.log('EMAIL =>', monitor.notification_email);
    if (!monitor.notification_email) {
      console.log('NO EMAIL FOUND');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `${process.env.MAIL_FROM} <${process.env.MAIL_USER}>`,
        to: monitor.notification_email,
        subject: `🔴 Website DOWN : ${monitor.name}`,
        html: `
          <div style="font-family:Arial;padding:20px">
            <h2 style="color:red">
              Website Down Alert
            </h2>

            <p>
              <b>${monitor.name}</b> is currently DOWN
            </p>

            <p>
              <b>URL:</b> ${monitor.url}
            </p>

            <p>
              <b>Error:</b> ${monitor.last_error}
            </p>

            <p>
              <b>Down Time:</b> ${new Date().toLocaleString()}
            </p>
          </div>
        `,
      });

      console.log('DOWN EMAIL SENT');
    } catch (err) {
      console.log('MAIL ERROR =>', err);
    }
  }

  async sendRecoveryNotification(monitor: Monitor, downtimeMinutes: number) {
    if (!monitor.notification_email) {
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `${process.env.MAIL_FROM} <${process.env.MAIL_USER}>`,
        to: monitor.notification_email,
        subject: `🟢 Website RECOVERED : ${monitor.name}`,
        html: `
          <div style="font-family:Arial;padding:20px">
            <h2 style="color:green">
              Website Recovered
            </h2>

            <p>
              <b>${monitor.name}</b> is UP again
            </p>

            <p>
              <b>URL:</b> ${monitor.url}
            </p>

            <p>
              <b>Recovered At:</b> ${new Date().toLocaleString()}
            </p>

            <p>
              <b>Total Downtime:</b> ${downtimeMinutes} Minutes
            </p>
          </div>
        `,
      });

      console.log('RECOVERY EMAIL SENT');
    } catch (err) {
      console.log('MAIL ERROR =>', err);
    }
  }

  async checkMonitor(monitor: Monitor) {
    if (monitor.paused) {
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
        timeout: 10000,
        validateStatus: () => true,
      });

      const end = Date.now();

      const responseTime = end - start;

      if (response.status >= 200 && response.status < 400) {
        monitor.status = 'UP';

        monitor.last_error = '';

        monitor.success_checks += 1;

        if (previousStatus === 'DOWN') {
          monitor.last_up_at = new Date().toISOString();

          let downtimeMinutes = 0;

          if (monitor.last_down_at) {
            downtimeMinutes = Math.floor(
              (Date.now() - new Date(monitor.last_down_at).getTime()) /
                (1000 * 60),
            );
          }

          await this.sendRecoveryNotification(monitor, downtimeMinutes);
        }
      } else {
        monitor.status = 'DOWN';

        monitor.last_error = `HTTP ${response.status}`;

        monitor.failed_checks += 1;

        if (previousStatus === 'UP') {
          monitor.last_down_at = new Date().toISOString();

          await this.sendDownNotification(monitor);
        }
      }

      monitor.total_checks += 1;

      monitor.response_time = responseTime;

      monitor.last_checked = new Date().toISOString();

      monitor.uptime_percentage = Number(
        ((monitor.success_checks / monitor.total_checks) * 100).toFixed(2),
      );

      const history = this.historyRepo.create({
        monitor,
        status: monitor.status,
        response_time: responseTime,
      });

      await this.historyRepo.save(history);

      const stats = await this.historyRepo.find({
        where: {
          monitor: {
            id: monitor.id,
          },
        },
        order: {
          id: 'DESC',
        },
        take: 100,
      });

      const values = stats
        .map((item) => item.response_time)
        .filter((v) => v > 0);

      if (values.length) {
        monitor.avg_response = Math.floor(
          values.reduce((a, b) => a + b, 0) / values.length,
        );

        monitor.min_response = Math.min(...values);

        monitor.max_response = Math.max(...values);
      }

      const parsedUrl = new URL(finalUrl);

      const hostname = parsedUrl.hostname;

      try {
        const dnsResult = await dns.promises.lookup(hostname);

        monitor.ip_address = dnsResult.address;
      } catch {
        monitor.ip_address = 'Unavailable';
      }

      let pingTime = 0;

      try {
        const pingResult = await ping.promise.probe(hostname);

        pingTime = Number(pingResult.time || 0);
      } catch {
        pingTime = 0;
      }

      if (monitor.ssl_enabled) {
        try {
          const sslData = await sslChecker(hostname);

          monitor.ssl_enabled = sslData.valid || false;

          monitor.ssl_expiry_date = sslData.validTo || 'Unavailable';

          monitor.valid_from = sslData.validFrom || '';

          monitor.ssl_days_left = sslData.daysRemaining || 0;

          monitor.validation_error = sslData.validationError || '';

          if (sslData.valid) {
            monitor.ssl_status = 'SSL Valid';
          } else if (sslData.daysRemaining <= 0) {
            monitor.ssl_status = 'SSL Expired';
          } else if (sslData.validationError) {
            monitor.ssl_status = sslData.validationError;
          } else {
            monitor.ssl_status = 'Invalid SSL';
          }
        } catch (error: any) {
          monitor.ssl_enabled = false;

          monitor.ssl_expiry_date = 'No SSL';

          monitor.ssl_days_left = 0;

          monitor.valid_from = '';

          monitor.validation_error = error?.message || 'SSL Validation Failed';

          if (error?.message?.includes('self signed certificate')) {
            monitor.ssl_status = 'Self Signed Certificate';
          } else if (error?.message?.includes('certificate has expired')) {
            monitor.ssl_status = 'SSL Certificate Expired';
          } else if (error?.message?.includes('Hostname/IP does not match')) {
            monitor.ssl_status = 'Hostname Mismatch';
          } else if (error?.message?.includes('unable to verify')) {
            monitor.ssl_status = 'Certificate Verification Failed';
          } else if (error?.message?.includes('handshake')) {
            monitor.ssl_status = 'TLS Handshake Failed';
          } else {
            monitor.ssl_status = 'No SSL / Invalid SSL';
          }

          // console.log('SSL ERROR =>', error?.message);
        }
      }

      if (monitor.domain_enabled) {
        try {
          const rootDomain = this.getRootDomain(hostname);

          const rdapUrl = `https://rdap.org/domain/${rootDomain}`;

          const rdapResponse = await axios.get(rdapUrl, {
            timeout: 10000,
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
          } else {
            monitor.domain_expiry_date = 'Unavailable';

            monitor.domain_days_left = 0;
          }
        } catch {
          monitor.domain_expiry_date = 'Unavailable';

          monitor.domain_days_left = 0;
        }
      }

      const allHistory = await this.historyRepo.find({
        where: {
          monitor: {
            id: monitor.id,
          },
        },
        order: {
          created_at: 'ASC',
        },
      });

      const totalUptimeMinutes = monitor.success_checks * monitor.interval;

      const totalDowntimeMinutes = monitor.failed_checks * monitor.interval;

      const mtbf =
        monitor.failed_checks > 0
          ? Math.floor(totalUptimeMinutes / monitor.failed_checks)
          : totalUptimeMinutes;

      const mttr =
        monitor.failed_checks > 0
          ? Math.floor(totalDowntimeMinutes / monitor.failed_checks)
          : 0;

      const downtimeLogs: any[] = [];

      let downStart: any = null;

      for (const item of allHistory) {
        if (item.status === 'DOWN' && !downStart) {
          downStart = item.created_at;
        }

        if (item.status === 'UP' && downStart) {
          const recoveredAt = item.created_at;

          const duration =
            new Date(recoveredAt).getTime() - new Date(downStart).getTime();

          downtimeLogs.push({
            down_at: downStart,
            recovered_at: recoveredAt,
            duration_minutes: Math.floor(duration / (1000 * 60)),
          });

          downStart = null;
        }
      }

      if (downStart) {
        const now = new Date();

        const duration = now.getTime() - new Date(downStart).getTime();

        downtimeLogs.push({
          down_at: downStart,
          recovered_at: 'Still Down',
          duration_minutes: Math.floor(duration / (1000 * 60)),
        });
      }

      console.clear();
      console.log('\n');
      console.log('=====================================================');
      console.log(`MONITOR REPORT : ${monitor.name}`);
      console.log('=====================================================');
      console.log('\n');
      console.log('STATUS');
      console.log('-----------------------------');
      console.log('Current Status :', monitor.status);
      console.log('Last Checked   :', monitor.last_checked);
      console.log('Last Error     :', monitor.last_error || 'None');
      console.log('\n');
      console.log('RESPONSE');
      console.log('-----------------------------');
      console.log('Current Response :', `${monitor.response_time} ms`);
      console.log('Ping Response    :', `${pingTime} ms`);
      console.log('Average Response :', `${monitor.avg_response} ms`);
      console.log('Minimum Response :', `${monitor.min_response} ms`);
      console.log('Maximum Response :', `${monitor.max_response} ms`);
      console.log('\n');
      console.log('UPTIME');
      console.log('-----------------------------');
      console.log('Uptime Percentage :', `${monitor.uptime_percentage}%`);
      console.log('Total Checks      :', monitor.total_checks);
      console.log('Success Checks    :', monitor.success_checks);
      console.log('Failed Checks     :', monitor.failed_checks);
      console.log('Total Uptime      :', `${totalUptimeMinutes} Minutes`);
      console.log('Total Downtime    :', `${totalDowntimeMinutes} Minutes`);
      console.log('MTBF              :', `${mtbf} Minutes`);
      console.log('MTTR              :', `${mttr} Minutes`);
      console.log('\n');
      console.log('DNS');
      console.log('-----------------------------');
      console.log('IP Address :', monitor.ip_address);
      console.log('\n');
      console.log('SSL');
      console.log('-----------------------------');
      console.log('SSL Enabled :', monitor.ssl_enabled);
      console.log('SSL Expiry  :', monitor.ssl_expiry_date);
      console.log('SSL Days    :', monitor.ssl_days_left);
      console.log('SSL Status  :', monitor.ssl_status);
      console.log('Valid From  :', monitor.valid_from);
      console.log('SSL Valid   :', monitor.validation_error ? 'No' : 'Yes');
      console.log('\n');
      console.log('DOMAIN');
      console.log('-----------------------------');
      console.log('Domain Expiry :', monitor.domain_expiry_date);
      console.log('Domain Days   :', monitor.domain_days_left);
      console.log('\n');
      console.log('DOWNTIME LOGS');
      console.log('-----------------------------');

      if (!downtimeLogs.length) {
        console.log('No downtime detected');
      } else {
        downtimeLogs.forEach((log, index) => {
          console.log(`Downtime #${index + 1}`);
          console.log('Down At      :', log.down_at);
          console.log('Recovered At :', log.recovered_at);
          console.log('Duration      :', `${log.duration_minutes} Minutes`);
          console.log('-------------------');
        });
      }

      console.log('=====================================================');
    } catch (error: any) {
      const previousStatus = monitor.status;

      monitor.status = 'DOWN';

      monitor.failed_checks += 1;

      monitor.total_checks += 1;

      monitor.last_checked = new Date().toISOString();

      if (error.code === 'ECONNABORTED') {
        monitor.last_error = 'Connection Timeout';
      } else if (error.response?.status === 404) {
        monitor.last_error = '404 Not Found';
      } else if (error.response?.status >= 500) {
        monitor.last_error = 'Server Error';
      } else if (error.code === 'ENOTFOUND') {
        monitor.last_error = 'DNS Not Found';
      } else if (error.code === 'ECONNREFUSED') {
        monitor.last_error = 'Connection Refused';
      } else {
        monitor.last_error = error.message || 'Unknown Error';
      }

      if (previousStatus === 'UP') {
        monitor.last_down_at = new Date().toISOString();

        await this.sendDownNotification(monitor);
      }

      monitor.uptime_percentage = Number(
        ((monitor.success_checks / monitor.total_checks) * 100).toFixed(2),
      );

      const history = this.historyRepo.create({
        monitor,
        status: 'DOWN',
        response_time: 0,
      });

      await this.historyRepo.save(history);

      console.clear();
      console.log('\n');
      console.log('=====================================================');
      console.log(`MONITOR REPORT : ${monitor.name}`);
      console.log('=====================================================');
      console.log('\n');
      console.log('STATUS : DOWN');
      console.log('ERROR  :', monitor.last_error);
      console.log('TIME   :', monitor.last_checked);
      console.log('=====================================================');
    }

    return this.monitorRepo.save(monitor);
  }

  async runMonitoring() {
    const monitors = await this.monitorRepo.find();

    const updatedMonitors: Monitor[] = [];

    for (const monitor of monitors) {
      const lastChecked = monitor.last_checked
        ? new Date(monitor.last_checked).getTime()
        : 0;

      const now = Date.now();

      const intervalMs = monitor.interval * 60 * 1000;

      let updatedMonitor = monitor;

      if (now - lastChecked >= intervalMs) {
        updatedMonitor = await this.checkMonitor(monitor);
      }

      updatedMonitors.push(updatedMonitor);
    }

    const freshData = await this.monitorRepo.find({
      relations: ['history'],
      order: {
        id: 'DESC',
      },
    });

    return successResponse(
      freshData.map((item) => ({
        ...item,
        history: item.history?.sort((a, b) => b.id - a.id),
      })),
      'Monitoring completed successfully',
    );
  }
}
