require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// AJUSTE DE SEGURANÇA:
// Se as variáveis estiverem vazias, o servidor não deve tentar criar o cliente, 
// pois isso causará o erro "supabaseUrl is required".
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Supabase conectado com sucesso!");
} else {
    console.error("❌ ERRO: Variáveis SUPABASE_URL ou SUPABASE_KEY não encontradas no ambiente!");
}

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Rota 1: Gerar
app.post('/api/generate', async (req, res) => {
  try {
    const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-2-pro/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao conectar com a Replicate' });
  }
});

// Rota 2: Status
app.get('/api/status/:id', async (req, res) => {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${req.params.id}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
});

// Rota 3: Descontar Crédito
app.post('/descontar-credito', async (req, res) => {
  if (!supabase) return res.status(500).json({ erro: 'Banco de dados não conectado' });
  
  const { userId } = req.body; 
  if (!userId) return res.status(400).json({ erro: 'ID do usuário é obrigatório' });

  const { data: usuario, error: erroBusca } = await supabase
    .from('users') 
    .select('creditos')
    .eq('id', userId)
    .single();

  if (erroBusca || !usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  if (usuario.creditos <= 0) return res.status(403).json({ erro: 'Créditos insuficientes!' });

  const { error: erroUpdate } = await supabase
    .from('users')
    .update({ creditos: usuario.creditos - 1 })
    .eq('id', userId);

  if (erroUpdate) return res.status(500).json({ erro: 'Erro ao atualizar banco' });

  res.json({ mensagem: 'Sucesso!', creditosRestantes: usuario.creditos - 1 });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));