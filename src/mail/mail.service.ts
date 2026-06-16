import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { CatchError } from '../common/response/catch-error.util';
import { successResponse } from '../common/response/response.util';

interface SendMailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content?: any;
    path?: string;
    contentType?: string;
  }>;
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    const mailUser = process.env.MAIL_USER;
    const mailPass = process.env.MAIL_PASS;

    if (mailUser && mailPass) {
      this.transporter = nodemailer.createTransport({
        service: process.env.MAIL_SERVICE || 'gmail',
        auth: {
          user: mailUser,
          pass: mailPass,
        },
      });
      this.logger.log('Mail transporter initialized successfully');
    } else {
      this.logger.warn(
        'Mail credentials not configured. Email sending disabled.',
      );
    }
  }

  async sendMail(options: SendMailOptions) {
    try {
      if (!this.transporter) {
        this.logger.warn('Mail transporter not configured. Cannot send email.');
        return successResponse(null, 'Email service not configured', 200);
      }

      const mailOptions: nodemailer.SendMailOptions = {
        from: `${process.env.MAIL_FROM || 'Password Manager'} <${process.env.MAIL_USER || ''}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html || options.text || '',
      };

      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments;
      }

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${options.to}`);
      return successResponse(
        { messageId: result.messageId },
        'Email sent successfully',
        200,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email to ${options.to}:`, errorMessage);
      return CatchError(error);
    }
  }

  async sendBulkMail(options: SendMailOptions[]) {
    try {
      if (!this.transporter) {
        this.logger.warn(
          'Mail transporter not configured. Cannot send bulk email.',
        );
        return successResponse(
          { successful: 0, failed: options.length, total: options.length },
          'Email service not configured',
          200,
        );
      }

      const promises = options.map((opt) => this.sendMail(opt));
      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      this.logger.log(`Bulk email: ${successful} sent, ${failed} failed`);
      return successResponse(
        { successful, failed, total: options.length },
        `Bulk email completed: ${successful} sent, ${failed} failed`,
        200,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to send bulk emails:', errorMessage);
      return CatchError(error);
    }
  }

  async sendOtpEmail(
    to: string,
    otp: string,
    userName: string,
    purpose: string = 'verification',
  ) {
    try {
      if (!this.transporter) {
        this.logger.warn(
          'Mail transporter not configured. Skipping OTP email.',
        );
        return successResponse(null, 'Email service not configured', 200);
      }

      const subject = `Your OTP for ${purpose}`;
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>OTP Verification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background: #f9f9f9; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .otp-code { background: #4CAF50; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0; }
            .expiry { color: #ff4444; font-size: 14px; text-align: center; margin-top: 10px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>Password Manager</h1><h2>OTP Verification</h2></div>
            <p>Hello ${userName},</p>
            <p>You have requested an OTP for <strong>${purpose}</strong>. Please use the following OTP to complete your verification:</p>
            <div class="otp-code">${otp}</div>
            <p class="expiry">This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this OTP, please ignore this email or contact support if you have concerns.</p>
            <div class="footer"><p>This is an automated message, please do not reply to this email.</p><p>&copy; ${new Date().getFullYear()} Password Manager. All rights reserved.</p></div>
          </div>
        </body>
        </html>
      `;

      return await this.sendMail({ to, subject, html });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send OTP email to ${to}:`, errorMessage);
      return CatchError(error);
    }
  }

  async sendWelcomeEmail(to: string, userName: string, loginUrl: string) {
    try {
      if (!this.transporter) {
        this.logger.warn(
          'Mail transporter not configured. Skipping welcome email.',
        );
        return successResponse(null, 'Email service not configured', 200);
      }

      const subject = 'Welcome to Password Manager';
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Password Manager</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background: #f9f9f9; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .welcome-message { font-size: 18px; color: #4CAF50; text-align: center; }
            .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>🎉 Welcome!</h1></div>
            <p>Hello ${userName},</p>
            <p class="welcome-message">Welcome to Password Manager!</p>
            <p>Your account has been created successfully. You can now start managing your passwords and sharing resources securely.</p>
            <div style="text-align: center;"><a href="${loginUrl}" class="button">Login to Your Account</a></div>
            <div class="footer"><p>If you have any questions, please contact our support team.</p><p>&copy; ${new Date().getFullYear()} Password Manager. All rights reserved.</p></div>
          </div>
        </body>
        </html>
      `;

      return await this.sendMail({ to, subject, html });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send welcome email to ${to}:`, errorMessage);
      return CatchError(error);
    }
  }

  async sendPasswordChangeNotification(to: string, userName: string) {
    try {
      if (!this.transporter) {
        this.logger.warn(
          'Mail transporter not configured. Skipping password change notification.',
        );
        return successResponse(null, 'Email service not configured', 200);
      }

      const subject = 'Password Changed Successfully';
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Password Changed</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h2 style="color: #856404; margin-top: 0;">⚠️ Security Alert</h2>
            <p>Hello ${userName},</p><p>Your password was changed successfully.</p>
            <p>If you did not make this change, please contact support immediately.</p>
          </div>
          <p style="color: #666; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} Password Manager. All rights reserved.</p>
        </body>
        </html>
      `;

      return await this.sendMail({ to, subject, html });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send password change notification to ${to}:`,
        errorMessage,
      );
      return CatchError(error);
    }
  }

  async sendCustomEmail(
    to: string | string[],
    subject: string,
    htmlContent: string,
  ) {
    try {
      if (!this.transporter) {
        this.logger.warn(
          'Mail transporter not configured. Cannot send custom email.',
        );
        return successResponse(null, 'Email service not configured', 200);
      }
      return await this.sendMail({ to, subject, html: htmlContent });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send custom email to ${to}:`, errorMessage);
      return CatchError(error);
    }
  }

  async sendEmailWithAttachments(
    to: string | string[],
    subject: string,
    htmlContent: string,
    attachments: Array<{
      filename: string;
      content?: any;
      path?: string;
      contentType?: string;
    }>,
  ) {
    try {
      if (!this.transporter) {
        this.logger.warn(
          'Mail transporter not configured. Cannot send email with attachments.',
        );
        return successResponse(null, 'Email service not configured', 200);
      }
      return await this.sendMail({
        to,
        subject,
        html: htmlContent,
        attachments,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to send email with attachments to ${to}:`,
        errorMessage,
      );
      return CatchError(error);
    }
  }

  async sendShareOtpEmail(
    to: string,
    data: {
      userName: string;
      sharedBy: string;
      resourceName: string;
      resourceType: string;
      permissionType: string;
      otp: string;
      shareLink: string;
    },
  ) {
    try {
      if (!this.transporter) {
        return successResponse(null, 'Email service not configured', 200);
      }

      const subject = `${data.sharedBy} shared a ${data.resourceType} with you — OTP inside`;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
          
          <!-- Header -->
          <div style="text-align:center;padding-bottom:16px;border-bottom:1px solid #f1f5f9;margin-bottom:16px">
            <div style="display:inline-block;background:#5b47eb;color:white;padding:6px 18px;border-radius:12px;font-size:12px;font-weight:600;letter-spacing:0.5px">SHARED WITH YOU</div>
          </div>

          <!-- Resource info -->
          <p style="margin:0 0 4px;font-size:13px;color:#64748b">Hi <strong style="color:#0f172a">${data.userName}</strong>,</p>
          <p style="margin:0 0 16px;font-size:14px;color:#0f172a">
            <strong>${data.sharedBy}</strong> shared a <strong>${data.resourceType}</strong> with you.
          </p>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin-bottom:16px">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <tr>
                <td style="color:#64748b;padding:4px 0;width:40%">Resource</td>
                <td style="color:#0f172a;font-weight:600;padding:4px 0">${data.resourceName}</td>
              </tr>
              <tr>
                <td style="color:#64748b;padding:4px 0">Permission</td>
                <td style="padding:4px 0">
                  <span style="background:${data.permissionType === 'edit' ? '#fef3c7' : '#dbeafe'};color:${data.permissionType === 'edit' ? '#92400e' : '#1e40af'};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase">${data.permissionType}</span>
                </td>
              </tr>
            </table>
          </div>

          <!-- OTP -->
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;text-align:center">Your one-time access code</p>
          <div style="background:#5b47eb;color:#ffffff;font-size:28px;font-weight:700;text-align:center;padding:14px;border-radius:8px;letter-spacing:10px;margin-bottom:6px">${data.otp}</div>
          <p style="margin:0 0 16px;font-size:11px;color:#ef4444;text-align:center">Expires in 10 minutes</p>

          <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center">Password Manager · Do not share this code with anyone</p>
        </div>
      `;

      return await this.sendMail({ to, subject, html });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send share OTP email to ${to}:`,
        error instanceof Error ? error.message : error,
      );
      return CatchError(error);
    }
  }

  async sendItemAuditEmail(
    to: string,
    context: {
      action: 'edited' | 'copied' | 'accessed';
      performedBy: string;
      performedByName: string; // ← added
      itemName: string;
      itemPublicId: string;
      timestamp: string;
      // extra detail fields
      username?: string;
      email?: string;
      website?: string;
    },
  ) {
    try {
      if (!this.transporter) {
        return successResponse(null, 'Email service not configured', 200);
      }

      const subject = `${context.itemName} ${context.action} by ${context.performedBy}`;

      const actionColor =
        context.action === 'edited'
          ? '#f59e0b'
          : context.action === 'copied'
            ? '#3b82f6'
            : '#10b981';

      const actionBg =
        context.action === 'edited'
          ? '#fffbeb'
          : context.action === 'copied'
            ? '#eff6ff'
            : '#f0fdf4';

      const formattedTime = new Date(context.timestamp).toLocaleString(
        'en-IN',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        },
      );

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">

          <!-- Header -->
          <div style="display:flex;align-items:center;gap:10px;padding-bottom:14px;border-bottom:1px solid #f1f5f9;margin-bottom:14px">
            <div style="background:#5b47eb;color:white;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.5px">SECURITY ALERT</div>
            <span style="font-size:12px;color:#94a3b8">Password Manager</span>
          </div>

          <!-- Action summary -->
          <div style="background:${actionBg};border:1px solid ${actionColor}30;border-radius:8px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">${context.action === 'edited' ? '✏️' : context.action === 'copied' ? '📋' : '👁️'}</span>
            <div>
              <p style="margin:0;font-size:13px;font-weight:700;color:#0f172a">${context.itemName}</p>
              <p style="margin:2px 0 0;font-size:12px;color:#64748b">
                <span style="color:${actionColor};font-weight:600;text-transform:capitalize">${context.action}</span>
                by <strong>${context.performedByName || context.performedBy}</strong> (${context.performedBy})
              </p>
            </div>
          </div>

          <!-- Detail table -->
          <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <tr style="background:#f8fafc">
              <td style="padding:9px 14px;color:#64748b;border-bottom:1px solid #e2e8f0;width:36%">Action</td>
              <td style="padding:9px 14px;font-weight:600;text-transform:capitalize;color:${actionColor};border-bottom:1px solid #e2e8f0">${context.action}</td>
            </tr>
            <tr>
              <td style="padding:9px 14px;color:#64748b;border-bottom:1px solid #e2e8f0">Done by</td>
              <td style="padding:9px 14px;color:#0f172a;border-bottom:1px solid #e2e8f0">${context.performedBy}</td>
            </tr>
            ${
              context.username
                ? `
            <tr style="background:#f8fafc">
              <td style="padding:9px 14px;color:#64748b;border-bottom:1px solid #e2e8f0">Username</td>
              <td style="padding:9px 14px;color:#0f172a;border-bottom:1px solid #e2e8f0">${context.username}</td>
            </tr>`
                : ''
            }
            ${
              context.email
                ? `
            <tr>
              <td style="padding:9px 14px;color:#64748b;border-bottom:1px solid #e2e8f0">Email</td>
              <td style="padding:9px 14px;color:#0f172a;border-bottom:1px solid #e2e8f0">${context.email}</td>
            </tr>`
                : ''
            }
            ${
              context.website
                ? `
            <tr style="background:#f8fafc">
              <td style="padding:9px 14px;color:#64748b;border-bottom:1px solid #e2e8f0">Website</td>
              <td style="padding:9px 14px;border-bottom:1px solid #e2e8f0"><a href="${context.website}" style="color:#5b47eb">${context.website}</a></td>
            </tr>`
                : ''
            }
            <tr ${context.website || context.email || context.username ? 'style="background:#f8fafc"' : ''}>
              <td style="padding:9px 14px;color:#64748b">Date &amp; Time</td>
              <td style="padding:9px 14px;color:#0f172a;font-weight:600">${formattedTime}</td>
            </tr>
          </table>

          <p style="margin:14px 0 0;font-size:11px;color:#94a3b8;text-align:center">
            Automated security alert · Password Manager · ${new Date().getFullYear()}
          </p>
        </div>
      `;

      return await this.sendMail({ to, subject, html });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send audit email to ${to}:`,
        error instanceof Error ? error.message : error,
      );
      return CatchError(error);
    }
  }
}
