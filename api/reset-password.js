// ============================================================================
//  /api/reset-password  —  Paso 2 de recuperación: verificar respuesta y
//                            establecer una contraseña nueva
// ----------------------------------------------------------------------------
//  POST { username, securityAnswer, newPassword }
//
//  Incluye un límite de intentos fallidos por usuario (anti fuerza-bruta de
//  la respuesta de seguridad): tras varios intentos incorrectos en una
//  ventana de tiempo, se bloquea temporalmente.
// ============================================================================

const { verifySecurityAnswer, setPassword, userExists } = require('./_users');
const { kv } = require('@vercel/kv');

const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_SECONDS = 15 * 60; // 15 minutos

function attemptsKey(username) {
  return `reset_attempts:${String(username).trim().toLowerCase()}`;
}

async function getAttempts(username) {
  const v = await kv.get(attemptsKey(username));
  return typeof v === 'number' ? v : 0;
}

async function registerFailedAttempt(username) {
  const key = attemptsKey(username);
  const current = await getAttempts(username);
  const next = current + 1;
  await kv.set(key, next, { ex: LOCK_WINDOW_SECONDS });
  return next;
}

async function clearAttempts(username) {
  await kv.del(attemptsKey(username));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método no permitido.' } });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const securityAnswer = typeof body.securityAnswer === 'string' ? body.securityAnswer : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!username || !securityAnswer || !newPassword) {
    res.status(400).json({ error: { message: 'Faltan datos: usuario, respuesta de seguridad y nueva contraseña.' } });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: { message: 'La nueva contraseña debe tener al menos 8 caracteres.' } });
    return;
  }

  try {
    const exists = await userExists(username);
    if (!exists) {
      // Mismo mensaje genérico que una respuesta incorrecta, para no revelar
      // si el usuario existe.
      res.status(401).json({ error: { message: 'Usuario o respuesta de seguridad incorrectos.' } });
      return;
    }

    const attempts = await getAttempts(username);
    if (attempts >= MAX_ATTEMPTS) {
      res.status(429).json({ error: { message: 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.' } });
      return;
    }

    const valid = await verifySecurityAnswer(username, securityAnswer);
    if (!valid) {
      const total = await registerFailedAttempt(username);
      const restantes = Math.max(MAX_ATTEMPTS - total, 0);
      res.status(401).json({
        error: { message: `Respuesta de seguridad incorrecta. Intentos restantes: ${restantes}.` }
      });
      return;
    }

    await clearAttempts(username);
    await setPassword(username, newPassword);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: { message: e && e.message ? e.message : 'Error del servidor.' } });
  }
};
