// ============================================================================
//  _auth.js  —  Utilidades compartidas de autenticación (no es una ruta)
// ----------------------------------------------------------------------------
//  Variables de entorno que debes configurar en Vercel (Settings -> Environment
//  Variables):
//
//   APP_USERS       Lista de usuarios autorizados, formato:
//                    usuario1:contraseña1,usuario2:contraseña2,usuario3:contraseña3
//                    (sin espacios alrededor de ':' ni ','; si una contraseña
//                    necesita ':' o ',', usa otra combinación más simple)
//
//   SESSION_SECRET   Una cadena larga y aleatoria, solo para firmar las
//                    cookies de sesión. Genera una con, por ejemplo:
//                      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//                    y pégala como valor de esta variable. Cualquier persona
//                    que conozca este secreto podría falsificar sesiones, así
//                    que trátalo con el mismo cuidado que la API key.
//
//   ANTHROPIC_API_KEY  La clave de Anthropic (ya la tenías configurada).
//
//  Para revocar a un usuario: quítalo de APP_USERS y vuelve a desplegar
//  (Redeploy) — sus sesiones ya emitidas también dejarán de validar contra la
//  lista en el siguiente login, pero si quieres invalidar sesiones YA abiertas
//  de inmediato, cambia también SESSION_SECRET (eso invalida todas las
//  sesiones activas de todos los usuarios a la vez).
// ============================================================================

const crypto = require('crypto');

const COOKIE_NAME = 'unspsc_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

function parseUsers() {
  const raw = process.env.APP_USERS || '';
  const map = {};
  raw.split(',').map(s => s.trim()).filter(Boolean).forEach(pair => {
    const idx = pair.indexOf(':');
    if (idx === -1) return;
    const user = pair.slice(0, idx).trim();
    const pass = pair.slice(idx + 1).trim();
    if (user) map[user] = pass;
  });
  return map;
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

// Comparación en tiempo constante para evitar timing attacks
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

function parseCookies(req) {
  const header = req.headers && req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySessionToken(token);
}

function setSessionCookie(res, token) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res) {
  const attrs = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Max-Age=0'
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

module.exports = {
  parseUsers,
  safeEqual,
  createSessionToken,
  verifySessionToken,
  getSessionUser,
  setSessionCookie,
  clearSessionCookie
};
