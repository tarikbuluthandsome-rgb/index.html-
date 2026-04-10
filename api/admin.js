import clientPromise from '../lib/mongodb';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { action, email, secret } = req.body;

  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Yetkisiz' });
  }

  if (action === 'approve') {
    const client = await clientPromise;
    const db = client.db();

    const result = await db.collection('users').findOneAndUpdate(
      { email },
      { $set: { status: 'approved', approvedAt: new Date() } },
      { returnDocument: 'after' }
    );

    const user = result.value;

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }

    // 1. Kullanıcıya e-posta
    await resend.emails.send({
      from: 'noreply@hukukai.pro',
      to: email,
      subject: 'HukukAI Pro - Hesabınız Onaylandı! 🎉',
      html: approvalEmailHtml(user.name || email),
    });

    // 2. Kullanıcıya Telegram (telegram_id kayıtlıysa)
    if (user.telegram_id) {
      await sendTelegram(
        user.telegram_id,
        `✅ Hesabınız onaylandı!\n\nHukukAI Pro'ya giriş yapabilirsiniz:\nhttps://hukukai.pro/giris`
      );
    }

    // 3. Admin'e bilgi
    await sendTelegram(ADMIN_CHAT_ID, `✅ Onaylandı: ${email}`);

    return res.status(200).json({ success: true });
  }

  res.status(400).json({ error: 'Bilinmeyen işlem' });
}

async function sendTelegram(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function approvalEmailHtml(name) {
  return `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px">
      <h2 style="color:#2563eb">🎉 Hesabınız Onaylandı!</h2>
      <p>Merhaba <strong>${name}</strong>,</p>
      <p>HukukAI Pro hesabınız yönetici tarafından onaylandı. Artık giriş yapabilirsiniz.</p>
      <a href="https://hukukai.pro/giris"
         style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
        Giriş Yap →
      </a>
      <p style="color:#888;margin-top:32px;font-size:12px">HukukAI Pro ekibi</p>
    </div>
  `;
}
