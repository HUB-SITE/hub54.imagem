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

// Rota 1: Gerar (Substituindo a antiga com a trava de segurança profissional)
app.post('/api/generate', async (req, res) => {
  try {
    const { input, userId } = req.body; 

    if (!userId) {
      return res.status(400).json({ error: 'A identificação do usuário é obrigatória.' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Banco de dados não conectado no servidor.' });
    }

    // 1. Procurar os créditos e o estatuto do usuário no Supabase
    const { data: usuario, error: erroBusca } = await supabase
      .from('users') 
      .select('creditos, is_admin')
      .eq('id', userId)
      .single();

    if (erroBusca || !usuario) {
      return res.status(404).json({ error: 'Usuário não localizado na base de dados.' });
    }

    // 2. A Regra do "Admin" e Bloqueio de Créditos
    if (usuario.is_admin !== true) {
      // Se NÃO for administrador, validamos os créditos
      if (usuario.creditos <= 0) {
        return res.status(403).json({ error: 'Créditos insuficientes! Adquira mais créditos para continuar.' });
      }

      // Se tiver créditos, descontamos 1
      const NovoSaldo = usuario.creditos - 1;
      const { error: erroAtualizacao } = await supabase
        .from('users')
        .update({ creditos: NovoSaldo })
        .eq('id', userId);

      if (erroAtualizacao) {
        return res.status(500).json({ error: 'Erro ao atualizar o saldo de créditos.' });
      }
    }

    // 3. Se tudo estiver válido, chama a API do Replicate
    const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-2-pro/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({ input }),
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Falha interna no servidor.' });
  }
});

// Rota 2: Verificar Status (Mantendo a que você já tinha)
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

// Rota 3: Webhook do Clerk (Para salvar automaticamente os novos clientes que criarem conta)
app.post('/api/webhook/clerk', async (req, res) => {
  try {
    const { data } = req.body;
    const userId = data.id;
    const email = data.email_addresses[0]?.email_address;

    if (!userId) return res.status(400).send('No user ID');

    // Insere o usuário automaticamente com 10 créditos iniciais de presente
    const { error } = await supabase
      .from('users')
      .insert([
        { id: userId, email_cadastro: email, creditos: 10, is_admin: false }
      ]);

    if (error) {
      console.error("Erro ao salvar usuário via Webhook:", error);
      return res.status(500).json(error);
    }

    return res.status(200).send('Usuário salvo com sucesso!');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Erro interno');
  }
});

// Rota antiga de teste (Opcional, mantida por segurança)
app.post('/descontar-credito', async (req, res) => {
  const { userId } = req.body; 
  if (!userId) return res.status(400).json({ erro: 'ID do usuário é obrigatório' });

  const { data: usuario, error: erroBusca } = await supabase
    .from('users') 
    .select('creditos')
    .eq('id', userId)
    .single();

  if (erroBusca || !usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });
  if (usuario.creditos <= 0) return res.status(403).json({ erro: 'Créditos insuficientes!' });

  const novoCredito = usuario.creditos - 1;
  const { error: erroUpdate } = await supabase
    .from('users')
    .update({ creditos: novoCredito })
    .eq('id', userId);

  if (erroUpdate) return res.status(500).json({ erro: 'Erro ao atualizar créditos' });
  return res.json({ sucesso: true, creditosRestantes: novoCredito });
});

// Inicialização do Servidor (Última linha)
app.listen(3000, () => console.log('🚀 Servidor rodando na porta 3000'));
