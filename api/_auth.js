// _auth.js — Autenticación con token en Authorization header (sin cookies)
const crypto = require('crypto');

const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createSessionToken(username) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Falta SESSION_SECRET en el servidor.');
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${username}.${exp}`;
  const sig = sign(payload, secret);
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [username, expStr, sig] = parts;
  const expected = sign(`${username}.${expStr}`, secret);
  if (!safeEqual(sig, expected)) return null;
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() / 1000 > exp) return null;
  return username;
}

function getSessionUser(req) {
  // Leer token desde Authorization header: "Bearer <token>"
  const authHeader = req.headers && req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return verifySessionToken(token);
  }
  return null;
}

module.exports = {
  safeEqual,
  createSessionToken,
  verifySessionToken,
  getSessionUser
};
