import React, { useState, useRef } from 'react';
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

      // ⚠️ ATENÇÃO: COLOQUE A SUA URL DO RENDER AQUI ⚠️
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
        
        // ⚠️ ATENÇÃO: COLOQUE A SUA URL DO RENDER AQUI TAMBÉM ⚠️
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

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-300 font-sans flex flex-col">
      
      {/* CABEÇALHO */}
      <header className="w-full p-4 border-b border-gray-800 flex justify-between items-center bg-[#121214]">
        <h1 className="text-xl font-bold text-white">HUB.54 ImAgem 1.0</h1>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>

      {/* SE NÃO ESTIVER LOGADO */}
      <SignedOut>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <h2 className="text-3xl font-bold text-white mb-4">Crie cenários premium para seus produtos</h2>
          <p className="text-gray-400 mb-8 text-center max-w-md">Faça login para acessar o gerador de imagens com inteligência artificial.</p>
          <SignInButton mode="modal">
            <button className="px-6 py-3 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition-colors">
              Fazer Login / Cadastrar
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      {/* SE ESTIVER LOGADO */}
      <SignedIn>
        <div className="flex-1 flex flex-col lg:flex-row">
          
          {/* PAINEL ESQUERDO */}
          <div className="w-full lg:w-[400px] xl:w-[450px] bg-[#121214] border-r border-gray-800 p-6 overflow-y-auto max-h-screen custom-scrollbar">
            <h2 className="text-xl font-bold text-white mb-6">Criar Imagem</h2>

            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <span className="text-white">T</span> prompt <span className="text-red-500">*</span> 
                </label>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full bg-[#1c1c1f] border border-gray-700 rounded-md p-3 text-white focus:outline-none focus:border-white transition-colors resize-none h-24" placeholder="Descreva o cenário..." />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <span className="text-white">📄</span> input_images <span className="text-xs font-mono text-gray-500">file[]</span>
                </label>
                <div onClick={() => fileInputRef.current?.click()} className="w-full border border-dashed border-gray-700 hover:border-gray-500 rounded-md p-4 text-center cursor-pointer transition-colors bg-[#1c1c1f]">
                  <p className="text-sm text-gray-400">📄 Adicionar arquivo base</p>
                  {inputImage && <p className="text-xs text-green-400 mt-2">✅ Imagem carregada</p>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <span className="text-white">≡</span> aspect_ratio
                </label>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-[#1c1c1f] border border-gray-700 rounded-md p-2 text-white focus:outline-none">
                  <option value="1:1">1:1 (Quadrado)</option>
                  <option value="16:9">16:9 (Paisagem)</option>
                  <option value="9:16">9:16 (Stories/Reels)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button onClick={resetInputs} disabled={loading} className="flex-1 py-2 px-4 bg-[#1c1c1f] hover:bg-gray-800 text-white border border-gray-700 rounded-md transition-colors flex items-center justify-center gap-2 text-sm">
                  <RotateCcw className="w-4 h-4" /> Resetar
                </button>
                <button onClick={generateImage} disabled={loading || !prompt} className="flex-[2] py-2 px-4 bg-white hover:bg-gray-200 text-black font-semibold rounded-md transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {loading ? 'Processando...' : 'Run (Gerar)'}
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-900/50 rounded-md text-red-400 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* ÁREA DA IMAGEM */}
          <div className="flex-1 bg-[#09090b] flex flex-col items-center justify-center p-8 relative min-h-[500px]">
            {loading ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-gray-800 border-t-white rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-400 text-sm animate-pulse">{progressText}</p>
              </div>
            ) : generatedImage ? (
              <div className="w-full max-w-4xl space-y-4">
                <img src={generatedImage} alt="Generated" className="w-full h-auto object-contain rounded-lg shadow-2xl bg-black border border-gray-800" />
                <div className="flex items-center justify-between bg-[#121214] p-4 rounded-lg border border-gray-800">
                  <div className="text-sm text-gray-400">
                    <p>Gerado em <strong className="text-white">{generationTime} segundos</strong></p>
                  </div>
                  <button onClick={downloadImage} className="px-4 py-2 bg-[#1c1c1f] hover:bg-gray-800 border border-gray-700 rounded-md text-white text-sm flex items-center gap-2 transition-colors">
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-gray-600 text-center space-y-4 flex flex-col items-center">
                <div className="w-24 h-24 border-2 border-dashed border-gray-700 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-4xl text-gray-700">🖼️</span>
                </div>
                <p className="text-lg">Sua imagem aparecerá aqui</p>
              </div>
            )}
          </div>

        </div>
      </SignedIn>
      
    </div>
  );
}