import React, { useState, useRef, useEffect } from 'react';
import { Download, Play, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [inputImage, setInputImage] = useState(null);
  
  const [generatedImage, setGeneratedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progressText, setProgressText] = useState('');
  const [generationTime, setGenerationTime] = useState(null);
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  // Rede Neural Animada
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = 50;

    // Criar partículas
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: Math.random() * 2 + 1,
      });
    }

    const animate = () => {
      // Fundo transparente
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Atualizar partículas
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce nas bordas
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Desenhar partícula
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Glow efeito
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Desenhar linhas de conexão
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setInputImage(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const resetInputs = () => {
    setPrompt('');
    setAspectRatio('1:1');
    setInputImage(null);
  };

  const generateImage = async () => {
    if (!prompt) {
      setError('O campo prompt é obrigatório.');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    setProgressText('Iniciando...');
    const startTime = Date.now();

    try {
      const input = { prompt: prompt, aspect_ratio: aspectRatio };
      if (inputImage) { input.input_images = [inputImage]; }

      const response = await fetch('https://backend-gerador-ia.onrender.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }), 
      });

      if (!response.ok) throw new Error(`Erro do servidor: ${response.status}`);

      let prediction = await response.json();
      setProgressText('Gerando imagem...');

      while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const getResponse = await fetch(`https://backend-gerador-ia.onrender.com}`);
        prediction = await getResponse.json();
      }

      if (prediction.status === 'succeeded') {
        const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        setGeneratedImage(outputUrl);
        setGenerationTime(((Date.now() - startTime) / 1000).toFixed(1));
      } else {
        throw new Error('Falha na geração.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  const downloadImage = async () => {
    if (!generatedImage) return;
    try {
      const response = await fetch(generatedImage);
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
        link.download = `imagem-gerada-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    } catch (error) {
      console.error("Erro ao baixar:", error);
      alert("Erro ao baixar a imagem.");
    }
  };

  const letters = ['H', 'U', 'B', 'I', 'M', 'A', 'G', 'E', 'M', '5', '4'];

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden">
      
      {/* CANVAS REDE NEURAL */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none"
      />

      {/* CONTEÚDO */}
      <div className="relative z-10">
        
        {/* SE NÃO ESTIVER LOGADO */}
        <SignedOut>
          <div className="flex flex-col items-center justify-center min-h-screen gap-16 px-4">
            
            {/* TÍTULO CENTRAL */}
            <div className="text-center space-y-4 animate-fadeIn">
              <h1 className="text-7xl md:text-8xl font-black tracking-tighter text-white drop-shadow-2xl" style={{textShadow: '0 0 30px rgba(255,255,255,0.5)'}}>
                HUB IA 54
              </h1>
              <p className="text-xl text-gray-300 font-light tracking-widest">
                Geração de Imagens com Inteligência Artificial
              </p>
            </div>

            {/* CARROSSEL INFINITO DE LETRAS */}
            <div className="w-full overflow-hidden">
              <div className="flex animate-infinite-scroll gap-4 justify-center px-4">
                {[...letters, ...letters, ...letters].map((letter, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 border-2 border-white flex items-center justify-center text-2xl md:text-3xl font-bold text-white rounded-lg transition-all hover:scale-110"
                    style={{
                      boxShadow: '0 0 20px rgba(255,255,255,0.4), inset 0 0 20px rgba(255,255,255,0.1)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
            </div>

            {/* BOTÃO LOGIN */}
            <SignInButton mode="modal">
              <button 
                className="px-12 py-4 border-2 border-white text-white font-bold rounded-lg text-lg transition-all hover:bg-white hover:text-black hover:shadow-2xl"
                style={{boxShadow: '0 0 20px rgba(255,255,255,0.3)'}}
              >
                Começar Agora
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        {/* SE ESTIVER LOGADO */}
        <SignedIn>
          {/* HEADER COM USER BUTTON */}
          <header className="fixed top-0 right-0 z-50 p-6">
            <UserButton />
          </header>

          <div className="flex flex-col lg:flex-row min-h-screen">
            
            {/* PAINEL ESQUERDO */}
            <div className="w-full lg:w-[420px] border-r border-white/20 p-8 overflow-y-auto max-h-screen custom-scrollbar" style={{backdropFilter: 'blur(10px)', backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <h2 className="text-3xl font-bold text-white mb-8 tracking-tight" style={{textShadow: '0 0 10px rgba(255,255,255,0.3)'}}>
                Criar Imagem
              </h2>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-white/80 font-semibold uppercase tracking-widest">
                    <span>✨</span> Prompt <span className="text-red-400">*</span>
                  </label>
                  <textarea 
                    value={prompt} 
                    onChange={(e) => setPrompt(e.target.value)} 
                    className="w-full bg-white/10 border border-white/30 rounded-lg p-4 text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white/30 transition-all resize-none h-28 placeholder-gray-500"
                    style={{backdropFilter: 'blur(10px)'}}
                    placeholder="Descreva o cenário..." 
                  />
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-white/80 font-semibold uppercase tracking-widest">
                    <span>📸</span> Imagem Base
                  </label>
                  <div 
                    onClick={() => fileInputRef.current?.click()} 
                    className="w-full border-2 border-dashed border-white/40 hover:border-white/70 rounded-lg p-6 text-center cursor-pointer transition-all group"
                    style={{backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255,255,255,0.05)'}}
                  >
                    <p className="text-sm text-white/70 group-hover:text-white/90">📄 Clique ou arraste uma imagem</p>
                    {inputImage && <p className="text-xs text-green-400 mt-2 font-semibold">✅ Imagem carregada</p>}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-white/80 font-semibold uppercase tracking-widest">
                    <span>⊞</span> Proporção
                  </label>
                  <select 
                    value={aspectRatio} 
                    onChange={(e) => setAspectRatio(e.target.value)} 
                    className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white/30 transition-all"
                    style={{backdropFilter: 'blur(10px)'}}
                  >
                    <option value="1:1">1:1 (Quadrado)</option>
                    <option value="16:9">16:9 (Paisagem)</option>
                    <option value="9:16">9:16 (Stories/Reels)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-6 border-t border-white/20">
                  <button 
                    onClick={resetInputs} 
                    disabled={loading} 
                    className="flex-1 py-3 px-4 border border-white/40 hover:border-white/70 text-white rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
                    style={{backdropFilter: 'blur(10px)'}}
                  >
                    <RotateCcw className="w-4 h-4" /> Limpar
                  </button>
                  <button 
                    onClick={generateImage} 
                    disabled={loading || !prompt} 
                    className="flex-[2] py-3 px-4 bg-white text-black font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 uppercase tracking-wide"
                    style={{boxShadow: '0 0 20px rgba(255,255,255,0.4)'}}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {loading ? 'Processando...' : 'Gerar'}
                  </button>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm flex items-start gap-3" style={{backdropFilter: 'blur(10px)'}}>
                    <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ÁREA DA IMAGEM */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative min-h-[500px]">
              {loading ? (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" style={{boxShadow: '0 0 20px rgba(255,255,255,0.4)'}}></div>
                  <p className="text-white/80 text-base font-light tracking-wide animate-pulse">{progressText}</p>
                </div>
              ) : generatedImage ? (
                <div className="w-full max-w-4xl space-y-6">
                  <div className="relative group">
                    <img 
                      src={generatedImage} 
                      alt="Generated" 
                      className="w-full h-auto object-contain rounded-lg"
                      style={{boxShadow: '0 0 30px rgba(255,255,255,0.3)'}}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-white/20" style={{backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255,255,255,0.05)'}}>
                    <div className="text-sm text-white/80 font-light">
                      <p>Gerado em <strong className="text-white font-semibold">{generationTime}s</strong></p>
                    </div>
                    <button 
                      onClick={downloadImage} 
                      className="px-6 py-2 border border-white/40 hover:border-white/70 rounded-lg text-white text-sm flex items-center gap-2 transition-all font-semibold uppercase tracking-wide"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-6 flex flex-col items-center">
                  <div className="w-32 h-32 border-2 border-dashed border-white/40 rounded-lg flex items-center justify-center text-6xl" style={{backdropFilter: 'blur(10px)'}}>
                    🎨
                  </div>
                  <div>
                    <p className="text-xl font-light text-white/80">Sua imagem aparecerá aqui</p>
                    <p className="text-sm text-gray-500 mt-2">Descreva seu cenário acima</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SignedIn>
      </div>

      {/* ESTILOS */}
      <style jsx>{`
        @keyframes infinite-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .animate-infinite-scroll {
          animation: infinite-scroll 20s linear infinite;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-fadeIn {
          animation: fadeIn 1s ease-out;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  );
}
