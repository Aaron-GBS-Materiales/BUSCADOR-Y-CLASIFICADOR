// /api/security-status — Verifica si el usuario tiene pregunta de seguridad
const { getSessionUser } = require('./_auth');
const { getUser } = require('./_users');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const username = getSessionUser(req);
  if (!username) { res.status(401).json({ configured: false }); return; }

  const user = await getUser(username).catch(() => null);
  const configured = !!(user && user.securityQuestion && user.securityQuestion.trim());
  res.status(200).json({ configured });
};
