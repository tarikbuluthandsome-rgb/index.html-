module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { subject, html, to } = req.body;
    if (!process.env.RESEND_API_KEY)
        return res.status(200).json({ success: false, reason: 'Resend yapılandırılmamış.' });

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'HukukAI Pro <onboarding@resend.dev>',
                to:      to      || process.env.EMAIL_TO || 'info@hukukai.pro',
                subject: subject || 'Yeni Bildirim',
                html:    html    || '<p>Bildirim</p>'
            })
        });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ error: data.message });
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
