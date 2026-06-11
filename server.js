require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Webhook } = require('svix');
const path = require('path');

const app = express();

app.use(cors({
  origin: '*', // Se preferir segurança extra, substitua '*' pela URL da sua Vercel
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); 

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// 1. WEBHOOK CLERK
app.post('/api/webhook/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
    const evt = wh.verify(req.body, req.headers);

    if (evt.type === 'user.created') {
      const { id, email_addresses } = evt.data;
      await supabase.from('users').insert([{ id, email: email_addresses[0].email_address, creditos: 10, is_admin: false }]);
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: "Webhook inválido" });
  }
});

// 2. ROTA DE GERAÇÃO (Preenchida)
app.post('/api/generate', async (req, res) => {
  try {
    const { input, userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Usuário não identificado.' });

    // Busca usuário e créditos
    const { data: usuario, error: erroBusca } = await supabase
      .from('users')
      .select('creditos, is_admin')
      .eq('id', userId)
      .single();

    if (erroBusca || !usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    // Verifica créditos (se não for admin)
    if (!usuario.is_admin && usuario.creditos <= 0) {
      return res.status(403).json({ error: 'Créditos insuficientes!' });
    }

    // Desconta crédito
    if (!usuario.is_admin) {
      await supabase.from('users').update({ creditos: usuario.creditos - 1 }).eq('id', userId);
    }

    // Chama IA
    const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-2-pro/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
      body: JSON.stringify({ input }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Falha no processamento.' });
  }
});

// 3. ESTATÍSTICOS
// 1. Servir arquivos estáticos (JS, CSS, imagens)
app.use(express.static(path.join(__dirname, 'build')));

// 2. Middleware de Roteamento EXCLUSIVO para o React
app.use((req, res, next) => {
  // Se a rota começa com /api, ignora este middleware e deixa a rota ser processada normalmente
  if (req.path.startsWith('/api')) {
    return next();
  }
  // Caso contrário, entrega o index.html
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// ESCUTA COM TRATAMENTO DE ERRO
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
