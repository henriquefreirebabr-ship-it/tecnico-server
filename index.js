const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const BASE44_API_KEY = process.env.BASE44_API_KEY || '';
const APP_ID = '69ecdce9d344ba3f09910fa1';

async function base44Fetch(path, options = {}) {
  const url = `https://api.base44.com/api/apps/${APP_ID}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'api-key': BASE44_API_KEY,
      'x-api-key': BASE44_API_KEY,
      'Authorization': `Bearer ${BASE44_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  console.log(`[${path}] status: ${res.status}, body: ${text.substring(0, 300)}`);
  if (!res.ok) throw new Error(`Status ${res.status}: ${text}`);
  return JSON.parse(text);
}

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => res.json({ 
  status: 'Speed Técnico API rodando!', 
  key: BASE44_API_KEY ? `configurada (${BASE44_API_KEY.substring(0,8)}...)` : 'AUSENTE' 
}));

// LOGIN
app.post('/tecnico/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    console.log('Login attempt:', email);
    if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatórios' });

    const q = encodeURIComponent(JSON.stringify({ user_email: email.toLowerCase().trim() }));
    const data = await base44Fetch(`/entities/UsuariosApp?query=${q}&limit=10`);
    const users = data.entities || [];
    console.log('Users found:', users.length);

    if (users.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });
    const user = users[0];
    if (!user.senha_app) return res.status(401).json({ error: 'Senha não cadastrada. Fale com o supervisor.' });
    if (user.senha_app !== senha) return res.status(401).json({ error: 'Senha incorreta' });

    res.json({ success: true, user: { id: user.id, name: user.nome, email: user.user_email, role: user.tipo_usuario } });
  } catch(e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// BUSCAR ORDENS
app.get('/tecnico/ordens', async (req, res) => {
  try {
    const { email, role } = req.query;
    let path;
    if (role === 'gestor') {
      path = `/entities/ServiceOrder?limit=200&sort=-created_date`;
    } else {
      const q = encodeURIComponent(JSON.stringify({ assigned_technician_email: email }));
      path = `/entities/ServiceOrder?query=${q}&limit=200&sort=-created_date`;
    }
    const data = await base44Fetch(path);
    res.json({ entities: data.entities || data || [] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ATUALIZAR ORDEM
app.put('/tecnico/ordens/:id', async (req, res) => {
  try {
    const data = await base44Fetch(`/entities/ServiceOrder/${req.params.id}`, {
      method: 'PUT',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
