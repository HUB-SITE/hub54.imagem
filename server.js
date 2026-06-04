const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Permite que o seu React (porta 3000) converse com este servidor (porta 3001)
app.use(cors());

// Permite receber imagens em base64 (aumentamos o limite para 50mb)
app.use(express.json({ limit: '50mb' })); 

// Sua chave da Replicate deve estar no arquivo .env na raiz do projeto
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Rota 1: Iniciar a geração da imagem
app.post('/api/generate', async (req, res) => {
  try {
    // Substitua apenas esta linha no seu server.js
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

// Rota 2: Verificar se a imagem já ficou pronta (Polling)
app.get('/api/status/:id', async (req, res) => {
  try {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${req.params.id}`, {
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      },
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor intermediário rodando na porta ${PORT}`));