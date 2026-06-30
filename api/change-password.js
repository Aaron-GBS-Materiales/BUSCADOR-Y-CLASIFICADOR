// ============================================================================
//  /api/change-password  —  Cambiar la propia contraseña (requiere sesión)
// ----------------------------------------------------------------------------
//  POST { currentPassword, newPassword }
//  Requiere estar autenticado (cookie de sesión válida). Pide la contraseña
//  actual como confirmación, aunque ya esté logueado, por seguridad (evita
//  que alguien con la sesión abierta en un equipo compartido la cambie sin
//  saber la contraseña real).
// ============================================================================

const { getSessionUser } = require('./_auth');
const { verifyPassword, setPassword } = require('./_users');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método no permitido.' } });
    return;
  }

  const username = getSessionUser(req);
  if (!username) {
    res.status(401).json({ error: { message: 'Sesión no autenticada o expirada.' } });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: { message: 'Indica tu contraseña actual y la nueva.' } });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: { message: 'La nueva contraseña debe tener al menos 8 caracteres.' } });
    return;
  }

  try {
    const valid = await verifyPassword(username, currentPassword);
    if (!valid) {
      res.status(401).json({ error: { message: 'Tu contraseña actual no es correcta.' } });
      return;
    }
    await setPassword(username, newPassword);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: { message: e && e.message ? e.message : 'Error del servidor.' } });
  }
};
