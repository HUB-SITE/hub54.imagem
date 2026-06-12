import React, { useState, useRef, useEffect } from 'react';
import { Download, Play, RotateCcw, AlertTriangle, Loader2, Image as ImageIcon, PlusSquare, CreditCard } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from "@clerk/clerk-react";

export default function App() {
  const { userId } = useAuth();
  
  // Estados Principais
  const [activeTab, setActiveTab] = useState('gerar');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [inputImage, setInputImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progressText, setProgressText] = useState('');
  const [generationTime, setGenerationTime] = useState(null);
  
  // Estados do Histórico
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // 1. Efeito de Rede Neural no Fundo Animado
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 1.5;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx;
        if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
      }
    }

    for (let i = 0; i < 100; i++) particles.push(new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 - dist/500})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // 2. Carregar o Histórico da Base de Dados
  useEffect(() => {
    if (activeTab === 'historico' && userId) {
      fetchHistory();
    }
  }, [activeTab, userId]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`https://backend-gerador-ia.onrender.com/api/history/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 3. Funções Utilitárias (Upload e Conversão Base64)
  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setInputImage(e.target.files[0]);
    }
  };

  const resetInputs = () => {
    setPrompt('');
    setInputImage(null);
    setGeneratedImage(null);
    setError(null);
    setGenerationTime(null);
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // 4. Lógica de Geração da Imagem (Atualizada com input_images e prompt_strength)
  const generateImage = async () => {
    if (!prompt) { setError('O campo prompt é obrigatório.'); return; }
    if (!userId) { setError('Tem de iniciar sessão para gerar imagens.'); return; }

    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    setProgressText('A preparar ficheiros...');
    const startTime = Date.now();

    try {
      const inputPayload = { prompt, aspect_ratio: aspectRatio };

      // Converte imagem para Base64 caso o utilizador tenha feito upload
      if (inputImage) {
        setProgressText('A processar imagem base...');
        const base64Image = await fileToBase64(inputImage);
        
        // CORREÇÃO CRÍTICA PARA O FLUX-2-PRO:
        inputPayload.input_images = [base64Image];
        inputPayload.prompt_strength = 0.75; 
      }

      setProgressText('A enviar para a IA...');

      const response = await fetch('https://backend-gerador-ia.onrender.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputPayload, userId }),
      });

      if (!response.ok) throw new Error(`Erro do servidor: ${response.status}`);
      let prediction = await response.json();
      setProgressText('A gerar imagem...');

      // Loop para verificar o estado da geração na Replicate
      while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const res = await fetch(`https://backend-gerador-ia.onrender.com/api/status/${prediction.id}?userId=${userId}`);
        prediction = await res.json();
      }
      
      if (prediction.status === 'succeeded') {
        const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        setGeneratedImage(outputUrl);
        setGenerationTime(((Date.now() - startTime) / 1000).toFixed(1));
      } else {
        throw new Error('Falha na geração da IA.');
      }
    } catch (err) { 
      setError(err.message); 
    } finally { 
      setLoading(false);
      setProgressText(''); 
    }
  };

  // 5. Função de Download
  const downloadImage = async (urlToDownload) => {
    const targetUrl = urlToDownload || generatedImage;
    if (!targetUrl) return;
    try {
      const response = await fetch(targetUrl);
      const blob = await response.blob();
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `hub-ia-54-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    } catch (error) {
      alert("Erro ao transferir a imagem.");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden flex relative">
      
      {/* BACKGROUND (Rede Neural) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* --- ECRÃ DE BOAS-VINDAS (Não logado) --- */}
      <SignedOut>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full px-4 gap-0">
          
          {/* Glass card container */}
          <div className="hub-landing-card animate-fadeIn">
            {/* The animated moving border */}
            <div className="hub-card-border-container" />
            
            <div className="relative z-10">
              {/* Top bar decorativo */}
              <div className="hub-card-topbar">
                <span className="hub-dot" />
                <span className="hub-dot" />
                <span className="hub-dot" />
                <span className="hub-topbar-label">HUB IA 54 — SISTEMA EM DESENVOLVIMENTO </span>
              </div>

              {/* Logo / Título principal */}
              <div className="hub-card-body">
                <div className="hub-logo-block">
                  <div className="hub-logo-badge">AI</div>
                  <div>
                    <h1 className="hub-title">HUB IA 54</h1>
                    <p className="hub-subtitle">Plataforma Focada em Inteligência Artificial</p>
                  </div>
                </div>

                {/* Divisor com neon */}
                <div className="hub-divider" />

                {/* Métricas / Features */}
                <div className="hub-features-row">
                  <div className="hub-feature-item">
                    <span className="hub-feature-icon">◈</span>
                    <span className="hub-feature-label">Geração de Imagens</span>
                  </div>
                  <div className="hub-feature-sep" />
                  <div className="hub-feature-item">
                    <span className="hub-feature-icon">◈</span>
                    <span className="hub-feature-label">Modelos Avançados</span>
                  </div>
                  <div className="hub-feature-sep" />
                  <div className="hub-feature-item">
                    <span className="hub-feature-icon">◈</span>
                    <span className="hub-feature-label">Histórico em Nuvem</span>
                  </div>
                </div>

                {/* Divisor */}
                <div className="hub-divider" />

                {/* Descrição */}
                <p className="hub-desc">
                 Ferramentas de criação visual com inteligência artificial de última geração. 
                 Resultados profissionais, interface limpa, sem distrações.
                </p>

                {/* Botão CTA */}
                <SignInButton mode="modal">
                  <button className="hub-cta-btn">
                    <span className="hub-cta-label">Acessar Plataforma</span>
                    <span className="hub-cta-arrow">→</span>
                  </button>
                </SignInButton>

                {/* Rodapé do card */}
                <p className="hub-card-footer">Acesso seguro · Dados encriptados by HUB IA </p>
              </div>
            </div>
          </div>
        </div>
      </SignedOut>

      {/* --- ÁREA DE MEMBROS (Logado) --- */}
      <SignedIn>
        
        {/* Ícone de perfil no canto superior direito */}
        <header className="fixed top-0 right-0 z-50 p-6">
          <UserButton />
        </header>

        {/* MENU LATERAL - Efeito Vidro Jateado */}
        <aside
          className="relative z-20 w-full md:w-64 h-screen border-r border-white/10 flex-col hidden md:flex"
          style={{
            backgroundColor: 'rgba(10, 10, 10, 0.55)',
            backdropFilter: 'blur(24px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
            boxShadow: '1px 0 0 rgba(255,255,255,0.06), 10px 0 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Logo lateral */}
          <div className="p-8 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="sidebar-logo-badge">AI</div>
              <div>
                <h1 className="text-sm font-black tracking-widest text-white uppercase">HUB IA 54</h1>
                <p className="text-xs text-white/50 tracking-widest mt-0.5 uppercase">Plataforma</p>
              </div>
            </div>
          </div>

          {/* Navegação */}
          <nav className="flex-1 p-5 space-y-2 mt-2">
            <p className="text-xs text-white/50 uppercase tracking-widest font-semibold mb-4 px-2">Navegação</p>
            
            <button
              onClick={() => setActiveTab('gerar')}
              className={`sidebar-nav-btn ${activeTab === 'gerar' ? 'sidebar-nav-active' : 'sidebar-nav-idle'}`}
            >
              <PlusSquare className="w-4 h-4 flex-shrink-0" />
              <span>Nova Geração</span>
            </button>

            <button
              onClick={() => setActiveTab('historico')}
              className={`sidebar-nav-btn ${activeTab === 'historico' ? 'sidebar-nav-active' : 'sidebar-nav-idle'}`}
            >
              <ImageIcon className="w-4 h-4 flex-shrink-0" />
              <span>Histórico</span>
            </button>
          </nav>

          {/* Saldo / Status */}
          <div className="p-5 border-t border-white/8">
            <div className="sidebar-status-card">
              <CreditCard className="w-4 h-4 text-white/60 flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-white/50 uppercase tracking-widest">Estado</span>
                <span className="text-xs font-bold text-white/90 mt-0.5 flex items-center gap-1.5">
                  <span className="status-dot" /> Ativo
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* CONTEÚDO CENTRAL */}
        <main className="relative z-10 flex-1 h-screen overflow-y-auto custom-scrollbar">
          
          {/* TELA 1: GERAR IMAGEM */}
          {activeTab === 'gerar' && (
            <div className="flex flex-col xl:flex-row min-h-screen">
              
              {/* PAINEL DE CONTROLO ESQUERDO */}
              <div
                className="w-full xl:w-[400px] p-8 space-y-6 border-r border-white/8 flex-shrink-0"
                style={{
                  backgroundColor: 'rgba(8, 8, 8, 0.5)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                {/* Cabeçalho do painel */}
                <div className="pb-2">
                  <p className="text-xs text-white/50 uppercase tracking-widest font-semibold mb-1">Estúdio</p>
                  <h2 className="text-2xl font-black text-white tracking-tight">Criar Imagem</h2>
                </div>

                {/* Prompt */}
                <div className="space-y-2">
                  <label className="panel-label">Prompt <span className="text-white/50">(obrigatório)</span></label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="panel-textarea"
                    placeholder="Descreva o cenário em detalhe..."
                    rows={4}
                  />
                </div>

                {/* Upload de imagem base */}
                <div className="space-y-2">
                  <label className="panel-label">Imagem Base <span className="text-white/50">(opcional)</span></label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`panel-upload-zone ${inputImage ? 'panel-upload-success' : ''}`}
                  >
                    {inputImage ? (
                      <div className="flex items-center gap-2 text-white/80">
                        <span className="text-xs font-semibold uppercase tracking-wider">✓ Imagem carregada</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <ImageIcon className="w-5 h-5 text-white/40" />
                        <span className="text-xs text-white/50">Clique ou arraste uma imagem</span>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>

                {/* Proporção */}
                <div className="space-y-2">
                  <label className="panel-label">Proporção</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="panel-select"
                  >
                    <option value="1:1">1:1 — Quadrado</option>
                    <option value="16:9">16:9 — Paisagem</option>
                    <option value="9:16">9:16 — Stories / Reels</option>
                  </select>
                </div>

                {/* Divisor */}
                <div className="border-t border-white/8 pt-6 space-y-3">
                  {/* Ações */}
                  <div className="flex gap-3">
                    <button
                      onClick={resetInputs}
                      disabled={loading}
                      className="panel-btn-secondary"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Limpar</span>
                    </button>
                    <button
                      onClick={generateImage}
                      disabled={loading || !prompt}
                      className="panel-btn-primary"
                    >
                      {loading
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>A processar...</span></>
                        : <><Play className="w-3.5 h-3.5" /><span>Gerar</span></>
                      }
                    </button>
                  </div>

                  {/* Erro */}
                  {error && (
                    <div className="panel-error">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>{error}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ÁREA DA IMAGEM DIREITA */}
              <div className="flex-1 flex flex-col items-center justify-center p-8 relative min-h-[500px]">
                {loading ? (
                  <div className="text-center space-y-6 flex flex-col items-center">
                    <div className="loading-spinner" />
                    <p className="text-white/50 text-sm font-light tracking-widest uppercase animate-pulse">{progressText}</p>
                  </div>
                ) : generatedImage ? (
                  <div className="w-full max-w-3xl space-y-5">
                    <div className="relative group flex justify-center">
                      <img
                        src={generatedImage}
                        alt="Gerado pela IA"
                        className="w-full max-h-[65vh] object-contain rounded-lg"
                        style={{ boxShadow: '0 0 60px rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.08)' }}
                      />
                    </div>
                    <div
                      className="flex items-center justify-between p-4 rounded-lg border border-white/10"
                      style={{ backgroundColor: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}
                    >
                      <div className="text-sm text-white/50 font-light">
                        Gerado em <strong className="text-white/90 font-semibold">{generationTime}s</strong>
                      </div>
                      <button
                        onClick={() => downloadImage()}
                        className="result-download-btn"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Transferir</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-5 flex flex-col items-center opacity-70">
                    <div className="empty-state-icon relative">
                      <span className="text-3xl font-black text-transparent bg-clip-text animate-pulse"
                            style={{
                              WebkitTextStroke: '1.5px rgba(255, 255, 255, 0.9)',
                              textShadow: '0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.6), 0 0 30px #fff'
                            }}>
                        H
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-light text-white/80 tracking-wide">A sua imagem aparecerá aqui</p>
                      <p className="text-sm text-white/50 mt-1 font-light">Configure o prompt e clique em Gerar</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TELA 2: HISTÓRICO DE IMAGENS */}
          {activeTab === 'historico' && (
            <div className="p-8 md:p-10 min-h-screen">
              <div className="mb-10">
                <p className="text-xs text-white/50 uppercase tracking-widest font-semibold mb-1">Arquivo</p>
                <h2 className="text-2xl font-black text-white tracking-tight">O Meu Histórico</h2>
                <p className="text-white/60 mt-1 text-sm font-light">Todas as criações guardadas na nuvem.</p>
              </div>
              
              {loadingHistory ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-white/50" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4 opacity-70">
                  <div className="empty-state-icon">
                    <ImageIcon className="w-8 h-8 text-white/40" />
                  </div>
                  <p className="text-white/60 text-sm font-light tracking-wide">Nenhuma imagem gerada ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="history-card group"
                    >
                      <div className="aspect-square w-full bg-black relative overflow-hidden">
                        <img
                          src={item.image_url}
                          alt={item.prompt}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        
                        {/* Camada Hover */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4"
                          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)', backdropFilter: 'blur(2px)' }}>
                          <p className="text-xs text-white/90 line-clamp-3 font-light tracking-wide mb-3 leading-relaxed">"{item.prompt}"</p>
                          <button
                            onClick={() => downloadImage(item.image_url)}
                            className="history-download-btn"
                          >
                            <Download className="w-3 h-3" />
                            <span>Transferir</span>
                          </button>
                        </div>
                      </div>
                      <div className="px-4 py-3 border-t border-white/6">
                        <p className="text-xs text-white/50 truncate font-light leading-relaxed">"{item.prompt}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </SignedIn>

      {/* ESTILOS GLOBAIS */}
      <style>{`
        /* ========== ANIMAÇÕES ========== */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ========== SCROLLBAR ========== */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }

        /* ========== LANDING CARD ========== */
        .hub-landing-card {
          width: 100%;
          max-width: 520px;
          background: rgba(12, 12, 12, 0.72);
          backdrop-filter: blur(32px) saturate(1.4);
          -webkit-backdrop-filter: blur(32px) saturate(1.4);
          border: 1px solid rgba(255,255,255,0.05); /* diminished slightly since animated border covers it mostly */
          border-radius: 16px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 32px 80px rgba(0,0,0,0.8),
            0 0 60px rgba(255,255,255,0.03);
          position: relative;
        }

        /* LIGHT BORDER TRAVELLING EFFECT */
        .hub-card-border-container {
           position: absolute;
           inset: 0;
           border-radius: 16px;
           overflow: hidden;
           pointer-events: none;
           padding: 1.5px;
           -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
           -webkit-mask-composite: xor;
           mask-composite: exclude;
           z-index: 20;
        }
        .hub-card-border-container::before {
           content: "";
           position: absolute;
           top: -50%; left: -50%;
           width: 200%; height: 200%;
           background: conic-gradient(transparent 250deg, rgba(255,255,255,0.9) 360deg);
           animation: spin 3.5s linear infinite;
        }

        .hub-card-topbar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
        }
        .hub-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,0.12);
        }
        .hub-topbar-label {
          margin-left: 8px;
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.50);
          font-weight: 600;
        }

        .hub-card-body {
          padding: 40px 40px 32px;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .hub-logo-block {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
        }
        .hub-logo-badge {
          width: 48px; height: 48px;
          border-radius: 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 900; letter-spacing: 0.05em;
          color: rgba(255,255,255,0.85);
          box-shadow: 0 0 18px rgba(255,255,255,0.06) inset;
          flex-shrink: 0;
        }
        .hub-title {
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #ffffff;
          line-height: 1;
        }
        .hub-subtitle {
          font-size: 12px;
          color: rgba(255,255,255,0.80);
          margin-top: 5px;
          letter-spacing: 0.04em;
          font-weight: 400;
        }

        .hub-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent);
          margin: 20px 0;
        }

        .hub-features-row {
          display: flex;
          align-items: center;
          gap: 0;
          margin: 0;
        }
        .hub-feature-item {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
        }
        .hub-feature-icon {
          font-size: 9px;
          color: rgba(255,255,255,0.40);
        }
        .hub-feature-label {
          font-size: 10.5px;
          color: rgba(255,255,255,0.85);
          letter-spacing: 0.02em;
          font-weight: 500;
        }
        .hub-feature-sep {
          width: 1px; height: 20px;
          background: rgba(255,255,255,0.08);
          margin: 0 12px;
          flex-shrink: 0;
        }

        .hub-desc {
          font-size: 13.5px;
          color: rgba(255,255,255,0.80);
          line-height: 1.65;
          font-weight: 300;
          margin-top: 4px;
          margin-bottom: 28px;
        }

        /* CTA Button */
        .hub-cta-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 15px 22px;
          background: rgba(255,255,255,0.96);
          color: #000;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 0 30px rgba(255,255,255,0.12), 0 4px 20px rgba(0,0,0,0.4);
        }
        .hub-cta-btn:hover {
          background: #fff;
          box-shadow: 0 0 50px rgba(255,255,255,0.22), 0 8px 32px rgba(0,0,0,0.5);
          transform: translateY(-1px);
        }
        .hub-cta-label { letter-spacing: 0.1em; }
        .hub-cta-arrow { font-size: 16px; font-weight: 300; }

        .hub-card-footer {
          font-size: 10px;
          color: rgba(255,255,255,0.70);
          text-align: center;
          margin-top: 20px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        /* ========== SIDEBAR ========== */
        .sidebar-logo-badge {
          width: 34px; height: 34px;
          border-radius: 8px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 900;
          color: rgba(255,255,255,0.7);
          letter-spacing: 0.05em;
        }
        .sidebar-nav-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
        }
        .sidebar-nav-active {
          background: rgba(255,255,255,0.10);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.15);
          box-shadow: 0 0 20px rgba(255,255,255,0.04) inset;
        }
        .sidebar-nav-idle {
          background: transparent;
          color: rgba(255,255,255,0.55);
        }
        .sidebar-nav-idle:hover {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.85);
        }
        .sidebar-status-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
        }
        .status-dot {
          display: inline-block;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: rgba(255,255,255,0.8);
        }

        /* ========== PAINEL DE CONTROLO ========== */
        .panel-label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.65);
        }
        .panel-textarea {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 8px;
          padding: 14px;
          color: #fff;
          font-size: 13px;
          font-weight: 300;
          line-height: 1.6;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
        }
        .panel-textarea::placeholder { color: rgba(255,255,255,0.30); }
        .panel-textarea:focus { border-color: rgba(255,255,255,0.40); background: rgba(255,255,255,0.06); }

        .panel-upload-zone {
          width: 100%;
          border: 1px dashed rgba(255,255,255,0.20);
          border-radius: 8px;
          padding: 22px;
          text-align: center;
          cursor: pointer;
          background: rgba(255,255,255,0.02);
          transition: all 0.2s ease;
        }
        .panel-upload-zone:hover {
          border-color: rgba(255,255,255,0.40);
          background: rgba(255,255,255,0.06);
        }
        .panel-upload-success {
          border-color: rgba(255,255,255,0.40);
          border-style: solid;
          background: rgba(255,255,255,0.05);
        }

        .panel-select {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 8px;
          padding: 11px 14px;
          color: #fff;
          font-size: 13px;
          font-weight: 400;
          outline: none;
          transition: border-color 0.2s;
          cursor: pointer;
        }
        .panel-select:focus { border-color: rgba(255,255,255,0.40); }
        .panel-select option { background: #111; }

        .panel-btn-secondary {
          flex: 1;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 11px 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background: transparent;
          color: rgba(255,255,255,0.70);
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
        }
        .panel-btn-secondary:hover:not(:disabled) {
          border-color: rgba(255,255,255,0.40);
          color: #fff;
        }
        .panel-btn-secondary:disabled { opacity: 0.3; cursor: not-allowed; }

        .panel-btn-primary {
          flex: 2;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 11px 14px;
          background: rgba(255,255,255,0.95);
          color: #000;
          border: none;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 0 24px rgba(255,255,255,0.14);
        }
        .panel-btn-primary:hover:not(:disabled) {
          background: #fff;
          box-shadow: 0 0 36px rgba(255,255,255,0.22);
          transform: translateY(-1px);
        }
        .panel-btn-primary:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

        .panel-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          color: rgba(255,255,255,0.75);
          font-size: 12px;
          line-height: 1.5;
        }

        /* ========== LOADING SPINNER ========== */
        .loading-spinner {
          width: 44px; height: 44px;
          border: 1px solid rgba(255,255,255,0.10);
          border-top-color: rgba(255,255,255,0.70);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* ========== EMPTY STATE ========== */
        .empty-state-icon {
          width: 80px; height: 80px;
          border: 1px dashed rgba(255,255,255,0.20);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.04);
        }

        /* ========== RESULT DOWNLOAD ========== */
        .result-download-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 18px;
          border: 1px solid rgba(255,255,255,0.14);
          background: transparent;
          color: rgba(255,255,255,0.80);
          border-radius: 7px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
        }
        .result-download-btn:hover {
          border-color: rgba(255,255,255,0.50);
          color: #fff;
          background: rgba(255,255,255,0.08);
        }

        /* ========== HISTORY CARD ========== */
        .history-card {
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.02);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .history-card:hover {
          border-color: rgba(255,255,255,0.25);
          box-shadow: 0 8px 40px rgba(0,0,0,0.5);
        }

        .history-download-btn {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 9px;
          background: rgba(255,255,255,0.92);
          color: #000;
          border: none;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s;
        }
        .history-download-btn:hover { background: #fff; }

        /* ========== RESPONSIVIDADE MOBILE ========== */
        @media (max-width: 768px) {
          .hub-card-body { padding: 28px 24px 24px; }
          .hub-title { font-size: 22px; }
          .hub-features-row { flex-wrap: wrap; gap: 8px; }
          .hub-feature-sep { display: none; }
        }
      `}</style>
    </div>
  );
}
