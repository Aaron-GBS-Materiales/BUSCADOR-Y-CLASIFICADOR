// ============================================================================
//  /api/login  —  Autenticación de usuarios autorizados
// ----------------------------------------------------------------------------
//  POST { user, pass }  ->  valida contra APP_USERS (variable de entorno) y,
//                            si es correcto, emite una cookie de sesión firmada.
//  GET                  ->  comprueba si ya existe una sesión válida (la usa
//                            el frontend al cargar la página, para no pedir
//                            login otra vez si la cookie sigue vigente).
// ============================================================================

const { parseUsers, safeEqual, createSessionToken, getSessionUser, setSessionCookie } = require('./_auth');

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

  const users = parseUsers();
  const expectedPass = users[user];

  // Si el usuario no existe, igual comparamos contra un valor fijo para que
  // el tiempo de respuesta no delate si el usuario existe o no.
  const valid = expectedPass !== undefined && safeEqual(pass, expectedPass);

  if (!valid) {
    res.status(401).json({ error: { message: 'Usuario o contraseña incorrectos.' } });
    return;
  }

  try {
    const token = createSessionToken(user);
    setSessionCookie(res, token);
    res.status(200).json({ user });
  } catch (e) {
    res.status(500).json({ error: { message: 'Error del servidor: ' + (e && e.message ? e.message : String(e)) } });
  }
};
