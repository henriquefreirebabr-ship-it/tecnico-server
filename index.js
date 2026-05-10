const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const BASE44_API_KEY = process.env.BASE44_API_KEY || '';
const APP_ID = '69ecdce9d344ba3f09910fa1';
const BASE44_URL = `https://api.base44.com/api/apps/${APP_ID}`;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/', (req, res) => res.json({ status: 'Speed Técnico API rodando!' }));

// LOGIN DO TÉCNICO
app.post('/tecnico/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ error: 'Email e senha obrigatórios' });

    const q = encodeURIComponent(JSON.stringify({ user_email: email.toLowerCase().trim(), ativo: true }));
    const response = await fetch(`${BASE44_URL}/entities/UsuariosApp?query=${q}`, {
      headers: { 'x-api-key': BASE44_API_KEY }
    });

    if (!response.ok) throw new Error('Erro ao buscar usuário: ' + response.status);
    const data = await response.json();
    const users = data.entities || [];

    if (users.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });
    const user = users[0];
    if (!user.senha_app) return res.status(401).json({ error: 'Senha não cadastrada. Fale com o supervisor.' });
    if (user.senha_app !== senha) return res.status(401).json({ error: 'Senha incorreta' });

    res.json({ 
      success: true, 
      user: { id: user.id, name: user.nome, email: user.user_email, role: user.tipo_usuario, phone: user.telefone }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// BUSCAR ORDENS DO TÉCNICO
app.get('/tecnico/ordens', async (req, res) => {
  try {
    const { email, role } = req.query;
    let url;
    if (role === 'gestor') {
      url = `${BASE44_URL}/entities/ServiceOrder?limit=200&sort=-created_date`;
    } else {
      const q = encodeURIComponent(JSON.stringify({ assigned_technician_email: email }));
      url = `${BASE44_URL}/entities/ServiceOrder?query=${q}&limit=200&sort=-created_date`;
    }
    const response = await fetch(url, { headers: { 'x-api-key': BASE44_API_KEY } });
    if (!response.ok) throw new Error('Erro ao buscar ordens: ' + response.status);
    const data = await response.json();
    res.json({ entities: data.entities || data || [] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ATUALIZAR ORDEM
app.put('/tecnico/ordens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const response = await fetch(`${BASE44_URL}/entities/ServiceOrder/${id}`, {
      method: 'PUT',
      headers: { 'x-api-key': BASE44_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Erro ao atualizar: ' + response.status);
    const data = await response.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
