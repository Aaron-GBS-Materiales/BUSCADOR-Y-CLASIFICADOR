// ============================================================================
//  /api/login  —  Autenticación de usuarios (almacenados en Vercel KV)
// ----------------------------------------------------------------------------
//  POST { user, pass }  ->  valida contra la base de datos de usuarios y, si
//                            es correcto, emite una cookie de sesión firmada.
//  GET                  ->  comprueba si ya existe una sesión válida (la usa
//                            el frontend al cargar la página).
// ============================================================================

const { verifyPassword } = require('./_users');
const { createSessionToken, getSessionUser, setSessionCookie } = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const user = getSessionUser(req);
    if (user) {
      res.status(200).json({ user });
    } else {
      res.status(401).json({ error: { message: 'No hay sesión activa.' } });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método no permitido.' } });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};

  const user = typeof body.user === 'string' ? body.user.trim() : '';
  const pass = typeof body.pass === 'string' ? body.pass : '';

  if (!user || !pass) {
    res.status(400).json({ error: { message: 'Usuario y contraseña son obligatorios.' } });
    return;
  }

  try {
    const { getUser } = require('./_users');
    const userData = await getUser(user);
    console.log('[LOGIN DEBUG] usuario buscado:', user);
    console.log('[LOGIN DEBUG] usuario encontrado:', userData ? 'SÍ' : 'NO');
    if (userData) {
      console.log('[LOGIN DEBUG] tipo de dato:', typeof userData);
      console.log('[LOGIN DEBUG] tiene passwordSalt:', !!userData.passwordSalt);
    }
    valid = await verifyPassword(user, pass);
    console.log('[LOGIN DEBUG] password válido:', valid);
  } catch (e) {
    console.log('[LOGIN DEBUG] error:', e.message);
    res.status(500).json({ error: { message: 'Error del servidor al verificar credenciales.' } });
    return;
  }

  if (!valid) {
    res.status(401).json({ error: { message: 'Usuario o contraseña incorrectos.' } });
    return;
  }

  try {
    const token = createSessionToken(user.toLowerCase());
    setSessionCookie(res, token);
    // Incluir si tiene pregunta de seguridad configurada
    const { getUser } = require('./_users');
    const userData = await getUser(user).catch(() => null);
    const securityConfigured = !!(userData && userData.securityQuestion && userData.securityQuestion.trim());
    res.status(200).json({ user: user.toLowerCase(), securityConfigured });
  } catch (e) {
    res.status(500).json({ error: { message: 'Error del servidor: ' + (e && e.message ? e.message : String(e)) } });
  }
};
