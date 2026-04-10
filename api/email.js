export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { subject, html, htmlBody, to, type, username } = req.body;

    if (!process.env.RESEND_API_KEY)
        return res.status(200).json({ success: false, reason: 'Resend yapılandırılmamış.' });

    // Onay maili şablonu
    let finalHtml = html || htmlBody || '<p>Bildirim</p>';
    if (type === 'approval') {
        finalHtml = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0f1428;color:#e8e4da;border-radius:12px;overflow:hidden;">
            <div style="background:linear-gradient(90deg,#16a34a,#7c3aed);padding:20px 28px;">
                <h2 style="margin:0;color:#fff;">✅ Hesabınız Onaylandı!</h2>
            </div>
            <div style="padding:28px;">
                <p>Merhaba <strong>${username || 'Kullanıcı'}</strong>,</p>
                <p style="color:#94a3b8;">HukukAI Pro hesabınız yönetici tarafından onaylandı. Artık giriş yapabilirsiniz.</p>
                <div style="text-align:center;margin:24px 0;">
                    <a href="https://hukukai.pro" style="background:linear-gradient(90deg,#7c3aed,#dc2626);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
                        Giriş Yap →
                    </a>
                </div>
            </div>
            <div style="background:rgba(124,58,237,.15);padding:14px 28px;font-size:12px;color:#a78bfa;text-align:center;">hukukai.pro</div>
        </div>`;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'HukukAI Pro <noreply@hukukai.pro>',
                to:      to      || process.env.EMAIL_TO || 'tarikbuluthandsome@hotmail.com',
                subject: subject || 'HukukAI Pro Bildirimi',
                html: finalHtml
            })
        });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ error: data.message });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
