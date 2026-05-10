const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const APP_ID = '69ecdce9d344ba3f09910fa1';
const BASE44_URL = `https://app.base44.com/api/apps/${APP_ID}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  console.log('Logging in as admin...');
  const res = await fetch(`${BASE44_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  const text = await res.text();
  console.log('Auth response:', res.status, text.substring(0, 300));
  if (!res.ok) throw new Error('Auth falhou: ' + text);
  const data = JSON.parse(text);
  cachedToken = data.token || data.access_token;
  tokenExpiry = Date.now() + 3500000;
  return cachedToken;
}

async function base44Fetch(path, options = {}) {
  const token = await getToken();
  const url = `${BASE44_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await res.text();
  console.log(`[${path}] ${res.status}: ${text.substring(0, 200)}`);
  if (!res.ok) throw new Error(`Status ${res.status}: ${text}`);
  return JSON.parse(text);
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/', async (req, res) => {
  try {
    await getToken();
    res.json({ status: 'Speed Técnico API rodando!', auth: 'OK' });
  } catch(e) {
    res.json({ status: 'Rodando', auth: 'FALHOU: ' + e.message });
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
