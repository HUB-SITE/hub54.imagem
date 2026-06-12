import React, { useState, useRef, useEffect } from 'react';
import { Download, Play, RotateCcw, AlertTriangle, Loader2, Image as ImageIcon, PlusSquare, CreditCard } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from "@clerk/clerk-react";

export default function App() {
  const { userId } = useAuth(); 
  
  // Controle de qual tela está aberta ('gerar' ou 'historico')
  const [activeTab, setActiveTab] = useState('gerar');

  // ... (Mantenha todos os seus outros estados aqui: prompt, inputImage, generatedImage, loading, etc.) ...

  const canvasRef = useRef(null);

  // ... (Mantenha as suas funções generateImage, handleImageUpload, resetInputs, downloadImage aqui) ...

  const letters = ['H', 'U', 'B', 'I', 'M', 'A', 'G', 'E', 'M', '5', '4'];

  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-hidden flex">
      
      {/* CANVAS REDE NEURAL (Fundo animado) */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full pointer-events-none"
      />

      <SignedOut>
        {/* ... (Mantenha a sua tela de SignedOut exatamente como já está) ... */}
      </SignedOut>

      <SignedIn>
        {/* HEADER FLUTUANTE (UserButton) */}
        <header className="fixed top-0 right-0 z-50 p-6">
          <UserButton />
        </header>

        {/* MENU LATERAL - EFEITO VIDRO JATEADO (Glassmorphism) */}
        <aside 
          className="relative z-20 w-64 h-screen border-r border-white/10 flex flex-col"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)', // Fundo translúcido
            backdropFilter: 'blur(16px)', // Efeito Gaussian Blur (Jateado)
            boxShadow: '10px 0 30px rgba(0, 0, 0, 0.5)' // Sombra para separar do fundo
          }}
        >
          {/* Logo / Título no Menu */}
          <div className="p-8 border-b border-white/10">
            <h1 className="text-2xl font-black tracking-tighter text-white drop-shadow-md" style={{textShadow: '0 0 20px rgba(255,255,255,0.3)'}}>
              HUB IA 54
            </h1>
          </div>

          {/* Navegação */}
          <nav className="flex-1 p-4 space-y-2 mt-4">
            <button
              onClick={() => setActiveTab('gerar')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-semibold tracking-wide text-sm ${
                activeTab === 'gerar' 
                  ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' 
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <PlusSquare className="w-5 h-5" />
              NOVA GERAÇÃO
            </button>

            <button
              onClick={() => setActiveTab('historico')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-semibold tracking-wide text-sm ${
                activeTab === 'historico' 
                  ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' 
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <ImageIcon className="w-5 h-5" />
              HISTÓRICO
            </button>
          </nav>

          {/* Rodapé do Menu (Ex: Saldo de Créditos) */}
          <div className="p-6 border-t border-white/10">
            <div className="p-4 rounded-xl border border-white/20 bg-white/5 flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-gray-300" />
              <div className="flex flex-col">
                <span className="text-xs text-white/50 uppercase tracking-wider">Seu Saldo</span>
                {/* Aqui você pode puxar os créditos reais do usuário depois */}
                <span className="text-sm font-bold">10 Créditos</span> 
              </div>
            </div>
          </div>
        </aside>

        {/* ÁREA DE CONTEÚDO PRINCIPAL */}
        <main className="relative z-10 flex-1 h-screen overflow-y-auto custom-scrollbar">
          
          {/* TELA 1: GERAÇÃO DE IMAGENS */}
          {activeTab === 'gerar' && (
            <div className="flex flex-col lg:flex-row min-h-screen">
              {/* Cole aqui o seu PAINEL ESQUERDO (Aquele com o textarea, select, botoes de gerar e limpar) */}
              
              {/* Cole aqui a sua ÁREA DA IMAGEM (Onde a imagem gerada ou o loading aparecem) */}
            </div>
          )}

          {/* TELA 2: HISTÓRICO DE IMAGENS (Visual de Grade Futurista) */}
          {activeTab === 'historico' && (
            <div className="p-10">
              <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Meu Histórico</h2>
              <p className="text-white/60 mb-10 font-light tracking-wide">Imagens que você já gerou com a IA.</p>
              
              {/* Grade de Imagens (Mockup visual por enquanto) */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* Exemplo de Card de Imagem no Histórico */}
                <div 
                  className="group relative rounded-xl overflow-hidden border border-white/10 transition-all hover:border-white/40"
                  style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255,255,255,0.05)' }}
                >
                  <div className="aspect-square bg-white/5 flex items-center justify-center text-white/20">
                    <span className="animate-pulse">Imagem aqui...</span>
                  </div>
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                    <p className="text-sm text-white/90 line-clamp-2">"Cachorro astronauta em marte estilo cyberpunk..."</p>
                    <button className="mt-3 px-4 py-2 bg-white text-black font-bold text-xs uppercase tracking-widest rounded transition-all hover:scale-105 w-fit">
                      Download
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>
      </SignedIn>
      
      {/* ... (Mantenha o seu <style jsx> aqui embaixo) ... */}
    </div>
  );
}
