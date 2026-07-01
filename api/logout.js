// logout: el token vive en localStorage del cliente, solo confirmar
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true });
};
