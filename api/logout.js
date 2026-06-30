// ============================================================================
//  /api/logout  —  Cierra la sesión (borra la cookie)
// ============================================================================

const { clearSessionCookie } = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método no permitido.' } });
    return;
  }
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
};
