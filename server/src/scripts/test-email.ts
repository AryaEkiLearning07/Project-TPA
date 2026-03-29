import 'dotenv/config';
import { initEmailService } from '../services/email-service.js';

// Load email config from environment variables
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || '',
  },
  from: process.env.EMAIL_FROM || 'noreply@tpa-rumahceria.com',
  fromName: process.env.EMAIL_FROM_NAME || 'TPA Rumah Ceria',
};

async function testEmailService() {
  console.log('='.repeat(50));
  console.log('📧 Email Service Test');
  console.log('='.repeat(50));
  console.log('');

  // Initialize service
  console.log('Initializing email service...');
  console.log('Host:', emailConfig.host);
  console.log('Port:', emailConfig.port);
  console.log('From:', `${emailConfig.fromName} <${emailConfig.from}>`);
  console.log('Secure:', emailConfig.secure);
  console.log('');

  const emailService = initEmailService(emailConfig);

  // Test connection
  console.log('Testing SMTP connection...');
  const connected = await emailService.testConnection();

  if (!connected) {
    console.error('❌ Failed to connect to SMTP server!');
    console.log('');
    console.log('Troubleshooting:');
    console.log('1. Check EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD in .env');
    console.log('2. Make sure SMTP credentials are correct');
    console.log('3. Check if port 587 is not blocked by firewall');
    console.log('4. For Brevo: Verify SMTP key is active');
    console.log('5. For Gmail: Use App Password, not regular password');
    process.exit(1);
  }

  console.log('✅ SMTP connection successful!');
  console.log('');

  // Test send email
  const testEmail = process.env.TEST_EMAIL;
  if (!testEmail) {
    console.error('⚠️ TEST_EMAIL not set in .env');
    console.log('To test email sending, set: TEST_EMAIL=your-email@example.com');
    console.log('');
    console.log('Skipping email send test.');
    process.exit(0);
  }

  console.log(`Sending test email to: ${testEmail}`);

  try {
    const sent = await emailService.sendEmail({
      to: testEmail,
      subject: '🧪 Test Email - TPA Platform',
      html: `
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
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Email Service Test Success!</h1>
            </div>
            <div class="content">
              <p>Assalamualaikum!</p>

              <div class="success">
                <strong>✅ Email service is working correctly!</strong>
              </div>

              <p>If you're reading this, your TPA platform can now send notifications:</p>
              <ul>
                <li>✅ Child check-in/out alerts</li>
                <li>💰 Billing reminders</li>
                <li>🔐 Login alerts</li>
                <li>📢 Broadcast announcements</li>
                <li>🎉 Welcome emails</li>
              </ul>

              <p>Next steps:</p>
              <ol>
                <li>Test the notification functions in your routes</li>
                <li>Setup SPF and DKIM records in your DNS</li>
                <li>Integrate with check-in/out flows</li>
              </ol>

              <div class="footer">
                <p>TPA Rumah Ceria</p>
                <p>This is a test email from the TPA Platform.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: 'Email service test successful! Your TPA platform can now send notifications.',
    });

    if (sent) {
      console.log('✅ Test email sent successfully!');
      console.log('');
      console.log('Please check your inbox (and spam folder).');
    } else {
      console.error('❌ Failed to send test email');
    }
  } catch (error) {
    console.error('❌ Error sending test email:', error);
  }

  console.log('');
  console.log('='.repeat(50));
}

testEmailService().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
