import React, { useState, useRef, useEffect } from 'react';
import { Download, Play, RotateCcw, AlertTriangle, Loader2, Image as ImageIcon, PlusSquare, CreditCard, Network, ChevronRight } from 'lucide-react';
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
        ctx.fillStyle = 'rgba(78, 201, 176, 0.6)'; // Neon teal
        ctx.fill();
      }
    }

    for (let i = 0; i < 90; i++) particles.push(new Particle());

    const animate = () => {
      // Fundo semi-transparente para dar efeito de rastro
      ctx.fillStyle = 'rgba(5, 5, 5, 1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(78, 201, 176, ${(1 - dist/120) * 0.25})`;
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

  // 4. Lógica de Geração da Imagem
  const generateImage = async () => {
    if (!prompt) { setError('O campo prompt é obrigatório.'); return; }
    if (!userId) { setError('Tem de iniciar sessão para gerar imagens.'); return; }

    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    setProgressText('Preparando contexto matricial...');
    const startTime = Date.now();

    try {
      const inputPayload = { prompt, aspect_ratio: aspectRatio };

      // Converte imagem para Base64 caso o utilizador tenha feito upload
      if (inputImage) {
        setProgressText('Processando imagem de referência...');
        const base64Image = await fileToBase64(inputImage);
        inputPayload.input_images = [base64Image];
        inputPayload.prompt_strength = 0.75; 
      }

      setProgressText('Conectando ao núcleo neural...');

      const response = await fetch('https://backend-gerador-ia.onrender.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputPayload, userId }),
      });

      if (!response.ok) throw new Error(`Erro de sincronização: ${response.status}`);
      let prediction = await response.json();
      setProgressText('Sintetizando os parâmetros visuais...');

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
        throw new Error('O modelo não conseguiu concluir a síntese.');
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
        link.download = `hub-ia-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    } catch (error) {
      alert("Erro de comunicação ao recuperar o arquivo original.");
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans overflow-hidden flex relative selection:bg-teal-500/30">
      
      {/* BACKGROUND (Rede Neural) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* --- ECRÃ DE BOAS-VINDAS (Não logado) --- */}
      <SignedOut>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full px-4">
          <div className="max-w-3xl w-full flex flex-col items-center justify-center p-10 md:p-16 rounded-3xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] shadow-[0_0_80px_-20px_rgba(78,201,176,0.15)] relative transition-all">
            {/* Vidro Interno */}
            <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/[0.03] pointer-events-none" />
            
            {/* Linha Neon */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            <div className="text-center space-y-6 mb-12 animate-fadeIn">
              <div className="mx-auto flex items-center justify-center w-20 h-20 rounded-2xl bg-teal-500/5 border border-teal-500/20 text-teal-400 shadow-[0_0_30px_rgba(78,201,176,0.15)]">
                <Network className="w-10 h-10" />
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white m-0 drop-shadow-2xl">
                HUB IA <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300 drop-shadow-[0_0_15px_rgba(78,201,176,0.5)]">54</span>
              </h1>
              <p className="text-slate-400 font-light max-w-lg mx-auto leading-relaxed text-sm md:text-lg">
                Plataforma corporativa avançada para síntese visual estruturada. Conecte processamento de alta performance e automação inteligente.
              </p>
            </div>

            <SignInButton mode="modal">
              <button className="group relative px-10 py-4.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/40 text-teal-300 rounded-full font-medium tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(78,201,176,0.15)] hover:shadow-[0_0_40px_rgba(78,201,176,0.3)] w-full sm:w-auto cursor-pointer">
                <span className="relative z-10 flex items-center gap-2 text-sm">
                  Acessar Plataforma
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-teal-400/0 via-teal-400/10 to-teal-400/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      {/* --- ÁREA DE MEMBROS (Logado) --- */}
      <SignedIn>
        {/* Header de Perfil */}
        <header className="fixed top-0 right-0 z-50 p-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-full p-1 shadow-2xl flex items-center justify-center">
            <UserButton appearance={{ elements: { avatarBox: "w-10 h-10 border border-teal-500/30" } }} />
          </div>
        </header>

        {/* MENU LATERAL - Estilo Profissional Glass */}
        <aside className="relative z-20 w-full md:w-64 h-screen border-r border-white/5 flex flex-col hidden md:flex bg-black/50 backdrop-blur-2xl">
          <div className="p-8 border-b border-white/5 flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 rounded-lg border border-teal-500/20">
              <Network className="w-6 h-6 text-teal-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">HUB IA <span className="text-teal-400">54</span></h1>
          </div>

          <nav className="flex-1 px-4 py-8 space-y-2">
            <button 
              onClick={() => setActiveTab('gerar')} 
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-medium text-sm ${activeTab === 'gerar' ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20 shadow-[0_0_20px_rgba(78,201,176,0.1)]' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent cursor-pointer'}`}
            >
              <PlusSquare className={`w-4 h-4 ${activeTab === 'gerar' ? 'text-teal-400' : 'text-slate-500'}`} /> 
              Terminal de Síntese
            </button>

            <button 
              onClick={() => setActiveTab('historico')} 
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-medium text-sm ${activeTab === 'historico' ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20 shadow-[0_0_20px_rgba(78,201,176,0.1)]' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent cursor-pointer'}`}
            >
              <ImageIcon className={`w-4 h-4 ${activeTab === 'historico' ? 'text-teal-400' : 'text-slate-500'}`} /> 
              Arquivo Neural
            </button>
          </nav>

          <div className="p-6 border-t border-white/5">
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center gap-3 shadow-inner">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Status Node</span>
                <span className="text-sm font-medium text-slate-300">Conectado</span> 
              </div>
            </div>
          </div>
        </aside>

        {/* CONTEÚDO CENTRAL */}
        <main className="relative z-10 flex-1 h-screen overflow-y-auto custom-scrollbar bg-gradient-to-br from-transparent to-black/70">
          
          {/* TELA 1: GERAR IMAGEM */}
          {activeTab === 'gerar' && (
            <div className="flex flex-col xl:flex-row min-h-screen">
              
              {/* PAINEL DE CONTROLE ESQUERDO */}
              <div className="w-full xl:w-[480px] p-8 xl:p-10 border-r border-white/5 bg-black/30 backdrop-blur-xl flex flex-col justify-center">
                
                <h2 className="text-3xl tracking-tight font-light text-white flex flex-col mb-10 border-b border-white/10 pb-6">
                  <span className="text-slate-500 text-sm font-medium uppercase tracking-widest mb-2">Painel de Operação</span>
                  Terminal de <strong className="font-bold text-teal-400">Síntese Ativa</strong>
                </h2>

                <div className="space-y-8">
                  {/* Prompt */}
                  <div className="space-y-4">
                    <label className="text-[11px] text-teal-400 font-bold uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_5px_rgba(78,201,176,0.8)]" /> 
                      Entrada Matricial (Prompt)
                    </label>
                    <textarea 
                      value={prompt} 
                      onChange={(e) => setPrompt(e.target.value)} 
                      className="w-full bg-black/50 border border-white/10 hover:border-white/20 rounded-xl p-5 text-slate-200 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 h-36 placeholder-slate-600 transition-all resize-none shadow-inner" 
                      placeholder="Declaração dos parâmetros visuais... Ex: 'Cenário cyberpunk corporativo minimalista, iluminação volumétrica, qualidade hiper-realista'" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Imagem Base */}
                    <div className="space-y-4">
                      <label className="text-[11px] text-teal-400 font-bold uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_5px_rgba(78,201,176,0.8)]" /> 
                        Semente (Opcional)
                      </label>
                      <div 
                        onClick={() => fileInputRef.current?.click()} 
                        className="w-full h-[60px] border border-dashed border-white/20 hover:border-teal-500/60 hover:bg-teal-500/5 rounded-xl flex items-center justify-center cursor-pointer transition-all bg-black/50"
                      >
                        {inputImage ? (
                          <div className="flex items-center gap-2 px-3">
                            <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
                              <ImageIcon className="w-3 h-3 text-emerald-400" />
                            </div>
                            <p className="text-[10px] text-emerald-400 truncate max-w-[100px]">{inputImage.name}</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-500 hover:text-teal-400 transition-colors">
                            <ImageIcon className="w-4 h-4" />
                            <span className="text-xs font-medium">Carregar</span>
                          </div>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </div>

                    {/* Proporção */}
                    <div className="space-y-4">
                      <label className="text-[11px] text-teal-400 font-bold uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_5px_rgba(78,201,176,0.8)]" /> 
                        Proporção
                      </label>
                      <div className="relative">
                        <select 
                          value={aspectRatio} 
                          onChange={(e) => setAspectRatio(e.target.value)} 
                          className="w-full h-[60px] bg-black/50 border border-white/10 rounded-xl px-4 text-sm text-slate-300 focus:outline-none focus:border-teal-500/50 transition-all appearance-none cursor-pointer font-medium"
                        >
                          <option value="1:1" className="bg-neutral-900">Quadrado [1:1]</option>
                          <option value="16:9" className="bg-neutral-900">Paisagem [16:9]</option>
                          <option value="9:16" className="bg-neutral-900">Retrato [9:16]</option>
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-4 pt-10 border-t border-white/10 mt-10">
                  <button 
                    onClick={resetInputs} 
                    disabled={loading} 
                    className="flex-1 py-4 px-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer border border-white/10"
                  >
                    <RotateCcw className="w-4 h-4 inline-block -mt-0.5 mr-1" /> Resetar
                  </button>
                  <button 
                    onClick={generateImage} 
                    disabled={loading || !prompt} 
                    className="flex-[2] py-4 bg-teal-400 hover:bg-teal-300 text-black font-black justify-center rounded-xl text-[11px] uppercase tracking-widest disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(78,201,176,0.4)] hover:shadow-[0_0_35px_rgba(78,201,176,0.6)] cursor-pointer flex items-center gap-2"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin inline-block border-black" /> Extraindo</>
                    ) : (
                      <><Play className="w-5 h-5 inline-block fill-current" /> Iniciar Processo</>
                    )}
                  </button>
                </div>

                {/* Avisos */}
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-3 backdrop-blur-sm shadow-inner mt-6 animate-fadeIn">
                    <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <p className="leading-relaxed font-light">{error}</p>
                  </div>
                )}
              </div>

              {/* ÁREA DA IMAGEM DIREITA */}
              <div className="flex-1 flex flex-col items-center justify-center p-8 xl:p-12 relative min-h-[500px]">
                {loading ? (
                  <div className="flex flex-col items-center gap-8 animate-fadeIn">
                    <div className="relative">
                      <div className="w-32 h-32 border-2 border-white/5 rounded-full animate-[spin_4s_linear_infinite]" />
                      <div className="w-32 h-32 border-2 border-t-teal-400 border-r-transparent border-b-teal-400/20 border-l-transparent rounded-full animate-[spin_1.5s_cubic-bezier(0.5,0,0.5,1)_infinite] absolute inset-0 shadow-[0_0_30px_rgba(78,201,176,0.3)]" />
                      <Network className="w-10 h-10 text-teal-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-90 animate-pulse" />
                    </div>
                    <div className="text-center space-y-3">
                      <p className="text-teal-400 font-bold tracking-widest animate-pulse uppercase text-xs">{progressText}</p>
                      <p className="text-slate-500 text-[11px] uppercase tracking-widest flex items-center gap-2 justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" /> Estabilizando Variáveis
                      </p>
                    </div>
                  </div>
                ) : generatedImage ? (
                  <div className="w-full max-w-4xl flex flex-col gap-6 animate-fadeIn">
                    <div className="relative group rounded-3xl overflow-hidden border border-white/10 bg-black/60 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-sm p-4 md:p-6">
                      <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.05] rounded-3xl pointer-events-none" />
                      <img 
                        src={generatedImage} 
                        alt="Resultado da Síntese" 
                        className="w-full max-h-[65vh] object-contain rounded-2xl border border-white/5" 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-5 px-8 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-teal-500 uppercase tracking-widest font-bold">Log de Execução</span>
                        <span className="text-slate-400 text-sm">Rendimento: <strong className="text-slate-200">{generationTime}s</strong></span>
                      </div>
                      <button 
                        onClick={() => downloadImage()} 
                        className="px-8 py-3 bg-white/5 hover:bg-white/15 border border-white/20 rounded-xl text-teal-300 hover:text-teal-200 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer shadow-lg"
                      >
                        <Download className="w-4 h-4" /> Exportar Pacote
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center flex flex-col items-center px-4 animate-fadeIn">
                    <div className="w-40 h-40 border border-dashed border-white/10 rounded-[2rem] flex items-center justify-center bg-white/[0.01] mb-8 relative group">
                      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-30 rounded-[2rem] group-hover:opacity-60 transition-opacity" />
                      <Network className="w-12 h-12 text-slate-600 group-hover:text-teal-500/50 transition-colors" />
                    </div>
                    <p className="text-2xl font-light text-slate-200 tracking-tight mb-2">Aguardando Input Matemático</p>
                    <p className="text-sm text-slate-500 max-w-sm font-light leading-relaxed">O canvas está protegido. Defina os atributos semânticos para iniciar o fluxo da arquitetura de criação.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TELA 2: HISTÓRICO DE IMAGENS */}
          {activeTab === 'historico' && (
            <div className="p-8 md:p-14 min-h-screen">
              <div className="mb-14 border-b border-white/10 pb-8">
                <h2 className="text-4xl font-light tracking-tight text-white mb-3">Backup de <strong className="font-bold text-teal-400">Ativos</strong></h2>
                <p className="text-slate-500 font-light text-base max-w-xl">Todos os registros são gravados na estrutura da nuvem para referência e restauração imediatas.</p>
              </div>
              
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center h-64 gap-6">
                  <div className="w-12 h-12 border-2 border-white/10 border-t-teal-400 rounded-full animate-spin" />
                  <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">Extraindo Blocos de Dados...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
                  <ImageIcon className="w-12 h-12 text-slate-600 mb-6" />
                  <p className="text-slate-400 font-light text-lg">Nenhum snapshot de memória foi construído ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {history.map((item) => (
                    <div key={item.id} className="group relative rounded-2xl overflow-hidden border border-white/10 bg-black/60 transition-all duration-500 flex flex-col hover:border-teal-500/40 hover:shadow-[0_15px_40px_rgba(78,201,176,0.15)] flex-grow">
                      <div className="aspect-square w-full relative overflow-hidden bg-white/[0.02]">
                        <img 
                          src={item.image_url} 
                          alt={item.prompt} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                          loading="lazy" 
                        />
                        
                        {/* Camada Hover Fosca */}
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-6">
                          <button 
                            onClick={() => downloadImage(item.image_url)} 
                            className="translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 px-6 py-3 bg-white hover:bg-teal-50 text-black font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl border border-white"
                          >
                            <Download className="w-4 h-4" /> Resgatar Imagem
                          </button>
                        </div>
                      </div>
                      <div className="p-5 border-t border-white/5 flex flex-col gap-3 bg-black flex-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-teal-500/60 shadow-[0_0_5px_rgba(78,201,176,0.8)]" />
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold flex-1">Identificador Fonte</p>
                        </div>
                        <p className="text-xs text-slate-300 font-light line-clamp-3 leading-relaxed" title={item.prompt}>
                          "{item.prompt}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </SignedIn>

      {/* ESTILOS (Scrollbar customizada e Animações) */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </div>
  );
}
