require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Webhook } = require('svix'); // <--- Importação da biblioteca de segurança

const app = express();
app.use(cors());

// =========================================================================
// ⚠️ ROTA DO WEBHOOK: PRECISA FICAR AQUI, ANTES DO express.json()
// O Svix precisa do corpo "cru" (raw) para validar a assinatura do Clerk.
// =========================================================================
app.post('/api/webhook/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!CLERK_WEBHOOK_SECRET) {
      console.error("❌ CLERK_WEBHOOK_SECRET não configurado no .env ou Render");
      return res.status(500).json({ error: "Erro interno do servidor" });
    }

    const payload = req.body; // Pega o body em formato 'raw'
    const headers = req.headers; // Pega os cabeçalhos do Clerk

    const wh = new Webhook(CLERK_WEBHOOK_SECRET);
    let evt;

    try {
      // Tenta bater a assinatura que chegou com a sua chave do Render
      evt = wh.verify(payload, headers);
    } catch (err) {
      console.error("❌ Erro de assinatura do Clerk:", err.message);
      return res.status(400).json({ error: "Assinatura inválida" });
    }

    // Se a assinatura for válida e o evento for de "usuário criado"
    if (evt.type === 'user.created') {
      const { id, email_addresses } = evt.data;
      const email = email_addresses && email_addresses.length > 0 ? email_addresses[0].email_address : '';

      // Insere no Supabase com 10 créditos
      const { error } = await supabase
        .from('users')
        .insert([
          { id: id, email: email, creditos: 10, is_admin: false }
        ]);

      if (error) {
        console.error("⚠️ Erro ao salvar usuário no banco (provavelmente já existe):", error);
      } else {
        console.log(`✅ Novo usuário salvo com sucesso via Webhook! ID: ${id}`);
      }
    }

    // Responde ao Clerk que deu tudo certo para ele parar de tentar enviar
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Erro interno no webhook:", err);
    return res.status(500).send('Erro interno');
  }
});

// =========================================================================
// MIDDLEWARE GLOBAL PARA AS OUTRAS ROTAS (Geração de Imagens, etc)
// =========================================================================
app.use(express.json({ limit: '50mb' }));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Supabase conectado com sucesso!");
} else {
    console.error("❌ ERRO: Variáveis SUPABASE_URL ou SUPABASE_KEY não encontradas!");
}

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Rota 1: Gerar Imagem com trava de créditos
app.post('/api/generate', async (req, res) => {
  try {
    const { input, userId } = req.body; 

    if (!userId) return res.status(400).json({ error: 'A identificação do usuário é obrigatória.' });
    if (!supabase) return res.status(500).json({ error: 'Banco de dados não conectado.' });

    // 1. Procura o usuário
    const { data: usuario, error: erroBusca } = await supabase
      .from('users') 
      .select('creditos, is_admin')
      .eq('id', userId)
      .single();

    if (erroBusca || !usuario) return res.status(404).json({ error: 'Usuário não localizado.' });

    // 2. Trava de Segurança
    if (usuario.is_admin !== true) {
      if (usuario.creditos <= 0) {
        return res.status(403).json({ error: 'Créditos insuficientes! Adquira mais créditos.' });
      }

      // Desconta o crédito
      const NovoSaldo = usuario.creditos - 1;
      const { error: erroAtualizacao } = await supabase
        .from('users')
        .update({ creditos: NovoSaldo })
        .eq('id', userId);

      if (erroAtualizacao) return res.status(500).json({ error: 'Erro ao atualizar saldo.' });
    }

    // 3. Chama a API Paga (Replicate)
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

// Rota 2: Verificar Status da Imagem
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

// Inicia o Servidor
app.listen(3000, () => console.log('🚀 Servidor rodando na porta 3000'));
