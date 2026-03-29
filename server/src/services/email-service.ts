import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

// Konfigurasi Email
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  fromName: string;
}

// Tipe email notifikasi
export type NotificationType =
  | 'CHILD_CHECK_IN'
  | 'CHILD_CHECK_OUT'
  | 'BILLING_DUE'
  | 'LOGIN_ALERT'
  | 'BROADCAST'
  | 'WELCOME';

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.auth.user,
          pass: this.config.auth.pass,
        },
        tls: {
          rejectUnauthorized: false, // Untuk self-signed cert (opsional)
        },
      });

      logger.info('Email transporter initialized');
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.transporter) return false;
      await this.transporter.verify();
      logger.info('Email connection verified successfully');
      return true;
    } catch (error) {
      logger.error('Email connection test failed:', error);
      return false;
    }
  }

  async sendEmail(params: SendEmailParams): Promise<boolean> {
    try {
      if (!this.transporter) {
        logger.error('Email transporter not initialized');
        return false;
      }

      const info = await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.from}>`,
        to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
        subject: params.subject,
        text: params.text || this.stripHtml(params.html),
        html: params.html,
      });

      logger.info(`Email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send email:', error);
      return false;
    }
  }

  // Template Notifikasi Anak Masuk
  async notifyChildCheckIn(parentEmail: string, parentName: string, childName: string, time: string) {
    const subject = `✅ Notifikasi: ${childName} Telah Tiba di TPA`;
    const html = this.getCheckInTemplate(parentName, childName, time);

    return this.sendEmail({
      to: parentEmail,
      subject,
      html,
    });
  }

  // Template Notifikasi Anak Pulang
  async notifyChildCheckOut(parentEmail: string, parentName: string, childName: string, time: string) {
    const subject = `🏠 Notifikasi: ${childName} Telah Pulang dari TPA`;
    const html = this.getCheckOutTemplate(parentName, childName, time);

    return this.sendEmail({
      to: parentEmail,
      subject,
      html,
    });
  }

  // Template Notifikasi Tagihan
  async notifyBillingDue(parentEmail: string, parentName: string, childName: string, amount: string, dueDate: string) {
    const subject = `💰 Pengingat Tagihan TPA - ${childName}`;
    const html = this.getBillingTemplate(parentName, childName, amount, dueDate);

    return this.sendEmail({
      to: parentEmail,
      subject,
      html,
    });
  }

  // Template Notifikasi Login Baru
  async notifyNewLogin(email: string, userName: string, loginTime: string, device: string) {
    const subject = `🔐 Login Baru Terdeteksi - ${userName}`;
    const html = this.getLoginAlertTemplate(userName, loginTime, device);

    return this.sendEmail({
      to: email,
      subject,
      html,
    });
  }

  // Template Broadcast
  async sendBroadcast(parentEmails: string[], title: string, message: string) {
    const subject = `📢 Pengumuman TPA: ${title}`;
    const html = this.getBroadcastTemplate(title, message);

    // Kirim batch (max 50 per request untuk Brevo)
    const batchSize = 50;
    for (let i = 0; i < parentEmails.length; i += batchSize) {
      const batch = parentEmails.slice(i, i + batchSize);
      await this.sendEmail({
        to: batch,
        subject,
        html,
      });
    }
  }

  // Template Welcome untuk Ortu Baru
  async sendWelcomeEmail(parentEmail: string, parentName: string, childName: string, loginUrl: string) {
    const subject = `Selamat Datang di TPA Rumah Ceria!`;
    const html = this.getWelcomeTemplate(parentName, childName, loginUrl);

    return this.sendEmail({
      to: parentEmail,
      subject,
      html,
    });
  }

  // ================== TEMPLATES ==================

  private getCheckInTemplate(parentName: string, childName: string, time: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745; margin: 20px 0; }
          .info { background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 5px; border-left: 4px solid #17a2b8; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          .time { font-weight: bold; color: #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Notifikasi Kedatangan</h1>
          </div>
          <div class="content">
            <p>Assalamualaikum, ${parentName}!</p>

            <div class="success">
              <strong>${childName}</strong> telah tiba di TPA dengan aman.
            </div>

            <div class="info">
              <p>🕐 <strong>Waktu Kedatangan:</strong> <span class="time">${time}</span></p>
              <p>✅ <strong>Status:</strong> Sudah check-in</p>
            </div>

            <p>Terima kasih telah mempercayakan pendidikan anak Anda kepada kami.</p>

            <div class="footer">
              <p>TPA Rumah Ceria</p>
              <p>Email ini dikirim otomatis oleh sistem TPA.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getCheckOutTemplate(parentName: string, childName: string, time: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745; margin: 20px 0; }
          .info { background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 5px; border-left: 4px solid #17a2b8; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          .time { font-weight: bold; color: #f5576c; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏠 Notifikasi Pulang</h1>
          </div>
          <div class="content">
            <p>Assalamualaikum, ${parentName}!</p>

            <div class="success">
              <strong>${childName}</strong> telah pulang dari TPA dengan aman.
            </div>

            <div class="info">
              <p>🕐 <strong>Waktu Pulang:</strong> <span class="time">${time}</span></p>
              <p>✅ <strong>Status:</strong> Sudah check-out</p>
            </div>

            <p>Terima kasih atas kepercayaan Anda.</p>

            <div class="footer">
              <p>TPA Rumah Ceria</p>
              <p>Email ini dikirim otomatis oleh sistem TPA.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getBillingTemplate(parentName: string, childName: string, amount: string, dueDate: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
          .info { background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 5px; border-left: 4px solid #17a2b8; margin: 20px 0; }
          .amount { font-size: 24px; font-weight: bold; color: #fa709a; text-align: center; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          .btn { display: inline-block; padding: 12px 30px; background: #fa709a; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Pengingat Tagihan</h1>
          </div>
          <div class="content">
            <p>Assalamualaikum, ${parentName}!</p>

            <div class="warning">
              <strong>⚠️ Tagihan jatuh tempo pada ${dueDate}</strong>
            </div>

            <div class="info">
              <p>👶 <strong>Untuk:</strong> ${childName}</p>
            </div>

            <div class="amount">${amount}</div>

            <p>Mohon segera melakukan pembayaran. Untuk info pembayaran, silakan hubungi admin TPA.</p>

            <div class="footer">
              <p>TPA Rumah Ceria</p>
              <p>Email ini dikirim otomatis oleh sistem TPA.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getLoginAlertTemplate(userName: string, loginTime: string, device: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; border-left: 4px solid #dc3545; margin: 20px 0; }
          .info { background: #d1ecf1; color: #0c5460; padding: 15px; border-radius: 5px; border-left: 4px solid #17a2b8; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Login Baru Terdeteksi</h1>
          </div>
          <div class="content">
            <p>Halo, <strong>${userName}</strong>!</p>

            <div class="alert">
              Kami mendeteksi login baru ke akun Anda. Jika ini bukan Anda, segera ubah password.
            </div>

            <div class="info">
              <p>🕐 <strong>Waktu Login:</strong> ${loginTime}</p>
              <p>💻 <strong>Perangkat:</strong> ${device}</p>
            </div>

            <p>Untuk keamanan, selalu gunakan password yang kuat dan jangan berikan ke orang lain.</p>

            <div class="footer">
              <p>TPA Rumah Ceria</p>
              <p>Email ini dikirim otomatis oleh sistem TPA.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getBroadcastTemplate(title: string, message: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .broadcast { background: #e7f3ff; color: #004085; padding: 20px; border-radius: 5px; border-left: 4px solid #0056b3; margin: 20px 0; }
          .message { white-space: pre-wrap; line-height: 1.8; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📢 Pengumuman TPA</h1>
          </div>
          <div class="content">
            <h2>${title}</h2>

            <div class="broadcast">
              <div class="message">${message}</div>
            </div>

            <p>Terima kasih atas perhatian Anda.</p>

            <div class="footer">
              <p>TPA Rumah Ceria</p>
              <p>Email ini dikirim otomatis oleh sistem TPA.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeTemplate(parentName: string, childName: string, loginUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .welcome { background: #d4edda; color: #155724; padding: 20px; border-radius: 5px; border-left: 4px solid #28a745; margin: 20px 0; }
          .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Selamat Datang!</h1>
          </div>
          <div class="content">
            <p>Assalamualaikum, ${parentName}!</p>

            <div class="welcome">
              <h3>Selamat bergabung di TPA Rumah Ceria!</h3>
              <p>Kami sangat senang bisa berpartisipasi dalam pendidikan <strong>${childName}</strong>.</p>
            </div>

            <p>Untuk memantau aktivitas anak dan melihat informasi lainnya, silakan login ke portal orang tua:</p>

            <div style="text-align: center;">
              <a href="${loginUrl}" class="btn">Login ke Portal Orang Tua</a>
            </div>

            <p>Jika Anda memiliki pertanyaan, jangan ragu untuk menghubungi kami.</p>

            <div class="footer">
              <p>TPA Rumah Ceria</p>
              <p>Email ini dikirim otomatis oleh sistem TPA.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
  }
}

// Singleton instance
let emailServiceInstance: EmailService | null = null;

export function initEmailService(config: EmailConfig): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = new EmailService(config);
  }
  return emailServiceInstance;
}

export function getEmailService(): EmailService | null {
  return emailServiceInstance;
}

export default EmailService;
