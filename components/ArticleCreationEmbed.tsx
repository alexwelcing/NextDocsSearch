import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import Generated3DObject from './Generated3DObject';
import { parsePrompt } from '../lib/generators/promptParser';
import { findBestTemplate } from '../lib/creation-templates';

interface ArticleCreationEmbedProps {
  prompt: string;
  preset?: string;
  autoRotate?: boolean;
  allowInteraction?: boolean;
  height?: number;
}

/**
 * Embeddable 3D creation viewer for MDX articles
 *
 * Usage in MDX:
 * <ArticleCreationEmbed
 *   prompt="A haunted typewriter with glowing keys"
 *   autoRotate={true}
 *   height={400}
 * />
 */
export default function ArticleCreationEmbed({
  prompt,
  preset,
  autoRotate = true,
  allowInteraction = true,
  height = 400,
}: ArticleCreationEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Generate config from prompt
  const config = React.useMemo(() => {
    if (preset) {
      const template = findBestTemplate(preset);
      if (template?.baseConfig) {
        return template.baseConfig;
      }
    }
    return parsePrompt(prompt);
  }, [prompt, preset]);

  return (
    <div className="my-8">
      <div
        className={`relative bg-black rounded-lg overflow-hidden border border-gray-700 ${
          isExpanded ? 'fixed inset-4 z-50' : ''
        }`}
        style={{ height: isExpanded ? 'auto' : `${height}px` }}
      >
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[0, 2, 5]} />

          <Suspense fallback={null}>
            <Generated3DObject config={config as any} />
          </Suspense>

          {/* Environment fog */}
          {config.atmosphere?.fog && (
            <fog
              attach="fog"
              args={[
                config.atmosphere.fog.color,
                config.atmosphere.fog.near,
                config.atmosphere.fog.far,
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

          {allowInteraction && (
            <OrbitControls
              autoRotate={autoRotate}
              autoRotateSpeed={1}
              enablePan={false}
              minDistance={2}
              maxDistance={10}
              maxPolarAngle={Math.PI / 2}
            />
          )}
        </Canvas>

        {/* Controls */}
        <div className="absolute top-3 right-3 flex gap-2">
          {allowInteraction && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="bg-black bg-opacity-70 hover:bg-opacity-90 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              {isExpanded ? '✕' : '⛶'}
            </button>
          )}
        </div>

        {/* Caption */}
        <div className="absolute bottom-3 left-3 right-3 bg-black bg-opacity-70 px-3 py-2 rounded text-sm text-gray-300">
          {prompt}
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-2 text-sm text-gray-500 text-center">
        <span className="capitalize">{config.theme}</span> •{' '}
        <span>{config.baseShape}</span> •{' '}
        <span>Complexity: {config.complexity}/10</span>
      </div>
    </div>
  );
}

interface CreationGalleryProps {
  articleId?: string;
  theme?: 'dark' | 'light';
  userSubmissions?: boolean;
}

/**
 * Gallery of user-created 3D objects
 *
 * Usage in MDX:
 * <CreationGallery
 *   articleId="horror-typography"
 *   theme="dark"
 *   userSubmissions={true}
 * />
 */
export function CreationGallery({
  articleId,
  theme = 'dark',
  userSubmissions = false,
}: CreationGalleryProps) {
  const [creations, setCreations] = useState<any[]>([]);

  React.useEffect(() => {
    // Load saved creations from localStorage
    const saved = localStorage.getItem('saved-creations');
    if (saved) {
      const allCreations = JSON.parse(saved);
      // Filter by article if specified
      const filtered = articleId
        ? allCreations.filter((c: any) => c.articleId === articleId)
        : allCreations;
      setCreations(filtered.slice(0, 6)); // Show max 6
    }
  }, [articleId]);

  if (creations.length === 0) {
    return (
      <div className="my-8 p-8 bg-gray-900 rounded-lg border border-gray-700 text-center">
        <p className="text-gray-400">No creations yet. Be the first to create!</p>
      </div>
    );
  }

  return (
    <div className="my-8">
      <h3 className="text-xl font-bold mb-4 text-white">Community Creations</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {creations.map((creation) => (
          <div
            key={creation.id}
            className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden"
          >
            <div className="h-48 bg-black relative">
              <Canvas>
                <PerspectiveCamera makeDefault position={[0, 2, 5]} />
                <Suspense fallback={null}>
                  <Generated3DObject config={creation.config} />
                </Suspense>
                <ambientLight intensity={0.3} />
                <directionalLight position={[5, 5, 5]} intensity={0.5} />
                <OrbitControls
                  autoRotate
                  autoRotateSpeed={2}
                  enableZoom={false}
                  enablePan={false}
                />
              </Canvas>
            </div>
            <div className="p-3">
              <p className="text-sm text-white font-medium truncate">{creation.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(creation.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Prompt suggestion button for articles
 */
export function PromptSuggestion({ theme = 'horror' }: { theme?: string }) {
  const suggestions = {
    horror: [
      'A spectral orb floating in darkness',
      'A twisted dead tree with glowing eyes',
      'A cursed monolith pulsing with red energy',
    ],
    editorial: [
      'A floating quote block with soft lighting',
      'A 3D headline with bold typography',
      'A glowing data visualization column',
    ],
    hybrid: [
      'Typography that bleeds ink into shadows',
      'A haunted newspaper with spectral text',
      'A glitching data visualization',
    ],
  };

  const [selectedPrompt, setSelectedPrompt] = useState('');

  const prompts = suggestions[theme as keyof typeof suggestions] || suggestions.horror;

  const handleTryIt = () => {
    // Open Creation Studio with this prompt
    window.dispatchEvent(
      new CustomEvent('open-creation-studio', {
        detail: { prompt: selectedPrompt },
      })
    );
  };

  return (
    <div className="my-8 p-6 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-500/30">
      <h3 className="text-lg font-bold text-purple-300 mb-3">Try Creating Your Own</h3>
      <p className="text-gray-300 mb-4">Select a prompt to get started:</p>

      <div className="space-y-2 mb-4">
        {prompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => setSelectedPrompt(prompt)}
            className={`w-full text-left p-3 rounded transition-colors ${
              selectedPrompt === prompt
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {prompt}
          </button>
        ))}
      </div>

      <button
        onClick={handleTryIt}
        disabled={!selectedPrompt}
        className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors"
      >
        Open Creation Studio
      </button>
    </div>
  );
}
