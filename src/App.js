import React, { useState, useRef } from 'react';
import { Download, Play, RotateCcw, AlertTriangle, Loader2, Image as ImageIcon, PlusSquare, CreditCard } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from "@clerk/clerk-react";

export default function App() {
  const { userId } = useAuth();
  
  const [activeTab, setActiveTab] = useState('gerar');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [inputImage, setInputImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progressText, setProgressText] = useState('');
  const [generationTime, setGenerationTime] = useState(null);
  
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) setInputImage(e.target.files[0]);
  };

  const resetInputs = () => {
    setPrompt('');
    setInputImage(null);
    setGeneratedImage(null);
    setError(null);
    setGenerationTime(null);
  };

  const generateImage = async () => {
    if (!prompt) { setError('O campo prompt é obrigatório.'); return; }
    if (!userId) { setError('Você precisa estar logado.'); return; }

    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    setProgressText('Iniciando...');
    const startTime = Date.now();

    try {
      const response = await fetch('https://backend-gerador-ia.onrender.com/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { prompt, aspect_ratio: aspectRatio }, userId }),
      });

      if (!response.ok) throw new Error(`Erro: ${response.status}`);
      let prediction = await response.json();
      setProgressText('Gerando...');

      while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const res = await fetch(`https://backend-gerador-ia.onrender.com/api/status/${prediction.id}`);
        prediction = await res.json();
      }
      
      if (prediction.status === 'succeeded') {
        setGeneratedImage(Array.isArray(prediction.output) ? prediction.output[0] : prediction.output);
        setGenerationTime(((Date.now() - startTime) / 1000).toFixed(1));
      } else throw new Error('Falha na geração.');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const downloadImage = async () => {
    if (!generatedImage) return;
    const response = await fetch(generatedImage);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hub54-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex">
      <SignedOut>
        <div className="w-full flex items-center justify-center">
            <SignInButton mode="modal"><button className="px-10 py-3 border border-white rounded-lg">Entrar no Hub</button></SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <aside className="w-64 border-r border-white/10 flex flex-col backdrop-blur-xl bg-white/5">
          <div className="p-8"><h1 className="text-xl font-black">HUB IA 54</h1></div>
          <nav className="flex-1 p-4 space-y-2">
            <button onClick={() => setActiveTab('gerar')} className={`w-full flex items-center gap-3 p-3 rounded-lg ${activeTab === 'gerar' ? 'bg-white text-black' : 'hover:bg-white/10'}`}>
              <PlusSquare className="w-5 h-5" /> NOVA GERAÇÃO
            </button>
            <button onClick={() => setActiveTab('historico')} className={`w-full flex items-center gap-3 p-3 rounded-lg ${activeTab === 'historico' ? 'bg-white text-black' : 'hover:bg-white/10'}`}>
              <ImageIcon className="w-5 h-5" /> HISTÓRICO
            </button>
          </nav>
          <div className="p-4 border-t border-white/10"><UserButton /></div>
        </aside>

        <main className="flex-1 p-10 overflow-y-auto">
          {activeTab === 'gerar' ? (
            <div className="max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Painel de Controle */}
              <div className="space-y-6">
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg p-4 h-32" placeholder="Descreva sua arte..." />
                <div onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-white/20 p-6 text-center cursor-pointer">
                  {inputImage ? "✅ Imagem selecionada" : "📄 Clique para upload"}
                </div>
                <input ref={fileInputRef} type="file" onChange={handleImageUpload} className="hidden" />
                <div className="flex gap-4">
                  <button onClick={resetInputs} className="flex-1 py-3 border border-white/20 rounded-lg">Limpar</button>
                  <button onClick={generateImage} disabled={loading} className="flex-[2] py-3 bg-white text-black font-bold rounded-lg flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="animate-spin" /> : <Play />} Gerar
                  </button>
                </div>
              </div>
              {/* Exibição */}
              <div className="flex items-center justify-center border border-white/10 rounded-lg min-h-[400px]">
                {loading ? <Loader2 className="animate-spin w-10 h-10" /> : generatedImage ? <img src={generatedImage} className="max-h-[500px] rounded" /> : "Aguardando..."}
              </div>
            </div>
          ) : (
            <div className="text-2xl font-bold">Histórico (Em construção)</div>
          )}
        </main>
      </SignedIn>
    </div>
  );
}
