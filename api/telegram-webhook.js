const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const message = req.body?.message;
  if (!message) return res.status(200).end();

  const text = message.text || '';
  const chatId = String(message.chat?.id);

  // Sadece admin kullanabilir
  if (chatId !== String(ADMIN_CHAT_ID)) {
    return res.status(200).end();
  }

  if (text.startsWith('/onayla ')) {
    const email = text.split(' ')[1]?.trim();
    if (!email) {
      await sendTelegram(chatId, '❌ Kullanım: /onayla email@example.com');
      return res.status(200).end();
    }

    try {
      const response = await fetch('https://hukukai.pro/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', email, secret: ADMIN_SECRET }),
      });

      const result = await response.json();

      if (result.success) {
        await sendTelegram(chatId, `✅ ${email} onaylandı, bildirimler gönderildi.`);
      } else {
        await sendTelegram(chatId, `❌ Hata: ${result.error}`);
      }
    } catch (e) {
      await sendTelegram(chatId, `❌ Sunucu hatası: ${e.message}`);
    }
  }

  res.status(200).end();
}

async function sendTelegram(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
