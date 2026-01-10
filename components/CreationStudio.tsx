import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import Generated3DObject from './Generated3DObject';
import { generateFromPrompt } from '../lib/generators/sceneComposer';
import { ParsedPrompt, ThemeCategory } from '../lib/generators/types';
import {
  getTemplatesByCategory,
  getFeaturedTemplates,
  getRandomTemplate,
} from '../lib/creation-templates';
import { useJourney } from './contexts/JourneyContext';

interface CreationStudioProps {
  onClose?: () => void;
}

export default function CreationStudio({ onClose }: CreationStudioProps) {
  const [prompt, setPrompt] = useState('');
  const [generatedConfig, setGeneratedConfig] = useState<ParsedPrompt | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ThemeCategory | 'all'>('all');
  const [showTemplates, setShowTemplates] = useState(false);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  const { updateCreationProgress, unlockAchievement } = useJourney();

  // Load a random template on mount
  useEffect(() => {
    const template = getRandomTemplate('horror');
    if (template.baseConfig) {
      setGeneratedConfig(template.baseConfig as ParsedPrompt);
      setPrompt(template.suggestedPrompts?.[0] || template.description);
    }
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateFromPrompt(prompt, false);

      if (result.success) {
        setGeneratedConfig(result.config);
        setProcessingTime(result.processingTime || null);

        // Update quest progress
        updateCreationProgress('generated', 1);

        // Check for first creation achievement
        unlockAchievement('first-creation');

        // Check horror level achievement
        if (result.config.horrorLevel >= 7) {
          unlockAchievement('nightmare-architect');
        }
      } else {
        setError(result.error || 'Generation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTemplateSelect = (template: any) => {
    setGeneratedConfig(template.baseConfig as ParsedPrompt);
    setPrompt(template.suggestedPrompts?.[0] || template.description);
    setShowTemplates(false);

    // Track template usage
    updateCreationProgress('template_used', 1);
  };

  const handleRandomize = () => {
    const template = getRandomTemplate(
      selectedCategory === 'all' ? undefined : selectedCategory
    );
    handleTemplateSelect(template);
  };

  const handleSave = () => {
    if (!generatedConfig) return;

    // Save to localStorage
    const saved = localStorage.getItem('saved-creations');
    const creations = saved ? JSON.parse(saved) : [];

    const newCreation = {
      id: Date.now().toString(),
      name: prompt.slice(0, 50),
      prompt,
      config: generatedConfig,
      createdAt: new Date().toISOString(),
    };

    creations.push(newCreation);
    localStorage.setItem('saved-creations', JSON.stringify(creations));

    // Track save
    updateCreationProgress('saved', 1);
    unlockAchievement('creation-saved');

    alert('Creation saved to gallery!');
  };

  const categories: Array<{ id: ThemeCategory | 'all'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'horror', label: 'Horror' },
    { id: 'editorial', label: 'Editorial' },
    { id: 'hybrid', label: 'Hybrid' },
    { id: 'cinematic', label: 'Cinematic' },
  ];

  const featuredTemplates = getFeaturedTemplates();

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg max-w-6xl w-full h-[90vh] flex flex-col border border-cyan-500/30 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/30">
          <div>
            <h2 className="text-2xl font-bold text-cyan-400">Creation Studio</h2>
            <p className="text-sm text-gray-400">Generate 3D objects from your imagination</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl px-3 py-1"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Panel - Controls */}
          <div className="w-full md:w-1/3 p-6 border-r border-cyan-500/20 overflow-y-auto">
            {/* Prompt Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-cyan-300 mb-2">
                Describe your creation
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A twisted gothic cathedral with glowing stained glass..."
                className="w-full h-24 px-3 py-2 bg-gray-800 border border-cyan-500/30 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleGenerate();
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">Press Ctrl+Enter to generate</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
              <button
                onClick={handleRandomize}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                title="Random template"
              >
                🎲
              </button>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                title="Browse templates"
              >
                📁
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Processing Time */}
            {processingTime !== null && (
              <div className="mb-4 p-2 bg-green-900/20 border border-green-500/30 rounded text-green-300 text-xs">
                Generated in {processingTime}ms
              </div>
            )}

            {/* Category Filters */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-cyan-300 mb-2">Style</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Browser */}
            {showTemplates && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-cyan-300 mb-3">Featured Templates</h3>
                <div className="space-y-2">
                  {featuredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors"
                    >
                      <div className="font-medium text-white text-sm">{template.name}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {template.description}
                      </div>
                      <div className="flex gap-1 mt-2">
                        <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">
                          {template.category}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Current Config Info */}
            {generatedConfig && (
              <div className="mt-auto pt-4 border-t border-cyan-500/20">
                <h3 className="text-sm font-medium text-cyan-300 mb-2">Details</h3>
                <div className="space-y-1 text-xs text-gray-400">
                  <div>Shape: <span className="text-white">{generatedConfig.baseShape}</span></div>
                  <div>Theme: <span className="text-white">{generatedConfig.theme}</span></div>
                  <div>Horror: <span className="text-white">{generatedConfig.horrorLevel}/10</span></div>
                  <div>Complexity: <span className="text-white">{generatedConfig.complexity}/10</span></div>
                </div>
              </div>
            )}

            {/* Save Button */}
            {generatedConfig && (
              <button
                onClick={handleSave}
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium transition-colors"
              >
                💾 Save to Gallery
              </button>
            )}
          </div>

          {/* Right Panel - 3D Preview */}
          <div className="flex-1 relative bg-black">
            {generatedConfig ? (
              <Canvas shadows>
                <PerspectiveCamera makeDefault position={[0, 2, 5]} />

                <Suspense fallback={null}>
                  <Generated3DObject config={generatedConfig} />
                </Suspense>

                {/* Environment fog */}
                {generatedConfig.atmosphere?.fog && (
                  <fog
                    attach="fog"
                    args={[
                      generatedConfig.atmosphere.fog.color,
                      generatedConfig.atmosphere.fog.near,
                      generatedConfig.atmosphere.fog.far,
                    ]}
                  />
                )}

                {/* Base lighting */}
                <ambientLight intensity={0.3} />
                <directionalLight position={[5, 5, 5]} intensity={0.5} />

                {/* Ground */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
                  <planeGeometry args={[20, 20]} />
                  <meshStandardMaterial color="#111111" roughness={0.8} />
                </mesh>

                <OrbitControls
                  enablePan={false}
                  minDistance={2}
                  maxDistance={10}
                  maxPolarAngle={Math.PI / 2}
                />
              </Canvas>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                <div className="text-center">
                  <p className="text-lg mb-2">No creation yet</p>
                  <p className="text-sm">Enter a prompt and click Generate</p>
                </div>
              </div>
            )}

            {/* Camera Controls Hint */}
            <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 px-3 py-2 rounded text-xs text-gray-400">
              🖱️ Drag to rotate • Scroll to zoom
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
