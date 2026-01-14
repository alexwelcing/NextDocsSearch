import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Wand, Box, Download, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';

interface Creation {
  id: string;
  name: string;
  url: string;
  type: 'image' | '3d';
  createdAt: string;
}

const TEMPLATES = [
  { id: 'hero', label: 'Fantasy Hero', prompt: 'A heroic fantasy character, full body, detailed armor, epic pose, 8k, concept art' },
  { id: 'cyberpunk', label: 'Cyberpunk Citizen', prompt: 'Cyberpunk street samurai, neon lights, rainy city background, futuristic clothing, high detail' },
  { id: 'creature', label: 'Cute Creature', prompt: 'A cute magical creature, fluffy, big eyes, glowing forest background, 3d render style' },
  { id: 'monster', label: 'Dungeon Monster', prompt: 'A terrifying dungeon monster, scales, claws, dark lighting, menacing, cinematic' },
  { id: 'scifi-prop', label: 'Sci-Fi Prop', prompt: 'A futuristic sci-fi gadget, sleek design, glowing interface, isolated on dark background, product shot' },
  { id: 'fantasy-prop', label: 'Magic Item', prompt: 'A magical artifact, glowing crystals, ancient runes, mystical aura, floating' },
];

function ModelViewer({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default function SuperStudio() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultType, setResultType] = useState<'image' | '3d'>('image');
  const [error, setError] = useState<string | null>(null);
  const [creations, setCreations] = useState<Creation[]>([]);
  const [mode, setMode] = useState<'image' | '3d'>('image');
  const [statusMessage, setStatusMessage] = useState('');

  // Fetch existing creations
  useEffect(() => {
    fetchCreations();
  }, []);

  const fetchCreations = async () => {
    const { data, error } = await supabase.storage.from('threesixty').list('creations', {
      limit: 20,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) {
      console.error('Error fetching creations:', error);
    } else if (data) {
      const formatted: Creation[] = data.map(file => ({
        id: file.id,
        name: file.name,
        url: supabase.storage.from('threesixty').getPublicUrl(`creations/${file.name}`).data.publicUrl,
        type: file.metadata?.mimetype?.includes('model') || file.name.endsWith('.glb') ? '3d' : 'image',
        createdAt: file.created_at,
      }));
      setCreations(formatted);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setResultUrl(null);
    setStatusMessage('Dreaming up your concept...');

    try {
      // Step 1: Generate Image (Always needed, even for 3D)
      const imageResponse = await fetch('/api/fal/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          model: 'fal-ai/fast-sdxl' 
        }),
      });

      const imageData = await imageResponse.json();

      if (!imageResponse.ok) {
        throw new Error(imageData.message || 'Image generation failed');
      }

      if (!imageData.images || !imageData.images[0]) {
        throw new Error('No image returned from API');
      }

      const imageUrl = imageData.images[0].url;

      if (mode === 'image') {
        setResultUrl(imageUrl);
        setResultType('image');
        await saveToSupabase(imageUrl, prompt, 'image');
      } else {
        // Step 2: Generate 3D from Image
        setStatusMessage('Sculpting 3D model (this takes a moment)...');
        const threeDResponse = await fetch('/api/fal/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image_url: imageUrl,
            model: 'fal-ai/triposr' 
          }),
        });

        const threeDData = await threeDResponse.json();
        
        if (!threeDResponse.ok) {
            throw new Error(threeDData.message || '3D generation failed');
        }

        if (threeDData.model_mesh && threeDData.model_mesh.url) {
            setResultUrl(threeDData.model_mesh.url);
            setResultType('3d');
            await saveToSupabase(threeDData.model_mesh.url, prompt, '3d');
        } else {
            throw new Error('No 3D model returned');
        }
      }

    } catch (err: any) {
      if (err.message && err.message.includes('out of energy')) {
        setError("Our creative spirits are resting. Please try again later! (API Quota Exceeded)");
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  const saveToSupabase = async (url: string, promptText: string, type: 'image' | '3d') => {
    try {
      setStatusMessage('Saving to gallery...');
      // 1. Fetch the asset
      const res = await fetch(url);
      const blob = await res.blob();

      // 2. Generate filename
      const timestamp = Date.now();
      const sanitizedPrompt = promptText.slice(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const ext = type === '3d' ? 'glb' : 'jpg';
      const filename = `creations/${timestamp}_${sanitizedPrompt}.${ext}`;

      // 3. Upload
      const { error: uploadError } = await supabase.storage
        .from('threesixty')
        .upload(filename, blob, {
          contentType: type === '3d' ? 'model/gltf-binary' : 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 4. Refresh gallery
      fetchCreations();

    } catch (err) {
      console.error('Failed to save to gallery:', err);
      // We don't block the UI for this error, but we log it
    }
  };

  const handleTemplateClick = (t: typeof TEMPLATES[0]) => {
    setPrompt(t.prompt);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-lg">
            <Wand size={20} />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Super Studio
          </h1>
        </div>
        <div className="flex gap-2 bg-gray-900 p-1 rounded-lg border border-gray-800">
          <button 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'image' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            onClick={() => setMode('image')}
          >
            <div className="flex items-center gap-2">
              <ImageIcon size={16} />
              2D Image
            </div>
          </button>
           <button 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === '3d' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            onClick={() => setMode('3d')}
          >
            <div className="flex items-center gap-2">
              <Box size={16} />
              3D Model
            </div>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-80 md:w-96 flex flex-col border-r border-gray-800 bg-gray-900/30 overflow-y-auto p-6">
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Describe your ${mode === '3d' ? '3D object' : 'image'}...`}
              className="w-full h-32 bg-gray-950 border border-gray-800 rounded-xl p-4 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none placeholder-gray-600"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 rounded-xl font-semibold transition-all shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {statusMessage || 'Generating...'}
              </>
            ) : (
              <>
                <Wand size={18} />
                Generate {mode === '3d' ? '3D' : 'Image'}
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-950/50 border border-red-900/50 rounded-xl text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="mt-8">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Templates</h3>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateClick(t)}
                  className="p-3 text-left bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 rounded-lg transition-all group"
                >
                  <div className="text-xs font-medium text-gray-300 group-hover:text-white mb-0.5">{t.label}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col bg-gray-950 relative overflow-hidden">
          {/* Background Grid */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ 
                 backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)', 
                 backgroundSize: '40px 40px' 
               }} 
          />

          <div className="flex-1 overflow-y-auto p-8">
            {/* Active Result */}
            <div className="flex flex-col items-center justify-center min-h-[500px]">
              {resultUrl ? (
                <div className="relative group max-w-3xl w-full aspect-square md:aspect-video rounded-2xl overflow-hidden shadow-2xl border border-gray-800 bg-gray-900">
                  {resultType === 'image' ? (
                    <Image 
                      src={resultUrl} 
                      alt="Generated creation" 
                      fill
                      className="object-contain"
                    />
                  ) : (
                     <Canvas shadows camera={{ position: [2, 2, 5], fov: 50 }}>
                        <React.Suspense fallback={null}>
                            <Stage environment="city" intensity={0.6}>
                                <ModelViewer url={resultUrl} />
                            </Stage>
                            <OrbitControls makeDefault autoRotate />
                        </React.Suspense>
                     </Canvas>
                  )}
                  
                  {/* Overlay */}
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a 
                        href={resultUrl} 
                        download={`creation.${resultType === '3d' ? 'glb' : 'jpg'}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur"
                        title="Download"
                      >
                          <Download size={20} />
                      </a>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-gray-600 gap-4">
                  <div className="w-32 h-32 rounded-full bg-gray-900 flex items-center justify-center border border-gray-800">
                    <Wand size={48} className="opacity-50" />
                  </div>
                  <p className="text-lg">Ready to create. Select a template or type a prompt.</p>
                </div>
              )}
            </div>

            {/* Gallery Section */}
            <div className="mt-12">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Box size={20} className="text-purple-400" />
                Recent Creations
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {creations.map((creation) => (
                  <div 
                    key={creation.id} 
                    className="aspect-square rounded-xl bg-gray-900 border border-gray-800 overflow-hidden relative group cursor-pointer hover:border-purple-500/50 transition-all"
                    onClick={() => {
                        setResultUrl(creation.url);
                        setResultType(creation.type);
                    }}
                  >
                    {creation.type === 'image' ? (
                        <Image 
                            src={creation.url} 
                            alt={creation.name} 
                            fill
                            className="object-cover transition-transform group-hover:scale-110"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-900">
                            <Box size={32} className="mb-2 text-purple-500" />
                            <span className="text-xs">3D Model</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded">View</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}