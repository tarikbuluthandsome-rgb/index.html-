export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Metin gerekli' });

    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'API key eksik' });
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: `Sen bir Türk hukuk asistanısın. Aşağıdaki olayı analiz et ve SADECE JSON formatında yanıt ver, başka hiçbir şey yazma.

Olay: "${text}"

Şu JSON formatını kullan:
{
  "davaTuru": "dava türü kodu",
  "davaLabel": "Türkçe dava adı",
  "talepler": "- Talep 1\\n- Talep 2\\n- Talep 3",
  "ozet": "Kısa hukuki özet",
  "aciliyet": "yüksek/orta/düşük"
}

Dava türü kodları: bosanma, bosanma-zina, bosanma-terk, velayet, kisisel, nafaka-yoksulluk, nafaka-tedbir, nafaka-istihkak, siddet, malrejimi, soybagi, iscilik, isciiseinali, iscimobbing, kira-tahliye, icra-itiraz, alacak, tuketici, sigorta, tapu, miras-taksim, miras-red, vasiyetname, ortakligin-giderilmesi, idari-itiraz, idari-tam-yargi, ceza-ihbar, sikayetten-vazgecme, taksirle-yaralama, ticari-uyusmazlik

Sadece JSON döndür, markdown veya açıklama ekleme.`
                }]
            })
        });

        const data = await response.json();
        const content = data.content?.[0]?.text || '';

        let result;
        try {
            result = JSON.parse(content.replace(/```json|```/g, '').trim());
        } catch(e) {
            return res.status(500).json({ error: 'AI yanıtı ayrıştırılamadı' });
        }

        return res.status(200).json({ success: true, result });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
