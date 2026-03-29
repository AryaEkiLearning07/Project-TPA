# Panduan Implementasi Email/SMTP untuk Platform TPA

## Ringkasan
Platform TPA akan menggunakan layanan email untuk mengirim notifikasi seperti:
- ✅ Anak masuk/pulang
- 💰 Tagihan jatuh tempo
- 🔐 Login baru terdeteksi
- 📢 Broadcast pengumuman
- 🎉 Welcome email untuk ortu baru

---

## Kenapa Bisa di Server Lokal (Mini PC)?

Server lokal **TIDAK** menghalangi pengiriman email karena:
- Kita menggunakan **SMTP Relay** (email gateway pihak ketiga)
- Email dikirim melalui layanan seperti Brevo, Gmail, SendGrid, dll
- Server lokal hanya memanggil API/SMTP relay provider
- Port 25 (yang sering diblokir ISP) **tidak digunakan**

---

## Opsi Layanan Email

### 🥇 Rekomendasi: Brevo (Gratis 300 email/hari)

| Kelebihan | Detail |
|-----------|--------|
| Gratis | 300 email/hari untuk selamanya |
| Domain custom | Bisa pakai email @tpa-lembaga.com |
| Report lengkap | Bounce rate, open rate, click tracking |
| Template editor | Desain email visual |
| API & SMTP | Dukungan penuh keduanya |

**Setup Brevo:**
1. Daftar di https://www.brevo.com (gratis)
2. Masuk ke menu **SMTP & API**
3. Klik **Create your SMTP key**
4. Catat:
   - SMTP Server: `smtp-relay.brevo.com`
   - Port: `587` (TLS) atau `2525`
   - Username: email login Brevo
   - Password: SMTP Key yang dibuat

### 🥈 Alternatif: Google Workspace (~Rp80k/bulan)

Jika ingin email domain seperti `info@tpa-lembaga.com`:

| Paket | Harga | Email | Storage |
|-------|-------|-------|---------|
| Business Starter | ~Rp80k | 1 akun | 30 GB |
| Business Standard | ~Rp160k | 1 akun | 2 TB |

**Setup Gmail SMTP:**
1. Daftar Google Workspace di https://workspace.google.com
2. Setup domain lembaga
3. Buat akun email (misal: `info@tpa-lembaga.com`)
4. Generate **App Password**:
   - Masuk ke Google Account Security
   - Enable **2-Step Verification**
   - Buat **App Password** untuk "Mail"
   - Gunakan app password ini di `.env`

---

## Langkah Implementasi

### 1. Install Dependencies

```bash
cd server
npm install nodemailer
```

### 2. Update `.env` di server

Copy dari template:

```bash
cp server/src/config/email.example.env .env
```

Edit file `.env` sesuai provider email yang dipilih.

### 3. Initialize Email Service di `server/src/app.ts`

Tambahkan di bagian atas, setelah imports:

```typescript
import { initEmailService } from './services/email-service';
import config from './config/env';

// Initialize email service
if (config.EMAIL_NOTIFICATIONS_ENABLED === 'true') {
  initEmailService({
    host: config.EMAIL_HOST,
    port: parseInt(config.EMAIL_PORT),
    secure: config.EMAIL_SECURE === 'true',
    auth: {
      user: config.EMAIL_USER,
      pass: config.EMAIL_PASSWORD,
    },
    from: config.EMAIL_FROM,
    fromName: config.EMAIL_FROM_NAME,
  });

  // Test connection on startup
  getEmailService()?.testConnection();
}
```

### 4. Integrasi di Routes

#### a) Notifikasi Anak Masuk (Check-in)

Edit `server/src/routes/parent-routes.ts`:

```typescript
import { getEmailService } from '../services/email-service';
import { format } from 'date-fns';

router.post('/attendance/checkin', async (req, res) => {
  try {
    const { childId } = req.body;

    // ... logic check-in existing ...

    // Kirim notifikasi email setelah check-in berhasil
    const emailService = getEmailService();
    if (emailService && parentEmail && config.EMAIL_ON_CHILD_CHECK_IN === 'true') {
      const time = format(new Date(), 'HH:mm, dd MMMM yyyy', { locale: id });
      await emailService.notifyChildCheckIn(
        parentEmail,
        parentName,
        childName,
        time
      );
    }

    res.json({ success: true, message: 'Check-in berhasil' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

#### b) Notifikasi Anak Pulang (Check-out)

```typescript
router.post('/attendance/checkout', async (req, res) => {
  try {
    const { childId } = req.body;

    // ... logic check-out existing ...

    // Kirim notifikasi email
    const emailService = getEmailService();
    if (emailService && parentEmail && config.EMAIL_ON_CHILD_CHECK_OUT === 'true') {
      const time = format(new Date(), 'HH:mm, dd MMMM yyyy', { locale: id });
      await emailService.notifyChildCheckOut(
        parentEmail,
        parentName,
        childName,
        time
      );
    }

    res.json({ success: true, message: 'Check-out berhasil' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

#### c) Notifikasi Tagihan

```typescript
import { getEmailService } from '../services/email-service';
import { addDays, format } from 'date-fns';
import { id } from 'date-fns/locale';

router.post('/billing/send-reminder', async (req, res) => {
  try {
    const { parentId, billingId } = req.body;

    // Ambil data parent dan billing
    const parent = await db.query('SELECT * FROM parents WHERE id = $1', [parentId]);
    const billing = await db.query('SELECT * FROM billings WHERE id = $1', [billingId]);
    const child = await db.query('SELECT * FROM children WHERE id = $1', [billing.child_id]);

    const emailService = getEmailService();
    if (emailService && config.EMAIL_ON_BILLING_DUE === 'true') {
      await emailService.notifyBillingDue(
        parent.rows[0].email,
        parent.rows[0].name,
        child.rows[0].name,
        `Rp ${billing.rows[0].amount.toLocaleString('id-ID')}`,
        format(new Date(billing.rows[0].due_date), 'dd MMMM yyyy', { locale: id })
      );
    }

    res.json({ success: true, message: 'Reminder dikirim' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

#### d) Notifikasi Login Baru

Edit `server/src/services/auth-service.ts`:

```typescript
import { getEmailService } from '../services/email-service';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export async function loginUser(email: string, password: string) {
  // ... existing login logic ...

  // Kirim notifikasi login baru
  const emailService = getEmailService();
  if (emailService && config.EMAIL_ON_LOGIN_ALERT === 'true') {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const deviceInfo = getDeviceInfo(userAgent);
    const loginTime = format(new Date(), 'HH:mm, dd MMMM yyyy', { locale: id });

    await emailService.notifyNewLogin(
      user.email,
      user.name,
      loginTime,
      deviceInfo
    );
  }

  // ... return token, etc ...
}

// Helper function untuk detect device
function getDeviceInfo(userAgent: string): string {
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    return 'Mobile Device';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    return 'Tablet';
  } else if (userAgent.includes('Mac') || userAgent.includes('Windows')) {
    return 'Desktop';
  }
  return 'Unknown Device';
}
```

#### e) Broadcast Pengumuman

Buat route baru di `server/src/routes/admin-routes.ts`:

```typescript
import { getEmailService } from '../services/email-service';

router.post('/broadcast', async (req, res) => {
  try {
    const { title, message, target } = req.body; // target: 'all', 'active', etc

    // Ambil daftar email parent
    const query = target === 'all'
      ? 'SELECT email FROM parents WHERE email IS NOT NULL'
      : 'SELECT p.email FROM parents p JOIN children c ON c.parent_id = p.id WHERE c.is_active = true';
    const result = await db.query(query);
    const emails = result.rows.map(r => r.email);

    const emailService = getEmailService();
    if (emailService && emails.length > 0) {
      await emailService.sendBroadcast(emails, title, message);
    }

    res.json({
      success: true,
      message: `Broadcast dikirim ke ${emails.length} orang tua`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
```

### 5. Frontend Integration

Tambahkan form broadcast di admin dashboard:

```tsx
// src/features/admin/components/BroadcastForm.tsx
import { useState } from 'react';

export default function BroadcastForm() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, target: 'all' }),
      });

      if (res.ok) {
        alert('Broadcast berhasil dikirim!');
        setTitle('');
        setMessage('');
      }
    } catch (error) {
      alert('Gagal mengirim broadcast');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <h2 className="text-xl font-bold mb-4">📢 Broadcast Pengumuman</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Judul</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
            placeholder="Contoh: Libur Hari Raya"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Pesan</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 h-40"
            placeholder="Tulis pesan broadcast..."
          />
        </div>

        <button
          onClick={handleSend}
          disabled={loading || !title || !message}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? 'Mengirim...' : 'Kirim Broadcast'}
        </button>
      </div>
    </div>
  );
}
```

---

## Testing Email Service

Buat test file:

```bash
# server/src/scripts/test-email.ts
import { initEmailService, getEmailService } from '../services/email-service';

async function testEmail() {
  // Initialize
  initEmailService({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: 'your-brevo-username',
      pass: 'your-brevo-api-key',
    },
    from: 'noreply@tpa-rumahceria.com',
    fromName: 'TPA Rumah Ceria',
  });

  const service = getEmailService();

  // Test connection
  const connected = await service!.testConnection();
  console.log('Connection:', connected ? '✅ OK' : '❌ Failed');

  // Test send email
  if (connected) {
    await service!.sendEmail({
      to: 'your-email@example.com',
      subject: 'Test Email from TPA',
      html: '<h1>Halo!</h1><p>Ini adalah test email dari sistem TPA.</p>',
    });
    console.log('Email sent!');
  }
}

testEmail().catch(console.error);
```

Jalankan:
```bash
npm run ts-node server/src/scripts/test-email.ts
```

---

## Memasang SPF dan DKIM (Agar Email Tidak Spam)

### 1. SPF (Sender Policy Framework)

Tambahkan DNS record di domain Anda:

```
Type: TXT
Name: @
Value: v=spf1 include:brevo.com ~all
```

### 2. DKIM (DomainKeys Identified Mail)

1. Login ke Brevo
2. Masuk menu **Senders** → **Your Senders**
3. Verifikasi domain
4. Brevo akan berikan DNS record DKIM:

```
Type: TXT
Name: s1._domainkey
Value: k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
```

Setelah DNS terupdate, status domain akan menjadi "Verified".

---

## Troubleshooting

### Email tidak masuk ke Inbox
- Cek folder **Spam/Junk**
- Pastikan SPF dan DKIM sudah terverifikasi
- Tingkatkan reputasi domain: kirim email gradual, jangan mass sekaligus

### Limit tercapai
- Brevo: 300 email/hari gratis, upgrade untuk lebih
- Gmail: 500 email/hari untuk akun gratis

### Connection timeout
- Pastikan port 587 tidak diblokir firewall
- Coba port 2525 (Brevo alternatif)

### Error: 550 5.7.1 (Gmail)
- Pastikan pakai **App Password**, bukan password biasa
- Cek 2-Step Verification sudah aktif

---

## Ringkasan Arsitektur

```
┌─────────────────┐
│   Server Lokal  │  ← Mini PC TPA
│   (Node.js)     │
└────────┬────────┘
         │ SMTP/API Request
         ▼
┌─────────────────┐
│  Email Provider │  ← Brevo / Gmail / SendGrid
│   (SMTP Relay)  │
└────────┬────────┘
         │ Email dikirim
         ▼
┌─────────────────┐
│  Inbox Ortu     │
└─────────────────┘
```

**Server lokal tidak perlu mengirim email langsung!** Cukup panggil relay provider.

---

## Daftar Cek Implementasi

- [ ] Daftar akun email provider (Brevo/Gmail Workspace)
- [ ] Setup domain lembaga (jika pakai domain custom)
- [ ] Install `nodemailer`
- [ ] Setup `.env` dengan credential email
- [ ] Initialize email service di `app.ts`
- [ ] Integrasikan notifikasi check-in/check-out
- [ ] Integrasikan notifikasi tagihan
- [ ] Integrasikan notifikasi login
- [ ] Buat form broadcast di admin
- [ ] Setup SPF di DNS
- [ ] Setup DKIM di DNS
- [ ] Test kirim email
- [ ] Deploy dan monitoring

---

## Referensi

- [Brevo Documentation](https://help.brevo.com/hc/en-us/articles/360007576799-How-to-set-up-your-SMTP-relay)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Gmail SMTP Settings](https://support.google.com/mail/answer/7126229)
