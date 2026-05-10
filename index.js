const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const BASE44_API_KEY = process.env.BASE44_API_KEY || '';
const APP_ID = '69ecdce9d344ba3f09910fa1';

// Tenta todos os formatos de autenticação possíveis do Base44
async function base44Fetch(path, options = {}) {
  const bases = [
    `https://app.base44.com/api/apps/${APP_ID}`,
    `https://api.base44.com/api/apps/${APP_ID}`,
  ];
  const headerSets = [
    { 'api-key': BASE44_API_KEY },
    { 'X-API-Key': BASE44_API_KEY },
    { 'Authorization': `Api-Key ${BASE44_API_KEY}` },
    { 'Authorization': `apikey ${BASE44_API_KEY}` },
  ];

  for (const base of bases) {
    for (const authHeaders of headerSets) {
      try {
        const res = await fetch(`${base}${path}`, {
          ...options,
          headers: { 'Content-Type': 'application/json', ...authHeaders, ...(options.headers || {}) }
        });
        const text = await res.text();
        console.log(`[${base}${path}] headers:${JSON.stringify(authHeaders)} status:${res.status} body:${text.substring(0,100)}`);
        if (res.ok) return JSON.parse(text);
        if (res.status === 403 || res.status === 401) continue; // tenta próximo
        throw new Error(`Status ${res.status}: ${text}`);
      } catch(e) {
        if (e.message.startsWith('Status')) throw e;
        continue;
      }
    }
  }
  throw new Error('Todas as tentativas de autenticação falharam');
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => res.json({ status: 'Speed Técnico API rodando!', key: BASE44_API_KEY ? 'configurada' : 'AUSENTE' }));

app.get('/test', async (req, res) => {
  try {
    const data = await base44Fetch('/entities/UsuariosApp?limit=1');
    res.json({ success: true, data });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

app.post('/tecnico/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatórios' });
    const q = encodeURIComponent(JSON.stringify({ user_email: email.toLowerCase().trim() }));
    const data = await base44Fetch(`/entities/UsuariosApp?query=${q}&limit=10`);
    const users = data.entities || [];
    if (users.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });
    const user = users[0];
    if (!user.senha_app) return res.status(401).json({ error: 'Senha não cadastrada. Fale com o supervisor.' });
    if (user.senha_app !== senha) return res.status(401).json({ error: 'Senha incorreta' });
    res.json({ success: true, user: { id: user.id, name: user.nome, email: user.user_email, role: user.tipo_usuario } });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/tecnico/ordens', async (req, res) => {
  try {
    const { email, role } = req.query;
    const path = role === 'gestor'
      ? `/entities/ServiceOrder?limit=200&sort=-created_date`
      : `/entities/ServiceOrder?query=${encodeURIComponent(JSON.stringify({ assigned_technician_email: email }))}&limit=200&sort=-created_date`;
    const data = await base44Fetch(path);
    res.json({ entities: data.entities || data || [] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/tecnico/ordens/:id', async (req, res) => {
  try {
    const data = await base44Fetch(`/entities/ServiceOrder/${req.params.id}`, { method: 'PUT', body: JSON.stringify(req.body) });
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
