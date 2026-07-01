// /api/security-setup — El usuario configura su propia pregunta de seguridad
// Requiere sesión válida (cookie). El admin nunca ve la pregunta ni la respuesta.

const { getSessionUser } = require('./_auth');
const { setSecurityAnswer } = require('./_users');

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

  const { securityQuestion, securityAnswer } = body;

  if (!securityQuestion || !securityAnswer) {
    res.status(400).json({ error: { message: 'Faltan la pregunta y la respuesta.' } });
    return;
  }

  try {
    await setSecurityAnswer(username, securityQuestion, securityAnswer);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: { message: e && e.message ? e.message : 'Error del servidor.' } });
  }
};
