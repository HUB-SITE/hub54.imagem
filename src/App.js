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

  const letters = ['H', 'U', 'B', 'I', 'M', 'A', 'G', 'E', 'M', '5', '4'];

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden flex relative">
      
      {/* BACKGROUND (Rede Neural) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* --- ECRÃ DE BOAS-VINDAS (Não logado) --- */}
      <SignedOut>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full gap-16 px-4">
          <div className="text-center space-y-4 animate-fadeIn">
            <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-white drop-shadow-2xl" style={{textShadow: '0 0 30px rgba(255,255,255,0.5)'}}>
              HUB IA 54
            </h1>
            <p className="text-xl text-gray-300 font-light tracking-widest">
              Plataforma Focada em Inteligência Artificial
            </p>
          </div>

          <div className="w-full overflow-hidden">
            <div className="flex animate-infinite-scroll gap-4 justify-center px-4">
              {[...letters, ...letters, ...letters].map((letter, i) => (
                <div key={i} className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 border-2 border-white flex items-center justify-center text-2xl md:text-3xl font-bold text-white rounded-lg transition-all hover:scale-110" style={{ boxShadow: '0 0 20px rgba(255,255,255,0.4), inset 0 0 20px rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                  {letter}
                </div>
              ))}
            </div>
          </div>

          <SignInButton mode="modal">
            <button className="px-12 py-4 border-2 border-white text-white font-bold rounded-lg text-lg transition-all hover:bg-white hover:text-black hover:shadow-2xl cursor-pointer" style={{boxShadow: '0 0 20px rgba(255,255,255,0.3)'}}>
              Começar Agora
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      {/* --- ÁREA DE MEMBROS (Logado) --- */}
      <SignedIn>
        
        {/* Ícone de perfil no canto superior direito */}
        <header className="fixed top-0 right-0 z-50 p-6">
          <UserButton />
        </header>

        {/* MENU LATERAL - Efeito Vidro Jateado */}
        <aside className="relative z-20 w-full md:w-64 h-screen border-r border-white/10 flex flex-col hidden md:flex" style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(16px)', boxShadow: '10px 0 30px rgba(0, 0, 0, 0.5)' }}>
          <div className="p-8 border-b border-white/10">
            <h1 className="text-2xl font-black tracking-tighter text-white" style={{textShadow: '0 0 20px rgba(255,255,255,0.3)'}}>HUB IA 54</h1>
          </div>

          <nav className="flex-1 p-4 space-y-2 mt-4">
            <button onClick={() => setActiveTab('gerar')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-semibold text-sm ${activeTab === 'gerar' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
              <PlusSquare className="w-5 h-5" /> NOVA GERAÇÃO
            </button>

            <button onClick={() => setActiveTab('historico')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-semibold text-sm ${activeTab === 'historico' ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
              <ImageIcon className="w-5 h-5" /> HISTÓRICO
            </button>
          </nav>

          <div className="p-6 border-t border-white/10">
            <div className="p-4 rounded-xl border border-white/20 bg-white/5 flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-gray-300" />
              <div className="flex flex-col">
                <span className="text-xs text-white/50 uppercase tracking-wider">O Seu Saldo</span>
                <span className="text-sm font-bold text-green-400">Ativo</span> 
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
              <div className="w-full xl:w-[420px] p-8 space-y-6 border-r border-white/10" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <h2 className="text-3xl font-bold text-white mb-8 tracking-tight" style={{textShadow: '0 0 10px rgba(255,255,255,0.3)'}}>Criar Imagem</h2>

                <div className="space-y-3">
                  <label className="text-sm text-white/80 font-semibold uppercase tracking-widest">✨ Prompt *</label>
                  <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full bg-white/10 border border-white/30 rounded-lg p-4 text-white focus:outline-none focus:border-white h-28 placeholder-gray-500" placeholder="Descreva o cenário..." />
                </div>

                <div className="space-y-3">
                  <label className="text-sm text-white/80 font-semibold uppercase tracking-widest">📸 Imagem Base</label>
                  <div onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-white/40 hover:border-white/70 rounded-lg p-6 text-center cursor-pointer transition-all bg-white/5">
                    <p className="text-sm text-white/70">📄 Clique ou arraste uma imagem</p>
                    {inputImage && <p className="text-xs text-green-400 mt-2 font-semibold">✅ Imagem carregada com sucesso</p>}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>

                <div className="space-y-3">
                  <label className="text-sm text-white/80 font-semibold uppercase tracking-widest">⊞ Proporção</label>
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white focus:outline-none transition-all [&>option]:bg-gray-900">
                    <option value="1:1">1:1 (Quadrado)</option>
                    <option value="16:9">16:9 (Paisagem)</option>
                    <option value="9:16">9:16 (Stories/Reels)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-6 border-t border-white/20">
                  <button onClick={resetInputs} disabled={loading} className="flex-1 py-3 px-4 border border-white/40 text-white hover:border-white/70 rounded-lg text-sm font-semibold uppercase tracking-wide transition-all">
                    <RotateCcw className="w-4 h-4 inline mr-1" /> Limpar
                  </button>
                  <button onClick={generateImage} disabled={loading || !prompt} className="flex-[2] py-3 bg-white text-black font-bold rounded-lg text-sm uppercase tracking-wide cursor-pointer disabled:opacity-50 transition-all" style={{boxShadow: '0 0 20px rgba(255,255,255,0.
