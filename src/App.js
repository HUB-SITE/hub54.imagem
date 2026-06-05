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

  // Partículas Neurais
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: 20 + Math.random() * 20,
      delay: Math.random() * 5,
      size: Math.random() * 3 + 1,
    }));
    setParticles(newParticles);
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

  // Imagens exemplo para o carrossel
  const exemploImagens = [
    '🎨',
    '🌌',
    '🏙️',
    '🌊',
    '🌲',
    '🚀',
    '💎',
    '🔥',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a12] via-[#1a0033] to-[#0f0a1f] text-gray-300 font-sans overflow-hidden">
      
      {/* BACKGROUND ANIMADO COM PARTÍCULAS NEURAIS */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Gradientes de fundo */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full filter blur-3xl animate-blob"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/20 rounded-full filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-600/10 rounded-full filter blur-3xl animate-blob animation-delay-4000"></div>

        {/* Partículas Neurais */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-cyan-400/30 glow-particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animation: `float ${particle.duration}s ease-in-out ${particle.delay}s infinite`,
              boxShadow: `0 0 ${particle.size * 4}px rgba(0, 217, 255, 0.6)`,
            }}
          ></div>
        ))}

        {/* Linhas Neurais */}
        <svg className="absolute inset-0 w-full h-full opacity-20" style={{animation: 'pulse 3s ease-in-out infinite'}}>
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00d9ff" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <line x1="10%" y1="20%" x2="80%" y2="70%" stroke="url(#gradient)" strokeWidth="1" opacity="0.3" />
          <line x1="80%" y1="20%" x2="20%" y2="80%" stroke="url(#gradient)" strokeWidth="1" opacity="0.3" />
        </svg>
      </div>

      {/* HEADER CENTRALIZADO FLUTUANTE */}
      <header className="relative z-20 backdrop-blur-xl bg-white/5 border-b border-cyan-500/20 py-8 px-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex-1"></div>
          <div className="flex-1 text-center">
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-400 to-cyan-300 drop-shadow-2xl tracking-wider">
              HU.54
            </h1>
            <p className="text-lg text-cyan-300/80 font-light tracking-widest mt-1">ImAgem 1.0</p>
          </div>
          <div className="flex-1 flex justify-end">
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      {/* SE NÃO ESTIVER LOGADO */}
      <SignedOut>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 min-h-screen">
          <div className="text-center space-y-8 max-w-2xl">
            <div className="space-y-4">
              <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">
                Crie Cenários Premium
              </h2>
              <p className="text-xl text-gray-400 font-light">
                Para seus produtos com IA generativa de última geração
              </p>
            </div>

            {/* CARROSSEL INFINITO - PREVIEW */}
            <div className="py-12 overflow-hidden">
              <div className="flex animate-infinite-scroll gap-8">
                {[...exemploImagens, ...exemploImagens].map((emoji, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-32 h-32 bg-gradient-to-br from-purple-600/30 to-cyan-600/30 rounded-2xl flex items-center justify-center text-6xl backdrop-blur-sm border border-cyan-500/30 hover:border-cyan-500/60 transition-all hover:scale-110 hover:shadow-2xl hover:shadow-cyan-500/50"
                  >
                    {emoji}
                  </div>
                ))}
              </div>
            </div>

            <SignInButton mode="modal">
              <button className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all shadow-lg shadow-cyan-500/50 text-lg">
                Começar Agora
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      {/* SE ESTIVER LOGADO */}
      <SignedIn>
        <div className="relative z-10 flex flex-col lg:flex-row min-h-[calc(100vh-120px)]">
          
          {/* PAINEL ESQUERDO */}
          <div className="w-full lg:w-[420px] bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl border-r border-cyan-500/20 p-8 overflow-y-auto max-h-[calc(100vh-120px)] custom-scrollbar">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400 mb-8">
              Criar Imagem
            </h2>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-cyan-300/70 font-semibold uppercase tracking-wider">
                  <span className="text-cyan-400">✨</span> Prompt
                  <span className="text-red-500">*</span> 
                </label>
                <textarea 
                  value={prompt} 
                  onChange={(e) => setPrompt(e.target.value)} 
                  className="w-full bg-white/10 border border-cyan-500/30 rounded-lg p-4 text-white focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all resize-none h-28 placeholder-gray-500 backdrop-blur-sm"
                  placeholder="Descreva o cenário que deseja criar..." 
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-cyan-300/70 font-semibold uppercase tracking-wider">
                  <span className="text-purple-400">📸</span> Imagem Base
                </label>
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full border border-dashed border-cyan-500/40 hover:border-cyan-500/70 rounded-lg p-6 text-center cursor-pointer transition-all bg-white/5 hover:bg-white/10 group"
                >
                  <p className="text-sm text-cyan-300/70 group-hover:text-cyan-300">📄 Clique ou arraste uma imagem</p>
                  {inputImage && <p className="text-xs text-green-400 mt-2 font-semibold">✅ Imagem carregada</p>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-cyan-300/70 font-semibold uppercase tracking-wider">
                  <span className="text-purple-400">⊞</span> Proporção
                </label>
                <select 
                  value={aspectRatio} 
                  onChange={(e) => setAspectRatio(e.target.value)} 
                  className="w-full bg-white/10 border border-cyan-500/30 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all backdrop-blur-sm"
                >
                  <option value="1:1">1:1 (Quadrado)</option>
                  <option value="16:9">16:9 (Paisagem)</option>
                  <option value="9:16">9:16 (Stories/Reels)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-6 border-t border-cyan-500/20">
                <button 
                  onClick={resetInputs} 
                  disabled={loading} 
                  className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 text-cyan-300 border border-cyan-500/40 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wide disabled:opacity-50 backdrop-blur-sm"
                >
                  <RotateCcw className="w-4 h-4" /> Limpar
                </button>
                <button 
                  onClick={generateImage} 
                  disabled={loading || !prompt} 
                  className="flex-[2] py-3 px-4 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 shadow-lg shadow-cyan-500/30 uppercase tracking-wide"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {loading ? 'Processando...' : 'Gerar'}
                </button>
              </div>

              {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm flex items-start gap-3 backdrop-blur-sm">
                  <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* ÁREA DA IMAGEM */}
          <div className="flex-1 bg-gradient-to-br from-transparent to-white/5 backdrop-blur-sm flex flex-col items-center justify-center p-8 relative min-h-[500px]">
            {loading ? (
              <div className="text-center space-y-6">
                <div className="w-20 h-20 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mx-auto drop-shadow-2xl"></div>
                <p className="text-cyan-300/80 text-base font-light tracking-wide animate-pulse">{progressText}</p>
              </div>
            ) : generatedImage ? (
              <div className="w-full max-w-4xl space-y-6">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-all"></div>
                  <img 
                    src={generatedImage} 
                    alt="Generated" 
                    className="relative w-full h-auto object-contain rounded-2xl shadow-2xl bg-black border border-cyan-500/30 hover:border-cyan-500/60 transition-all"
                  />
                </div>
                <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-cyan-500/30">
                  <div className="text-sm text-cyan-300/80 font-light">
                    <p>Gerado em <strong className="text-cyan-300 font-semibold">{generationTime}s</strong></p>
                  </div>
                  <button 
                    onClick={downloadImage} 
                    className="px-6 py-2 bg-gradient-to-r from-cyan-500/30 to-purple-600/30 hover:from-cyan-500/50 hover:to-purple-600/50 border border-cyan-500/50 rounded-lg text-cyan-300 text-sm flex items-center gap-2 transition-all font-semibold uppercase tracking-wide backdrop-blur-sm"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-6 flex flex-col items-center">
                <div className="w-32 h-32 border-2 border-dashed border-cyan-500/40 rounded-2xl flex items-center justify-center text-6xl bg-white/5 backdrop-blur-sm group hover:border-cyan-500/70 transition-all">
                  <span className="group-hover:scale-125 transition-transform">🎨</span>
                </div>
                <div>
                  <p className="text-xl font-light text-cyan-300/80">Sua imagem aparecerá aqui</p>
                  <p className="text-sm text-gray-500 mt-2">Descreva seu cenário ideal acima</p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* CARROSSEL INFINITO - INSPIRAÇÃO */}
        <div className="relative z-10 border-t border-cyan-500/20 backdrop-blur-xl bg-white/5 py-8 overflow-hidden">
          <p className="text-center text-cyan-300/60 text-xs uppercase tracking-widest mb-6 font-semibold">Galeria de Inspiração</p>
          <div className="flex animate-infinite-scroll gap-6 px-8">
            {[...exemploImagens, ...exemploImagens, ...exemploImagens].map((emoji, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-28 h-28 bg-gradient-to-br from-cyan-600/20 to-purple-600/20 rounded-xl flex items-center justify-center text-4xl backdrop-blur-sm border border-cyan-500/30 hover:border-cyan-500/60 transition-all hover:scale-110 hover:shadow-xl hover:shadow-cyan-500/30"
              >
                {emoji}
              </div>
            ))}
          </div>
        </div>
      </SignedIn>

      {/* ESTILOS CUSTOMIZADOS */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-40px) translateX(-10px); }
          75% { transform: translateY(-20px) translateX(10px); }
        }

        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }

        @keyframes infinite-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animate-infinite-scroll {
          animation: infinite-scroll 30s linear infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .glow-particle {
          filter: drop-shadow(0 0 8px rgba(0, 217, 255, 0.8));
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 217, 255, 0.3);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 217, 255, 0.6);
        }

        .gap-8 > * + * {
          margin-left: 32px;
        }

        .gap-6 > * + * {
          margin-left: 24px;
        }
      `}</style>
    </div>
  );
}
