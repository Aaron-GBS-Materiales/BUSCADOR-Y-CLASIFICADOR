// ============================================================================
//  /api/register  —  Alta de usuarios (uso EXCLUSIVO del administrador)
// ----------------------------------------------------------------------------
//  POST { adminSecret, username, password, securityQuestion, securityAnswer }
//
//  Este endpoint NO está pensado para que los usuarios se registren solos:
//  está protegido con un secreto de administrador (variable de entorno
//  ADMIN_SECRET) que solo tú conoces. Úsalo para dar de alta a cada persona
//  autorizada, una sola vez por usuario.
//
//  Recomendación: una vez que hayas dado de alta a todos tus usuarios,
//  considera eliminar este archivo o reforzar ADMIN_SECRET con algo robusto.
// ============================================================================

const { createUser, userExists } = require('./_users');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // Permite que el panel privado de administración (abierto como archivo
  // local, origin "null") pueda llamar a este endpoint. La seguridad real
  // sigue siendo el ADMIN_SECRET, no el origen de la petición.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método no permitido.' } });
    return;
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(500).json({ error: { message: 'Falta configurar ADMIN_SECRET en el servidor.' } });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};

  if (body.adminSecret !== adminSecret) {
    res.status(403).json({ error: { message: 'Secreto de administrador incorrecto.' } });
    return;
  }

  const { username, password, securityQuestion, securityAnswer } = body;

  if (!username || !password || !securityQuestion || !securityAnswer) {
    res.status(400).json({ error: { message: 'Faltan campos: username, password, securityQuestion, securityAnswer.' } });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ error: { message: 'La contraseña debe tener al menos 8 caracteres.' } });
    return;
  }

  try {
    if (await userExists(username)) {
      res.status(409).json({ error: { message: 'Ese usuario ya existe.' } });
      return;
    }
    const created = await createUser({ username, password, securityQuestion, securityAnswer });
    res.status(201).json({ ok: true, user: created.username });
  } catch (e) {
    res.status(500).json({ error: { message: e && e.message ? e.message : 'Error al crear el usuario.' } });
  }
};
