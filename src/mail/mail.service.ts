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

function wrapLayout(body: string, title: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
  </head>
  <body
    style="
      margin:0;
      padding:24px;
      background:#ffffff;
      font-family:Segoe UI,Arial,sans-serif;
      font-size:14px;
      color:#222;
      line-height:1.5;
    "
  >
    <div style="max-width:800px">
      ${body}

      <br/>

      <p style="margin:0;color:#666;font-size:12px">
        Thanks,<br/>
        <strong>Password Manager Team</strong>
      </p>

      <p style="margin:7px 0 0 0;color:#888;font-size:11px">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </body>
  </html>
  `;
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
    expiryMinutes: number = 10,
  ) {
    try {
      if (!this.transporter) {
        this.logger.warn(
          'Mail transporter not configured. Skipping OTP email.',
        );
        return successResponse(null, 'Email service not configured', 200);
      }

      const subject = `Your verification code for ${purpose}`;

      const body = `
<p style="margin:0 0 8px">
  Hi <strong>${userName}</strong>,
</p>

<p style="margin:0 0 8px">
  We received a request for a verification code.
</p>

<p style="margin:0 0 8px">
  <span>Verification Code:</span>
  <span style="
    font-size:22px;
    font-weight:700;
    letter-spacing:2px;
    color:#111827;
  ">
    ${otp}
  </span>
</p>

<p style="margin:0 0 8px">
  Code expires in
  <strong style="color:#e30505">
  ${expiryMinutes} minute${expiryMinutes === 1 ? '' : 's'}
</strong>.
</p>

<p style="margin:0">
  If you didn't request this code, please ignore this email.
</p>
`;

      return await this.sendMail({
        to,
        subject,
        html: wrapLayout(body, subject),
      });
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

      const body = `
<p style="margin:0 0 12px">
  Hi <strong>${userName}</strong>,
</p>

<p style="margin:0 0 12px">
  Welcome to <strong>Password Manager</strong>.
</p>

<p style="margin:0 0 12px">
  Your account has been created successfully.
</p>

<p style="margin:0 0 12px">
  Sign in:
  <a href="${loginUrl}">
    ${loginUrl}
  </a>
</p>

<p style="margin:0">
  You can now securely manage and share passwords.
</p>
`;

      return await this.sendMail({
        to,
        subject,
        html: wrapLayout(body, subject),
      });
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

      const subject = 'Your password was changed';

      const body = `
<p style="margin:0 0 12px">
  Hi <strong>${userName}</strong>,
</p>

<p style="margin:0 0 12px">
  Your account password was changed successfully.
</p>

<p style="margin:0 0 12px">
  If this was you, no further action is required.
</p>

<p style="margin:0">
  <strong>Didn't make this change?</strong><br/>
  Please contact support immediately.
</p>
`;

      return await this.sendMail({
        to,
        subject,
        html: wrapLayout(body, subject),
      });
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

      const subject = `${data.sharedBy} shared a ${data.resourceType} with you`;

      const body = `
<p style="margin:0 0 8px">
  Hi <span style="font-weight:700;">${data.userName}</span>,
</p>

<p style="margin:0 0 8px">
  <span style="font-weight:500;">${data.sharedBy}</span> shared a
  <span style="font-weight:500;">${data.resourceType}</span> with you.
</p>

<p style="margin:0 0 2px">
  <span>Resource :</span> <span style="font-weight:500;">${data.resourceName}</span>
</p>

<p style="margin:0 0 2px">
  <span>Type :</span> <span style="font-weight:500;">${data.resourceType}</span>
</p>

<p style="margin:0 0 8px">
  <span>Permission :</span> <span style="font-weight:500;">${data.permissionType}</span>
</p>

<p style="margin:0 0 8px">
  <span>Access Code :</span>
  <span style="
    font-size:20px;
    font-weight:500;
    color:#111827;
  ">
    ${data.otp}
  </span>
</p>

<p style="margin:0 0 8px">
  This code expires in
  <span style="color:#e30505">
    10 minutes
  </span>.
</p>

<p style="margin:0">
  Do not share this code with anyone.
</p>
`;

      return await this.sendMail({
        to,
        subject,
        html: wrapLayout(body, subject),
      });
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
      performedByName: string;
      itemName: string;
      itemPublicId: string;
      timestamp: string;
      username?: string;
      email?: string;
      website?: string;
    },
  ) {
    try {
      if (!this.transporter) {
        return successResponse(null, 'Email service not configured', 200);
      }

      const subject = `Security alert: "${context.itemName}" was ${context.action}`;

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

      const actionLabel =
        context.action === 'edited'
          ? 'edited'
          : context.action === 'copied'
            ? 'copied'
            : 'accessed';

      const body = `
<p style="margin:0 0 12px">
  An item was <strong>${actionLabel}</strong>.
</p>

<p style="margin:0 0 4px">
  <strong>Item:</strong> ${context.itemName}
</p>

<p style="margin:0 0 4px">
  <strong>Action:</strong> ${actionLabel}
</p>

<p style="margin:0 0 4px">
  <strong>Performed By:</strong>
  ${context.performedByName} (${context.performedBy})
</p>

${
  context.username
    ? `<p style="margin:0 0 4px"><strong>Username:</strong> ${context.username}</p>`
    : ''
}

${
  context.email
    ? `<p style="margin:0 0 4px"><strong>Email:</strong> ${context.email}</p>`
    : ''
}

${
  context.website
    ? `<p style="margin:0 0 4px"><strong>Website:</strong> <a href="${context.website}">${context.website}</a></p>`
    : ''
}

<p style="margin:0 0 12px">
  <strong>Date & Time:</strong> ${formattedTime}
</p>

<p style="margin:0">
  If you don't recognize this activity, review access permissions immediately.
</p>
`;
      return await this.sendMail({
        to,
        subject,
        html: wrapLayout(body, subject),
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send audit email to ${to}:`,
        error instanceof Error ? error.message : error,
      );
      return CatchError(error);
    }
  }
}
