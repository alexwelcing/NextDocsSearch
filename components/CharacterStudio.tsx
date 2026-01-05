'use client';

import React, { useState, useCallback, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { Physics } from '@react-three/cannon';
import RiggedCharacter from './RiggedCharacter';
import PhysicsGround from './3d/scene/PhysicsGround';
import {
  generateCharacter,
  CharacterGenerationResult,
} from '@/lib/generators/characterGenerator';
import { CharacterConfig, CharacterAnimationPreset } from '@/lib/generators/characterTypes';

export default function CharacterStudio() {
  const [prompt, setPrompt] = useState('a toad with a tail');
  const [character, setCharacter] = useState<CharacterConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);
  const [currentAnimation, setCurrentAnimation] = useState<string>('idle');
  const [animationSpeed, setAnimationSpeed] = useState(1.0);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [meshQuality, setMeshQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('medium');
  const [savedCharacters, setSavedCharacters] = useState<CharacterConfig[]>([]);

  useEffect(() => {
    // Load saved characters from localStorage
    const saved = localStorage.getItem('savedCharacters');
    if (saved) {
      try {
        setSavedCharacters(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved characters:', e);
      }
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result: CharacterGenerationResult = await generateCharacter({
        prompt,
        meshQuality,
        enablePhysics: true,
        interactionRadius: 2.0,
      });

      if (result.success) {
        setCharacter(result.config);
        setCurrentAnimation(result.config.defaultAnimation || 'idle');
        setGenerationTime(result.processingTime || 0);

        if (result.warnings && result.warnings.length > 0) {
          console.warn('Generation warnings:', result.warnings);
        }
      } else {
        setError(result.error || 'Generation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, meshQuality]);

  const handleSave = useCallback(() => {
    if (!character) return;

    const updated = [...savedCharacters, character];
    setSavedCharacters(updated);
    localStorage.setItem('savedCharacters', JSON.stringify(updated));
    alert(`Character "${character.name}" saved!`);
  }, [character, savedCharacters]);

  const handleLoad = useCallback((loadedCharacter: CharacterConfig) => {
    setCharacter(loadedCharacter);
    setPrompt(loadedCharacter.description);
    setCurrentAnimation(loadedCharacter.defaultAnimation || 'idle');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleGenerate();
      }
    },
    [handleGenerate]
  );

  return (
    <div className="w-full h-screen flex">
      {/* Left Panel - Controls */}
      <div className="w-80 bg-gradient-to-b from-gray-900 to-black text-white p-6 overflow-y-auto border-r border-cyan-500/20">
        <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-cyan-400 to-amber-400 bg-clip-text text-transparent">
          Character Studio
        </h1>

        {/* Prompt Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Character Description
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your character... (e.g., 'a toad with a tail', 'a dragon with wings')"
            className="w-full h-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
            disabled={isGenerating}
          />
          <p className="text-xs text-gray-400 mt-1">
            Press Ctrl+Enter to generate
          </p>
        </div>

        {/* Mesh Quality */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Mesh Quality</label>
          <select
            value={meshQuality}
            onChange={e => setMeshQuality(e.target.value as any)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            disabled={isGenerating}
          >
            <option value="low">Low (5K verts)</option>
            <option value="medium">Medium (15K verts)</option>
            <option value="high">High (40K verts)</option>
            <option value="ultra">Ultra (100K verts)</option>
          </select>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full mb-6 px-4 py-3 bg-gradient-to-r from-cyan-600 to-amber-600 hover:from-cyan-700 hover:to-amber-700 disabled:from-gray-700 disabled:to-gray-700 rounded-lg font-medium transition-all"
        >
          {isGenerating ? 'Generating...' : 'Generate Character'}
        </button>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Generation Time */}
        {generationTime !== null && (
          <div className="mb-6 p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-sm">
            Generated in {generationTime.toFixed(0)}ms
          </div>
        )}

        {/* Animation Controls */}
        {character && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Current Animation
              </label>
              <select
                value={currentAnimation}
                onChange={e => setCurrentAnimation(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              >
                {character.animations.map(anim => (
                  <option key={anim.name} value={anim.name}>
                    {anim.name.charAt(0).toUpperCase() + anim.name.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Animation Speed: {animationSpeed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={animationSpeed}
                onChange={e => setAnimationSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="showSkeleton"
                checked={showSkeleton}
                onChange={e => setShowSkeleton(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="showSkeleton" className="text-sm">
                Show Skeleton
              </label>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-sm font-medium mb-2">Character Info</h3>
              <div className="text-xs space-y-1 text-gray-400">
                <p>Name: {character.name}</p>
                <p>Type: {character.characterType}</p>
                <p>Bones: {character.skeleton.bones.length}</p>
                <p>Animations: {character.animations.length}</p>
                <p>Mass: {character.mass.toFixed(1)} kg</p>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
            >
              Save Character
            </button>
          </div>
        )}

        {/* Saved Characters Gallery */}
        {savedCharacters.length > 0 && (
          <div className="mt-6 border-t border-gray-700 pt-6">
            <h3 className="text-sm font-medium mb-3">Saved Characters</h3>
            <div className="space-y-2">
              {savedCharacters.map((char, idx) => (
                <button
                  key={idx}
                  onClick={() => handleLoad(char)}
                  className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-left text-sm border border-gray-700"
                >
                  <div className="font-medium">{char.name}</div>
                  <div className="text-xs text-gray-400 truncate">
                    {char.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Examples */}
        <div className="mt-6 border-t border-gray-700 pt-6">
          <h3 className="text-sm font-medium mb-3">Quick Examples</h3>
          <div className="space-y-2">
            {[
              'a toad with a tail',
              'a dragon with wings',
              'a robot with four arms',
              'a furry cat creature',
              'a dancing humanoid',
            ].map(example => (
              <button
                key={example}
                onClick={() => setPrompt(example)}
                className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-left text-xs border border-gray-700"
                disabled={isGenerating}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - 3D Viewport */}
      <div className="flex-1 bg-gradient-to-b from-indigo-950 to-black relative">
        <Canvas
          camera={{ position: [5, 3, 5], fov: 50 }}
          shadows
          gl={{ antialias: true }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight
              position={[10, 10, 5]}
              intensity={1}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            <pointLight position={[-10, 5, -5]} intensity={0.5} color="#ff00ff" />
            <pointLight position={[10, 5, -5]} intensity={0.5} color="#00ffff" />

            {/* Environment */}
            <Environment preset="night" />
            <fog attach="fog" args={['#0a0a1f', 10, 50]} />

            {/* Grid */}
            <Grid
              args={[20, 20]}
              cellSize={1}
              cellThickness={0.5}
              cellColor="#00d4ff"
              sectionSize={5}
              sectionThickness={1}
              sectionColor="#ffd700"
              fadeDistance={25}
              fadeStrength={1}
              followCamera={false}
              infiniteGrid={true}
            />

            {/* Physics */}
            <Physics gravity={[0, -9.81, 0]}>
              <PhysicsGround />

              {/* Character */}
              {character && (
                <RiggedCharacter
                  config={character}
                  currentAnimation={currentAnimation}
                  animationSpeed={animationSpeed}
                  showSkeleton={showSkeleton}
                />
              )}
            </Physics>

            {/* Camera Controls */}
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={2}
              maxDistance={20}
              maxPolarAngle={Math.PI / 2}
            />
          </Suspense>
        </Canvas>

        {/* Overlay Info */}
        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg text-white text-sm">
          <p>Controls: Drag to rotate • Scroll to zoom • Right-click to pan</p>
        </div>

        {!character && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-white/50">
              <p className="text-xl mb-2">No character loaded</p>
              <p className="text-sm">Describe a character and click Generate</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
