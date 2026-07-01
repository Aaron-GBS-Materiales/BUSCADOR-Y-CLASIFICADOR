const crypto = require('crypto');
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const SEP = '|'; // separador que no aparece en usernames ni en hex

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
  const payload = `${username}${SEP}${exp}`;
  const sig = sign(payload, secret);
  return `${payload}${SEP}${sig}`;
}

function verifySessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return null;
  const lastSep = token.lastIndexOf(SEP);
  const prevSep = token.lastIndexOf(SEP, lastSep - 1);
  if (lastSep === -1 || prevSep === -1 || prevSep === lastSep) return null;
  const sig = token.slice(lastSep + 1);
  const payload = token.slice(0, lastSep);
  const expected = sign(payload, secret);
  if (!safeEqual(sig, expected)) return null;
  const expStr = token.slice(prevSep + 1, lastSep);
  const username = token.slice(0, prevSep);
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() / 1000 > exp) return null;
  return username;
}

function getSessionUser(req) {
  const authHeader = req.headers && req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return verifySessionToken(token);
  }
  return null;
}

module.exports = { safeEqual, createSessionToken, verifySessionToken, getSessionUser };
