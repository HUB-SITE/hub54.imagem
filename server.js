require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Webhook } = require('svix');
const path = require('path');

const app = express();

app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 1. INICIALIZA O BANCO DE DADOS PRIMEIRO
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// 2. WEBHOOK CLERK (TEM QUE VIR ANTES DO EXPRESS.JSON)
app.post('/api/webhook/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log("📨 Webhook recebido do Clerk!");
  try {
    const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
    // Verifica a assinatura com o texto bruto
    const evt = wh.verify(req.body, req.headers);

    console.log("✅ Assinatura verificada! Evento:", evt.type);

    if (evt.type === 'user.created') {
      const { id, email_addresses } = evt.data;
      const email = email_addresses[0].email_address;
      
      console.log(`💾 Salvando usuário no Supabase: ${email}`);

      const { error } = await supabase.from('users').insert([
        { id: id, email: email, creditos: 10, is_admin: false }
      ]);

      if (error) console.error("❌ Erro no Supabase:", error);
      else console.log("🎉 Usuário salvo com sucesso!");
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Erro na assinatura do Webhook:", err.message);
    return res.status(400).json({ error: "Webhook inválido" });
  }
});

// 3. AGORA SIM, HABILITA O JSON PARA O RESTO DO SITE (GERAÇÃO DE IMAGENS)
app.use(express.json({ limit: '50mb' })); 

// 4. ROTA DE GERAÇÃO
app.post('/api/generate', async (req, res) => {
  try {
    const { input, userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Usuário não identificado.' });

    const { data: usuario, error: erroBusca } = await supabase
      .from('users')
      .select('creditos, is_admin')
      .eq('id', userId)
      .single();

    if (erroBusca || !usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    if (!usuario.is_admin && usuario.creditos <= 0) {
      return res.status(403).json({ error: 'Créditos insuficientes!' });
    }

    if (!usuario.is_admin) {
      await supabase.from('users').update({ creditos: usuario.creditos - 1 }).eq('id', userId);
    }

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

// 5. ROTA DE STATUS
app.get('/api/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { 
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao consultar status.' });
  }
});

// 6. ESTATÍSTICOS E REACT
app.use(express.static(path.join(__dirname, 'build')));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
