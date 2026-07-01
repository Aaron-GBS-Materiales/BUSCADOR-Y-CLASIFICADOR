const { createUser, userExists } = require('./_users');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método no permitido.' } });
    return;
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    res.status(500).json({ error: { message: 'Falta configurar ADMIN_SECRET.' } });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body && typeof body === 'object' ? body : {};

  if (body.adminSecret !== adminSecret) {
    res.status(403).json({ error: { message: 'Secreto de administrador incorrecto.' } });
    return;
  }

  const { username, password } = body;

  if (!username || !password) {
    res.status(400).json({ error: { message: 'Faltan campos: username y password.' } });
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
    // Pregunta de seguridad vacía — el usuario la configurará en su primer login
    const created = await createUser({
      username, password,
      securityQuestion: '',
      securityAnswer: ''
    });
    res.status(201).json({ ok: true, user: created.username });
  } catch (e) {
    res.status(500).json({ error: { message: e && e.message ? e.message : 'Error al crear el usuario.' } });
  }
};
