// ============================================================================
//  /api/forgot-password  —  Paso 1 de recuperación: obtener la pregunta
// ----------------------------------------------------------------------------
//  POST { username }  ->  si el usuario existe, devuelve su pregunta de
//                          seguridad. Si no existe, devuelve una pregunta
//                          genérica igualmente (mismo formato de respuesta),
//                          para no revelar qué usuarios existen en el sistema.
// ============================================================================

const { getSecurityQuestion } = require('./_users');

const GENERIC_QUESTION = '¿Cuál es tu pregunta de seguridad?';

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
  if (!username) {
    res.status(400).json({ error: { message: 'Indica tu usuario.' } });
    return;
  }

  try {
    const question = await getSecurityQuestion(username);
    // Respuesta uniforme exista o no el usuario, para no filtrar información.
    res.status(200).json({ question: question || GENERIC_QUESTION });
  } catch (e) {
    res.status(500).json({ error: { message: 'Error del servidor.' } });
  }
};
