// ============================================================================
//  PROXY SEGURO  ->  /api/clasificar   (Función Serverless de Vercel)
// ----------------------------------------------------------------------------
//  La clave de Anthropic NO está en este archivo ni en el navegador.
//  Se lee de la variable de entorno  ANTHROPIC_API_KEY  configurada en Vercel:
//     Vercel  ->  Project  ->  Settings  ->  Environment Variables
//     Name:  ANTHROPIC_API_KEY     Value:  sk-ant-api03-...
//
//  El navegador llama a /api/clasificar; esta función añade la clave y reenvía
//  la petición a api.anthropic.com, devolviendo la respuesta tal cual.
// ============================================================================

module.exports = async (req, res) => {
  // Solo se permite POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método no permitido. Usa POST.' } });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  if (!apiKey) {
    res.status(500).json({
      error: { message: 'Falta la variable de entorno ANTHROPIC_API_KEY en el servidor.' }
    });
    return;
  }

  // El cuerpo puede llegar ya parseado (objeto) o como texto
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};

  // Reenviar SOLO los campos esperados (evita usar el proxy para otra cosa)
  const payload = {
    model: typeof body.model === 'string' ? body.model : model,
    max_tokens: Math.min(Math.max(Number(body.max_tokens) || 1500, 1), 4096),
    messages: Array.isArray(body.messages) ? body.messages : []
  };
  if (typeof body.system === 'string') payload.system = body.system;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({}));
    // No cachear respuestas de la API
    res.setHeader('Cache-Control', 'no-store');
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({
      error: { message: 'Error contactando a Anthropic desde el servidor: ' + (e && e.message ? e.message : String(e)) }
    });
  }
};

