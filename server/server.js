const path = require('path');
const express = require('express');
const { normas, familias } = require('./knowledgeBase');
const { responder } = require('./matcher');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Sin IA, sin credenciales, sin costo por uso: toda la respuesta se calcula
// de forma local y sincrónica a partir de la base de conocimiento pre-cargada
// (normas.json, epp_info.json, familias.json, actualizaciones_2024_2026.json).
app.post('/api/ask', (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Falta "message" en el cuerpo de la solicitud.' });
    }
    const reply = responder(message);
    res.json({ reply });
  } catch (err) {
    console.error('Error en /api/ask:', err);
    res.status(500).json({ error: 'Error al generar la respuesta. Intenta de nuevo.' });
  }
});

// Expone la taxonomía y el glosario para poblar el sidebar sin hardcodearlo en el frontend
app.get('/api/sidebar', (_req, res) => {
  const temario = Object.entries(normas).map(([codigo, n]) => ({
    codigo,
    titulo: n.titulo,
  }));
  const categorias = Object.entries(familias).map(([id, f]) => ({
    id,
    label: f.label,
    icono: f.icono,
  }));
  res.json({ temario, categorias });
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`BuscaEPP Agente (EPPI) escuchando en puerto ${PORT} — modo sin IA, respuestas pre-establecidas.`);
});
