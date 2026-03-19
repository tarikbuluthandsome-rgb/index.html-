import bcrypt      from 'bcryptjs';
import jwt          from 'jsonwebtoken';
import { connectDB } from '../lib/mongodb.js';
import { User }      from '../lib/models.js';

const JWT_SECRET  = process.env.JWT_SECRET;
const MASTER_USER = process.env.MASTER_USERNAME || 'master';
const MASTER_HASH = process.env.MASTER_PASSWORD_HASH; /* bcrypt hash of master password */

function verifyToken(req) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return null;
    try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function requireMaster(req, res) {
    const decoded = verifyToken(req);
    if (!decoded || decoded.role !== 'master') {
        res.status(403).json({ error: 'Master yetkisi gerekli.' });
        return null;
    }
    return decoded;
}

export default async function handler(req, res) {
    /* CORS */
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const action = req.query.action;
    await connectDB();

    /* ─────────────────────────────────────────
       MASTER GİRİŞİ
    ───────────────────────────────────────── */
    if (action === 'master-login') {
        if (req.method !== 'POST') return res.status(405).end();
        const { key } = req.body;
        if (!key || !MASTER_HASH) return res.status(401).json({ error: 'Geçersiz kimlik bilgileri.' });
        const ok = await bcrypt.compare(key, MASTER_HASH);
        if (!ok) return res.status(401).json({ error: 'Geçersiz master key.' });
        const token = jwt.sign(
            { role: 'master', username: MASTER_USER },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        return res.status(200).json({ token, user: { role: 'master', username: MASTER_USER } });
    }

    /* ─────────────────────────────────────────
       KULLANICI GİRİŞİ
    ───────────────────────────────────────── */
    if (action === 'login') {
        if (req.method !== 'POST') return res.status(405).end();
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });

        const user = await User.findOne({
            $or: [{ username }, { email: username.toLowerCase() }]
        });
        if (!user) return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre.' });

        if (user.status === 'pending')  return res.status(403).json({ error: 'Hesabınız onay bekliyor.' });
        if (user.status === 'blocked')  return res.status(403).json({ error: 'Hesabınız engellenmiştir.' });
        if (user.status === 'banned')   return res.status(403).json({ error: `Hesabınız yasaklanmıştır. Sebep: ${user.banReason || '-'}` });
        if (user.status === 'passive')  return res.status(403).json({ error: 'Hesabınız pasif durumdadır.' });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre.' });

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { userId: user._id, username: user.username, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        return res.status(200).json({
            token,
            user: { _id: user._id, username: user.username, email: user.email, role: user.role }
        });
    }

    /* ─────────────────────────────────────────
       KAYIT
    ───────────────────────────────────────── */
    if (action === 'register') {
        if (req.method !== 'POST') return res.status(405).end();
        const { username, email, password, fullName } = req.body;

        if (!username || !email || !password || !fullName)
            return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
            return res.status(400).json({ error: 'Geçersiz e-posta adresi.' });
        if (password.length < 6)
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
        if (!/^[a-zA-Z0-9_\-]+$/.test(username))
            return res.status(400).json({ error: 'Kullanıcı adı geçersiz karakter içeriyor.' });

        const exists = await User.findOne({ $or: [{ username }, { email: email.toLowerCase() }] });
        if (exists) return res.status(409).json({ error: 'Bu kullanıcı adı veya e-posta zaten kayıtlı.' });

        const hashed = await bcrypt.hash(password, 12);
        await User.create({ username, email: email.toLowerCase(), password: hashed, fullName, status: 'pending' });

        return res.status(201).json({ success: true, message: 'Kayıt talebiniz alındı, onay bekleniyor.' });
    }

    /* ─────────────────────────────────────────
       TELEGRAM BİLDİRİMİ  (eski auth.js yerine)
    ───────────────────────────────────────── */
    if (action === 'telegram-notify') {
        if (req.method !== 'POST') return res.status(405).end();
        const { message } = req.body;
        if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID)
            return res.status(200).json({ success: false, reason: 'Telegram yapılandırılmamış.' });
        try {
            const r = await fetch(
                `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' })
                }
            );
            const data = await r.json();
            return res.status(200).json({ success: true, data });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    /* ─────────────────────────────────────────
       KULLANICI ONAYLA  (master)
    ───────────────────────────────────────── */
    if (action === 'approve-user') {
        if (req.method !== 'POST') return res.status(405).end();
        if (!requireMaster(req, res)) return;
        const { userId } = req.body;
        const user = await User.findByIdAndUpdate(
            userId,
            { status: 'active', approvedDate: new Date() },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        return res.status(200).json({ success: true, user: { _id: user._id, username: user.username, status: user.status } });
    }

    /* ─────────────────────────────────────────
       KULLANICI REDDET  (master)
    ───────────────────────────────────────── */
    if (action === 'reject-user') {
        if (req.method !== 'POST') return res.status(405).end();
        if (!requireMaster(req, res)) return;
        const { userId } = req.body;
        await User.findByIdAndDelete(userId);
        return res.status(200).json({ success: true });
    }

    /* ─────────────────────────────────────────
       BAN  (master)
    ───────────────────────────────────────── */
    if (action === 'ban-user') {
        if (req.method !== 'POST') return res.status(405).end();
        if (!requireMaster(req, res)) return;
        const { userId, reason } = req.body;
        const user = await User.findByIdAndUpdate(
            userId,
            { status: 'banned', banReason: reason || 'Belirtilmedi', banDate: new Date() },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        return res.status(200).json({ success: true, user: { _id: user._id, username: user.username, status: user.status } });
    }

    /* ─────────────────────────────────────────
       ENGELLE / ENGEL KALDIR  (master)
    ───────────────────────────────────────── */
    if (action === 'block-user' || action === 'unblock-user') {
        if (req.method !== 'POST') return res.status(405).end();
        if (!requireMaster(req, res)) return;
        const { userId } = req.body;
        const newStatus = action === 'block-user' ? 'blocked' : 'active';
        const user = await User.findByIdAndUpdate(userId, { status: newStatus }, { new: true });
        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        return res.status(200).json({ success: true, user: { _id: user._id, username: user.username, status: user.status } });
    }

    /* ─────────────────────────────────────────
       SİL  (master)
    ───────────────────────────────────────── */
    if (action === 'delete-user') {
        if (req.method !== 'POST') return res.status(405).end();
        if (!requireMaster(req, res)) return;
        const { userId } = req.body;
        await User.findByIdAndDelete(userId);
        return res.status(200).json({ success: true });
    }

    /* ─────────────────────────────────────────
       KULLANICI LİSTESİ  (master)
    ───────────────────────────────────────── */
    if (action === 'list-users') {
        if (req.method !== 'GET') return res.status(405).end();
        if (!requireMaster(req, res)) return;
        const { status } = req.query;
        const filter = status ? { status } : {};
        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(500);
        return res.status(200).json({ users });
    }

    /* ─────────────────────────────────────────
       MASTER ŞİFRE DEĞİŞTİR  (master)
    ───────────────────────────────────────── */
    if (action === 'change-master') {
        if (req.method !== 'POST') return res.status(405).end();
        if (!requireMaster(req, res)) return;
        /* Not: Vercel'de env değişkeni runtime'da değiştirilemez.
           Bu endpoint sadece yeni hash'i döndürür; .env'i manuel güncellemen gerekir. */
        const { newKey } = req.body;
        if (!newKey || newKey.length < 6) return res.status(400).json({ error: 'En az 6 karakter.' });
        const newHash = await bcrypt.hash(newKey, 12);
        return res.status(200).json({
            success: true,
            message: 'Aşağıdaki hash\'i Vercel Dashboard\'da MASTER_PASSWORD_HASH olarak kaydet.',
            hash: newHash
        });
    }

    return res.status(404).json({ error: 'Geçersiz action.' });
}
