import React, { useState, useRef, useEffect } from 'react';
import { Download, Play, RotateCcw, AlertTriangle, Loader2, Image as ImageIcon, PlusSquare, CreditCard, Home, MessageCircle, ChevronUp } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from "@clerk/clerk-react";

export default function App() {
  const { userId } = useAuth();
  
  // Estados Principais
  const [activeTab, setActiveTab] = useState('dashboard');
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

  // 4. Lógica de Geração da Imagem
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

      if (inputImage) {
        setProgressText('A processar imagem base...');
        const base64Image = await fileToBase64(inputImage);
        
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
    <div className="min-h-screen bg-[#07090c] text-white font-sans overflow-hidden flex relative">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* --- ECRÃ DE BOAS-VINDAS (Não logado) --- */}
      <SignedOut>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full px-4 gap-0">
          <div className="hub-landing-card animate-fadeIn">
            <div className="hub-card-border-container" />
            <div className="relative z-10">
              <div className="hub-card-topbar">
                <span className="hub-dot" />
                <span className="hub-dot" />
                <span className="hub-dot" />
                <span className="hub-topbar-label">HUB IA 54 — SISTEMA EM DESENVOLVIMENTO </span>
              </div>
              <div className="hub-card-body">
                <div className="hub-logo-block">
                  <div className="hub-logo-badge">AI</div>
                  <div>
                    <h1 className="hub-title">HUB IA 54</h1>
                    <p className="hub-subtitle">Plataforma Focada em Inteligência Artificial</p>
                  </div>
                </div>
                <div className="hub-divider" />
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
                <div className="hub-divider" />
                <p className="hub-desc">
                 Ferramentas de criação visual com inteligência artificial de última geração. 
                 Resultados profissionais, interface limpa, sem distrações.
                </p>
                <SignInButton mode="modal">
                  <button className="hub-cta-btn">
                    <span className="hub-cta-label">Acessar Plataforma</span>
                    <span className="hub-cta-arrow">→</span>
                  </button>
                </SignInButton>
                <p className="hub-card-footer">Acesso seguro · Dados encriptados by HUB IA </p>
              </div>
            </div>
          </div>
        </div>
      </SignedOut>

      {/* --- ÁREA DE MEMBROS (Logado) --- */}
      <SignedIn>
        
        {/* Cabecalho Perfil */}
        <header className="fixed top-0 right-0 z-50 p-4 md:p-6 flex flex-col items-end">
          <div className="bg-[#0a0a0ae6] backdrop-blur-md rounded-full px-3 md:px-5 py-2 border border-white/10 flex items-center gap-3 shadow-2xl">
             <div className="hidden sm:flex flex-col text-right mr-2">
                <span className="text-[9px] md:text-[10px] text-white/50 uppercase tracking-widest font-bold">Meus créditos</span>
                <span className="text-xs md:text-sm font-bold text-white leading-tight">R$ 0,00</span>
             </div>
             <UserButton />
          </div>
        </header>

        {/* MENU LATERAL - Expansível no Hover */}
        <aside
          className="relative z-40 h-screen border-r border-[#1a1a2e] hidden md:flex flex-col transition-all duration-300 w-[80px] hover:w-[260px] group"
          style={{
            backgroundColor: 'rgba(10, 12, 16, 0.95)',
            backdropFilter: 'blur(24px) saturate(1.2)',
            boxShadow: '10px 0 40px rgba(0,0,0,0.8)',
          }}
        >
          {/* Logo Lateral */}
          <div className="h-[80px] flex items-center border-b border-white/5 overflow-hidden w-full">
            <div className="w-[80px] flex-shrink-0 flex justify-center group-hover:w-[70px] transition-all">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-white/10 flex flex-col items-center justify-center shadow-inner">
                <span className="text-[10px] font-black text-white px-1 leading-none py-0.5">HUB</span>
                <span className="text-[10px] font-black text-white/70 px-1 leading-none pb-0.5">IA</span>
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
              <h1 className="text-sm font-black tracking-widest text-white uppercase shadow-black drop-shadow-md">HUB IA 54</h1>
              <p className="text-[9px] text-white/50 uppercase tracking-widest shadow-black">Plataforma</p>
            </div>
          </div>

          {/* Navegação */}
          <nav className="flex-1 px-3 py-6 space-y-3 overflow-hidden w-full">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center h-[52px] rounded-xl transition-all duration-300 border border-transparent ${activeTab === 'dashboard' ? 'bg-white/10 border-white/10 text-white shadow-inner' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="w-[56px] flex-shrink-0 flex justify-center transition-all group-hover:w-[50px]">
                <Home className="w-5 h-5 flex-shrink-0" />
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-bold text-xs uppercase tracking-widest whitespace-nowrap">
                Início
              </span>
            </button>

            <button
              onClick={() => setActiveTab('gerar')}
              className={`w-full flex items-center h-[52px] rounded-xl transition-all duration-300 border border-transparent ${activeTab === 'gerar' ? 'bg-white/10 border-white/10 text-white shadow-inner' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="w-[56px] flex-shrink-0 flex justify-center transition-all group-hover:w-[50px]">
                <PlusSquare className="w-5 h-5 flex-shrink-0" />
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-bold text-xs uppercase tracking-widest whitespace-nowrap">
                Gerador
              </span>
            </button>

            <button
              onClick={() => setActiveTab('historico')}
              className={`w-full flex items-center h-[52px] rounded-xl transition-all duration-300 border border-transparent ${activeTab === 'historico' ? 'bg-white/10 border-white/10 text-white shadow-inner' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="w-[56px] flex-shrink-0 flex justify-center transition-all group-hover:w-[50px]">
                <ImageIcon className="w-5 h-5 flex-shrink-0" />
              </div>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-bold text-xs uppercase tracking-widest whitespace-nowrap">
                Histórico
              </span>
            </button>
          </nav>
        </aside>

        {/* NAVEGAÇÃO MOBILE (Bottom bar) */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-[#0a0c10]/95 backdrop-blur-xl border-t border-white/10 z-40 flex items-center justify-around px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center justify-center p-2 pt-3 w-16 transition-all ${activeTab === 'dashboard' ? 'text-purple-400' : 'text-white/40'}`}>
            <Home className="w-6 h-6 mb-1" />
            <span className="text-[9px] uppercase font-bold tracking-widest leading-none">Início</span>
          </button>
          <button onClick={() => setActiveTab('gerar')} className={`flex flex-col items-center justify-center p-2 pt-3 w-16 transition-all ${activeTab === 'gerar' ? 'text-purple-400' : 'text-white/40'}`}>
            <PlusSquare className="w-6 h-6 mb-1" />
            <span className="text-[9px] uppercase font-bold tracking-widest leading-none">Gerar</span>
          </button>
          <button onClick={() => setActiveTab('historico')} className={`flex flex-col items-center justify-center p-2 pt-3 w-16 transition-all ${activeTab === 'historico' ? 'text-purple-400' : 'text-white/40'}`}>
            <ImageIcon className="w-6 h-6 mb-1" />
            <span className="text-[9px] uppercase font-bold tracking-widest leading-none">Arquivo</span>
          </button>
        </nav>

        {/* BOTÃO WHATSAPP FLUTUANTE */}
        <a href="https://wa.me/" target="_blank" rel="noopener noreferrer" 
           className="fixed bottom-[90px] md:bottom-8 right-4 md:right-8 z-50 w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#25D366] flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(37,211,102,0.4)] hover:scale-110 hover:shadow-[0_0_30px_rgba(37,211,102,0.6)] transition-all duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="white" viewBox="0 0 16 16">
            <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c-.003 1.396.366 2.76 1.056 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
          </svg>
        </a>

        {/* CONTEÚDO CENTRAL */}
        <main className="relative z-10 flex-1 h-screen overflow-y-auto custom-scrollbar overflow-x-hidden">
          
          {/* TELA 1: ÁREA DE MEMBROS (Dashboard Principal) */}
          {activeTab === 'dashboard' && (
            <div className="w-full flex flex-col pb-24 md:pb-12 xl:max-w-[1600px] xl:mx-auto">
              
              {/* BANNER SUPERIOR DE DESTAQUE */}
              <div className="relative w-full h-[400px] md:h-[500px] flex flex-col justify-end p-6 md:p-14 border-b border-white/5 overflow-hidden group">
                
                {/* Espaço para Imagem de Fundo customizada Futura */}
                <div className="absolute inset-0 bg-transparent z-0 overflow-hidden pointer-events-none">
                   {/* Background Overlay Default - Aqui entra a imagem de capa em nova TAG img no futuro */}
                   <div className="w-full h-full bg-gradient-to-t from-[#05070a] via-[#0a0c12]/80 to-transparent"></div>
                   <div className="absolute w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent"></div>
                </div>

                <div className="relative z-10 max-w-4xl border-l-[3px] border-purple-500 pl-6 md:pl-8">
                  {/* Rating Estrelas */}
                  <div className="flex gap-1 mb-5 items-center">
                     {[1,2,3,4,5].map(star => <span key={star} className="text-purple-500 text-sm md:text-lg leading-none">★</span>)}
                     <span className="text-white/70 ml-2 text-xs md:text-sm font-bold mt-1">(5,0)</span>
                     <span className="text-white/40 ml-4 text-[10px] md:text-xs tracking-widest uppercase mt-1 flex items-center gap-1 cursor-pointer hover:text-white transition">🌟 Avaliar plataforma</span>
                  </div>

                  <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter drop-shadow-2xl shadow-black">Treinamento & Ferramenta Generativa</h1>
                  
                  <p className="text-white/70 text-sm md:text-base font-light max-w-2xl mb-10 leading-relaxed drop-shadow-lg shadow-black">
                    Acesse imediatamente as mais avançadas LLMs de processamento de imagem na nuvem. Aprenda todas as vulnerabilidades e padrões hiper-realistas diretamente do estúdio de criação.
                  </p>

                  {/* Botão Ação */}
                  <div 
                    className="p-4 rounded-xl bg-black/50 backdrop-blur-md max-w-sm cursor-pointer border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all group/cta flex items-center gap-4 shadow-2xl"
                    onClick={() => setActiveTab('gerar')}
                  >
                     <div className="w-12 h-12 rounded-full border border-white/20 bg-white/5 group-hover/cta:bg-white flex items-center justify-center transition-all">
                       <Play className="w-5 h-5 text-white group-hover/cta:text-black ml-1 transition-colors" />
                     </div>
                     <div>
                       <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold mb-1">Acessar Estúdio Principal:</p>
                       <p className="text-white font-bold text-sm leading-tight">Painel do Gerador IA</p>
                       <p className="text-[#1abc9c] font-black text-[10px] uppercase tracking-widest mt-0.5">Disponível</p>
                     </div>
                  </div>
                </div>
              </div>

              {/* LISTAGEM DE MÓDULOS / FERRAMENTAS */}
              <div className="px-6 md:px-14 py-12 md:py-16">
                
                <div className="flex items-center gap-3 mb-8 cursor-pointer opacity-90 hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <ChevronUp className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-white font-bold text-xl md:text-2xl tracking-tight">Ver todas as seções</h2>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                  
                  {/* Banner Sub - 1 (Ativo) -> Redireciona Gerador */}
                  <div onClick={() => setActiveTab('gerar')} className="aspect-[4/5] rounded-[20px] border border-white/10 bg-[#0a0c12]/80 backdrop-blur cursor-pointer relative overflow-hidden group transition-all duration-300 hover:ring-2 hover:ring-purple-500/50 hover:border-purple-500/50 hover:-translate-y-2 shadow-2xl">
                     <div className="absolute inset-0 bg-gradient-to-t from-[#020305] via-[#020305]/60 to-transparent z-10" />
                     
                     <div className="absolute top-0 left-0 p-4 z-20 w-full flex justify-between items-start">
                       <span className="px-3 py-1.5 bg-[#1abc9c]/10 border border-[#1abc9c]/30 rounded text-[9px] font-black text-[#1abc9c] tracking-widest uppercase shadow-lg backdrop-blur-md">MÓDULO 1</span>
                     </div>
                     
                     <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6 z-20">
                        <h3 className="text-white font-bold text-lg md:text-xl leading-tight group-hover:text-purple-300 transition-colors">Estúdio Criador IA</h3>
                        <p className="text-white/40 text-xs mt-2 mb-4 font-light leading-snug line-clamp-2">Acesso total ao pipeline visual base.</p>
                        
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                           <div className="h-full w-full bg-gradient-to-r from-purple-500 to-[#1abc9c]"></div>
                        </div>
                     </div>
                  </div>

                  {/* Banners Sub placeholders 2 a 5 */}
                  {[2,3,4,5].map((num) => (
                    <div key={num} className="aspect-[4/5] rounded-[20px] border border-white/5 bg-[#0a0c12]/40 backdrop-blur cursor-pointer relative overflow-hidden group opacity-60 hover:opacity-100 transition-all duration-300 hover:ring-1 hover:ring-white/20 hover:-translate-y-1 shadow-xl">
                       <div className="absolute inset-0 bg-gradient-to-t from-[#020305] via-transparent to-transparent z-10" />
                       
                       <div className="absolute top-0 left-0 p-4 z-20 w-full flex justify-between items-start">
                         <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-[9px] font-black text-white/50 tracking-widest uppercase backdrop-blur-md">MÓDULO {num}</span>
                       </div>
                       
                       <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6 z-20">
                          <h3 className="text-white/70 font-bold text-lg md:text-xl leading-tight group-hover:text-white transition-colors">Liberar em Breve</h3>
                          <p className="text-white/30 text-xs mt-2 mb-4 font-light line-clamp-2">Nova seção será disponibilizada pela plataforma.</p>
                          
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                             <div className="h-full w-[0%] bg-white/20"></div>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}


          {/* TELA 2: GERAR IMAGEM (ESTÚDIO) */}
          {activeTab === 'gerar' && (
            <div className="flex flex-col xl:flex-row min-h-screen pb-20 md:pb-0">
              
              {/* PAINEL DE CONTROLO ESQUERDO */}
              <div
                className="w-full xl:w-[420px] p-6 md:p-10 space-y-7 border-r border-[#1a1a2e] flex-shrink-0 relative z-20"
                style={{
                  backgroundColor: 'rgba(8, 10, 14, 0.85)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                }}
              >
                <div className="pb-2">
                  <p className="text-[10px] text-white/50 uppercase tracking-widest font-black mb-2 text-[#1abc9c]">Módulo 1 / Ferramenta</p>
                  <h2 className="text-3xl font-black text-white tracking-tight">Estúdio Generativo</h2>
                </div>

                <div className="space-y-3">
                  <label className="panel-label">Prompt Principal <span className="text-white/40 font-normal lowercase">(obrigatório)</span></label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="panel-textarea shadow-inner"
                    placeholder="Descreva detalhadamente o cenário, estilo, iluminação, cores..."
                    rows={5}
                  />
                </div>

                <div className="space-y-3">
                  <label className="panel-label">Base de Transformação <span className="text-white/40 font-normal lowercase">(opcional)</span></label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`panel-upload-zone shadow-inner ${inputImage ? 'panel-upload-success' : ''}`}
                  >
                    {inputImage ? (
                      <div className="flex flex-col items-center gap-2 text-[#1abc9c]">
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-xs font-bold uppercase tracking-wider">Mídia Carregada com Sucesso</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                           <Download className="w-4 h-4 text-white/50" />
                        </div>
                        <span className="text-xs font-light text-white/60">Clique ou arraste arquivo visual</span>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>

                <div className="space-y-3">
                  <label className="panel-label">Dimensão de Saída</label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="panel-select shadow-inner"
                  >
                    <option value="1:1">1:1 — Quadrado Perfeito</option>
                    <option value="16:9">16:9 — Formato Paisagem</option>
                    <option value="9:16">9:16 — Formato Visual Vertical</option>
                  </select>
                </div>

                <div className="border-t border-white/10 pt-8 space-y-4">
                  <div className="flex gap-3">
                    <button
                      onClick={resetInputs}
                      disabled={loading}
                      className="panel-btn-secondary"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={generateImage}
                      disabled={loading || !prompt}
                      className="panel-btn-primary flex-1"
                    >
                      {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Extraindo Rede Neural...</span></>
                        : <><Play className="w-4 h-4" /><span>Gerar Renderização</span></>
                      }
                    </button>
                  </div>

                  {error && (
                    <div className="panel-error">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                      <p className="text-red-200/90">{error}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ÁREA DA IMAGEM DIREITA */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative min-h-[60vh] xl:min-h-screen">
                {loading ? (
                  <div className="text-center space-y-8 flex flex-col items-center">
                    <div className="loading-spinner-glow" />
                    <p className="text-purple-300 text-sm font-bold tracking-[0.2em] uppercase animate-pulse drop-shadow-md">{progressText}</p>
                  </div>
                ) : generatedImage ? (
                  <div className="w-full max-w-4xl space-y-6 animate-fadeIn">
                    <div className="relative group flex justify-center w-full">
                      <img
                        src={generatedImage}
                        alt="Processado Neural"
                        className="w-full max-h-[75vh] object-contain rounded-2xl"
                        style={{ boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)' }}
                      />
                    </div>
                    <div
                      className="flex items-center justify-between p-5 rounded-2xl border border-white/5"
                      style={{ backgroundColor: 'rgba(8,10,14,0.6)', backdropFilter: 'blur(20px)' }}
                    >
                      <div className="text-sm text-white/50 font-light hidden sm:block">
                        Tempo de latência <strong className="text-white font-bold ml-1">{generationTime}s</strong>
                      </div>
                      <button
                        onClick={() => downloadImage()}
                        className="result-download-btn w-full sm:w-auto justify-center"
                      >
                        <Download className="w-4 h-4" />
                        <span>Extrair Mídia .PNG</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-6 flex flex-col items-center opacity-60">
                    <div className="empty-state-icon relative bg-[#0a0c12]/50 border border-white/5 rounded-[2xl] p-8 shadow-2xl">
                      <ImageIcon className="w-16 h-16 text-white/20 mb-4" />
                      <p className="text-xl font-light text-white/80 tracking-wide">Terminal Operacional em Espera</p>
                      <p className="text-sm text-white/40 mt-2 font-light">Especifique os parâmetros visuais no painel.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TELA 3: HISTÓRICO DE IMAGENS */}
          {activeTab === 'historico' && (
            <div className="p-6 md:p-14 min-h-screen pb-24 md:pb-14">
              <div className="mb-12 border-b border-white/10 pb-8">
                <p className="text-[10px] text-white/50 uppercase tracking-widest font-black mb-2 text-purple-400">Banco de Dados Pessoal</p>
                <h2 className="text-3xl font-black text-white tracking-tight">O Meu Arquivo Digital</h2>
                <p className="text-white/50 mt-3 text-sm font-light max-w-xl leading-relaxed">Registro completo de todos os vetores e matrizes visuais geradas e armazenadas em segurança na nossa nuvem encriptada.</p>
              </div>
              
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center h-64 gap-6">
                  <div className="loading-spinner-glow w-10 h-10" />
                  <span className="text-xs uppercase tracking-widest text-white/40 font-bold">Resgatando Arquivos</span>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-6 opacity-70 border border-dashed border-white/10 rounded-3xl bg-white/5 max-w-2xl mx-auto">
                  <ImageIcon className="w-10 h-10 text-white/30" />
                  <p className="text-white/50 text-sm font-light tracking-wide uppercase">Nenhum registro encontrado no servidor.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="history-card group animate-fadeIn"
                    >
                      <div className="aspect-square w-full bg-[#0a0c12] relative overflow-hidden">
                        <img
                          src={item.image_url}
                          alt={item.prompt}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          loading="lazy"
                        />
                        
                        {/* Camada Hover Escura */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5"
                          style={{ background: 'linear-gradient(to top, rgba(5,7,10,0.95) 0%, rgba(5,7,10,0.4) 60%, transparent 100%)', backdropFilter: 'blur(3px)' }}>
                          <p className="text-xs text-white/90 line-clamp-4 font-light tracking-wide mb-4 leading-relaxed">"{item.prompt}"</p>
                          <button
                            onClick={() => downloadImage(item.image_url)}
                            className="history-download-btn shadow-xl shadow-black/80"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Full-Res</span>
                          </button>
                        </div>
                      </div>
                      <div className="px-5 py-4 border-t border-white/5 bg-[#0a0c12]/80 backdrop-blur-sm relative z-10">
                        <p className="text-xs text-white/40 truncate font-light leading-relaxed">"{item.prompt}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </SignedIn>

      {/* ESTILOS GLOBAIS REFINADOS */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes spin { to { transform: rotate(360deg); } }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #05070a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        .hub-landing-card {
          width: 100%; max-width: 520px;
          background: rgba(12, 14, 18, 0.85); backdrop-filter: blur(32px);
          border: 1px solid rgba(255,255,255,0.05); border-radius: 20px;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.02) inset, 0 32px 80px rgba(0,0,0,0.8);
          position: relative;
        }

        .hub-card-border-container {
           position: absolute;
           inset: 0;
           border-radius: 20px;
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
          display: flex; align-items: center; gap: 6px;
          padding: 14px 24px; border-bottom: 1px solid rgba(255,255,255,0.04);
          background: rgba(255,255,255,0.02);
          border-top-left-radius: 20px; border-top-right-radius: 20px;
        }
        .hub-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.15); }
        .hub-topbar-label { margin-left: 8px; font-size: 10px; letter-spacing: 0.15em; color: rgba(255,255,255,0.4); font-weight: 700; text-transform: uppercase; }

        .hub-card-body { padding: 40px 40px 36px; display: flex; flex-direction: column; }

        .hub-logo-block { display: flex; align-items: center; gap: 18px; margin-bottom: 32px; }
        .hub-logo-badge {
          width: 52px; height: 52px; border-radius: 12px;
          background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(59,130,246,0.2));
          border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 900; color: #fff; box-shadow: inset 0 0 20px rgba(255,255,255,0.05);
        }
        .hub-title { font-size: 30px; font-weight: 900; letter-spacing: -0.02em; line-height: 1; }
        .hub-subtitle { font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 6px; letter-spacing: 0.04em; }

        .hub-divider { height: 1px; background: linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent); margin: 24px 0; }

        .hub-features-row { display: flex; align-items: center; }
        .hub-feature-item { display: flex; align-items: center; gap: 8px; flex: 1; justify-content: center; }
        .hub-feature-icon { font-size: 10px; color: rgba(168,85,247,0.8); }
        .hub-feature-label { font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 600; text-align: center; }
        .hub-feature-sep { width: 1px; height: 24px; background: rgba(255,255,255,0.05); margin: 0 16px; flex-shrink: 0; }

        .hub-desc { font-size: 14px; color: rgba(255,255,255,0.6); line-height: 1.7; font-weight: 300; margin-bottom: 32px; text-align: center; }

        .hub-cta-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px;
          padding: 16px 24px; background: #fff; color: #000; border: none; border-radius: 12px;
          font-size: 13px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
          cursor: pointer; transition: all 0.25s ease; box-shadow: 0 0 30px rgba(255,255,255,0.1);
        }
        .hub-cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(255,255,255,0.2); }
        .hub-card-footer { font-size: 10px; color: rgba(255,255,255,0.3); text-align: center; margin-top: 24px; letter-spacing: 0.1em; text-transform: uppercase; }

        .panel-label { display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.7); }
        
        .panel-textarea {
          width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: 16px; color: #fff; font-size: 14px; font-weight: 300;
          line-height: 1.6; resize: none; outline: none; transition: all 0.2s; font-family: inherit;
        }
        .panel-textarea::placeholder { color: rgba(255,255,255,0.25); }
        .panel-textarea:focus { border-color: purple; background: rgba(0,0,0,0.6); box-shadow: 0 0 0 2px rgba(168,85,247,0.2); }

        .panel-upload-zone {
          width: 100%; border: 1px dashed rgba(255,255,255,0.15); border-radius: 12px;
          padding: 32px 24px; text-align: center; cursor: pointer; background: rgba(0,0,0,0.2); transition: all 0.2s;
        }
        .panel-upload-zone:hover { border-color: rgba(255,255,255,0.3); background: rgba(0,0,0,0.4); }
        .panel-upload-success { border-color: #1abc9c; border-style: solid; background: rgba(26,188,156,0.05); }

        .panel-select {
          width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: 14px 16px; color: #fff; font-size: 13px; font-weight: 500;
          outline: none; transition: all 0.2s; cursor: pointer;
        }
        .panel-select:focus { border-color: purple; box-shadow: 0 0 0 2px rgba(168,85,247,0.2); }
        .panel-select option { background: #0a0c12; }

        .panel-btn-secondary {
          display: flex; align-items: center; justify-content: center; width: 56px;
          padding: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);
          color: rgba(255,255,255,0.7); border-radius: 12px; cursor: pointer; transition: all 0.2s;
        }
        .panel-btn-secondary:hover:not(:disabled) { border-color: rgba(255,255,255,0.3); color: #fff; background: rgba(255,255,255,0.05); }
        .panel-btn-secondary:disabled { opacity: 0.3; cursor: not-allowed; }

        .panel-btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 14px 20px; background: #fff; color: #000; border: none; border-radius: 12px;
          font-size: 12px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;
          cursor: pointer; transition: all 0.2s; box-shadow: 0 0 24px rgba(255,255,255,0.1);
        }
        .panel-btn-primary:hover:not(:disabled) { box-shadow: 0 4px 30px rgba(255,255,255,0.3); transform: translateY(-1px); }
        .panel-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

        .panel-error {
          display: flex; align-items: flex-start; gap: 12px; padding: 14px;
          background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2);
          border-radius: 12px; font-size: 12px; line-height: 1.5; font-weight: 500;
        }

        .loading-spinner-glow {
          width: 56px; height: 56px; border: 2px solid rgba(168,85,247,0.1);
          border-top-color: #a855f7; border-radius: 50%;
          animation: spin 0.8s ease-in-out infinite;
          box-shadow: 0 0 30px rgba(168,85,247,0.4);
        }

        .result-download-btn {
          display: flex; align-items: center; gap: 8px; padding: 12px 24px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1);
          color: #fff; border-radius: 10px; font-size: 11px; font-weight: 800;
          letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s;
        }
        .result-download-btn:hover { background: #fff; color: #000; box-shadow: 0 0 20px rgba(255,255,255,0.2); }

        .history-card {
          border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);
          background: rgba(10,12,18,0.6); backdrop-filter: blur(12px);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .history-card:hover { border-color: rgba(168,85,247,0.4); box-shadow: 0 16px 40px rgba(0,0,0,0.6); transform: translateY(-4px); }

        .history-download-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px; background: rgba(255,255,255,0.95); color: #000; border: none;
          border-radius: 8px; font-size: 11px; font-weight: 900; letter-spacing: 0.1em;
          text-transform: uppercase; cursor: pointer; transition: background 0.2s;
        }
        .history-download-btn:hover { background: #fff; }
      `}</style>
    </div>
  );
}
