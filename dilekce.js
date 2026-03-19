const jwt        = require('jsonwebtoken');
const { connectDB } = require('../lib/mongodb.js');
const { Dilekce }   = require('../lib/models.js');

function verifyToken(req) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return null;
    try { return jwt.verify(token, process.env.JWT_SECRET); } catch { return null; }
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const decoded = verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Oturum gerekli.' });

    await connectDB();

    if (req.method === 'POST') {
        const { title, content, davaType } = req.body;
        if (!title || !content) return res.status(400).json({ error: 'Başlık ve içerik zorunludur.' });
        const doc = await Dilekce.create({
            userId: decoded.userId, username: decoded.username, title, content, davaType: davaType || ''
        });
        return res.status(201).json({ success: true, dilekce: doc });
    }

    if (req.method === 'GET') {
        const filter = decoded.role === 'master' ? {} : { userId: decoded.userId };
        const list = await Dilekce.find(filter).sort({ createdAt: -1 }).limit(100);
        return res.status(200).json({ dilekce: list });
    }

    if (req.method === 'DELETE') {
        const { id } = req.query;
        const filter = decoded.role === 'master'
            ? { _id: id }
            : { _id: id, userId: decoded.userId };
        await Dilekce.findOneAndDelete(filter);
        return res.status(200).json({ success: true });
    }

    return res.status(405).end();
};
