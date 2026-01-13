'use client';

import React, { useState, useCallback, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, Html } from '@react-three/drei';
import { Physics } from '@react-three/cannon';
import RiggedCharacter from './RiggedCharacter';
import CharacterCollision from './CharacterCollision';
import PhysicsGround from './3d/scene/PhysicsGround';
import { CharacterConfig } from '@/lib/generators/characterTypes';
import * as THREE from 'three';

interface StoryCharacter {
  id: string;
  config: CharacterConfig;
  position: [number, number, number];
  animation: string;
  dialogueText?: string;
}

interface StoryScene {
  title: string;
  description: string;
  characters: StoryCharacter[];
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
}

export default function Character360Story() {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [interactionLog, setInteractionLog] = useState<string[]>([]);
  const [isVRMode, setIsVRMode] = useState(false);

  // Example story scenes
  const [scenes, setScenes] = useState<StoryScene[]>([
    {
      title: 'The Meeting',
      description: 'Two creatures meet in the forest clearing',
      characters: [],
      cameraPosition: [8, 5, 8],
      cameraTarget: [0, 1, 0],
    },
    {
      title: 'The Dance',
      description: 'They celebrate their friendship',
      characters: [],
      cameraPosition: [10, 3, 0],
      cameraTarget: [0, 1, 0],
    },
  ]);

  const currentScene = scenes[currentSceneIndex];

  const handleCharacterInteraction = useCallback((characterId: string, targetId: string) => {
    const logEntry = `${characterId} interacted with ${targetId}`;
    setInteractionLog(prev => [...prev.slice(-4), logEntry]);
  }, []);

  const handleNextScene = () => {
    setCurrentSceneIndex(prev => (prev + 1) % scenes.length);
  };

  const handlePrevScene = () => {
    setCurrentSceneIndex(prev => (prev - 1 + scenes.length) % scenes.length);
  };

  const addCharacterToScene = (config: CharacterConfig) => {
    const newCharacter: StoryCharacter = {
      id: config.id,
      config,
      position: [Math.random() * 4 - 2, 0, Math.random() * 4 - 2],
      animation: 'idle',
    };

    setScenes(prev => {
      const updated = [...prev];
      updated[currentSceneIndex].characters.push(newCharacter);
      return updated;
    });
  };

  return (
    <div className="w-full h-screen flex flex-col bg-black">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-4 border-b border-purple-500/30">
        <h1 className="text-xl font-bold">360° Interactive Story Space</h1>
        <p className="text-sm text-gray-300">
          {currentScene.title} - {currentScene.description}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        <Canvas
          shadows
          gl={{ antialias: true }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            {/* Animated Camera */}
            <AnimatedCamera
              position={currentScene.cameraPosition}
              target={currentScene.cameraTarget}
            />

            {/* Lighting for Story Atmosphere */}
            <ambientLight intensity={0.3} />
            <directionalLight
              position={[10, 10, 5]}
              intensity={0.8}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            <spotLight
              position={[0, 10, 0]}
              angle={0.6}
              penumbra={1}
              intensity={0.5}
              castShadow
              color="#ff00ff"
            />

            {/* Environment */}
            <Environment preset="sunset" />
            <fog attach="fog" args={['#1a0a2e', 5, 30]} />

            {/* 360 Background Sphere */}
            <StoryBackgroundSphere />

            {/* Physics World */}
            <Physics gravity={[0, -9.81, 0]}>
              <PhysicsGround />

              {/* Render Characters */}
              {currentScene.characters.map((character, index) => (
                <group key={character.id} position={character.position}>
                  <RiggedCharacter
                    config={character.config}
                    currentAnimation={character.animation}
                    animationSpeed={1.0}
                  />

                  {/* Character Dialogue */}
                  {character.dialogueText && (
                    <Html position={[0, 2.5, 0]} center>
                      <div className="bg-black/80 text-white px-4 py-2 rounded-lg text-sm max-w-xs backdrop-blur-sm border border-purple-500/30">
                        {character.dialogueText}
                      </div>
                    </Html>
                  )}

                  {/* Collision Detection */}
                  <CharacterCollision
                    collisionBoxes={character.config.collisionBoxes}
                    position={[0, 0, 0]}
                    onCollision={otherBody => {
                      if (otherBody?.userData?.characterId) {
                        handleCharacterInteraction(
                          character.id,
                          otherBody.userData.characterId
                        );
                      }
                    }}
                    showDebug={false}
                  />
                </group>
              ))}

              {/* Interactive Props */}
              <InteractiveProp position={[3, 0, 3]} />
              <InteractiveProp position={[-3, 0, -3]} />
            </Physics>

            {/* Controls */}
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={5}
              maxDistance={25}
              maxPolarAngle={Math.PI / 2.2}
            />
          </Suspense>
        </Canvas>

        {/* UI Overlays */}
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white p-4 rounded-lg max-w-sm">
          <h3 className="font-bold mb-2">Scene {currentSceneIndex + 1}/{scenes.length}</h3>
          <p className="text-sm mb-3">{currentScene.description}</p>
          <p className="text-xs text-gray-300">
            Characters in scene: {currentScene.characters.length}
          </p>
        </div>

        {/* Scene Navigation */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
          <button
            onClick={handlePrevScene}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
          >
            ← Previous Scene
          </button>
          <button
            onClick={handleNextScene}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
          >
            Next Scene →
          </button>
        </div>

        {/* Interaction Log */}
        {interactionLog.length > 0 && (
          <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm text-white p-4 rounded-lg max-w-xs">
            <h3 className="font-bold mb-2 text-sm">Interactions</h3>
            <div className="space-y-1">
              {interactionLog.map((log, index) => (
                <p key={index} className="text-xs text-green-300">
                  {log}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-xs">
          <p>🖱️ Drag to rotate • Scroll to zoom • Right-click to pan</p>
          <p>🎬 Navigate scenes to tell your story</p>
        </div>
      </div>
    </div>
  );
}

// Animated camera component
function AnimatedCamera({
  position,
  target,
}: {
  position: [number, number, number];
  target: [number, number, number];
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  // Smooth camera transitions would go here
  // For now, just set position

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={position}
      fov={60}
    />
  );
}

// 360 Background Sphere for immersive environment
function StoryBackgroundSphere() {
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 64, 64]} />
      <meshBasicMaterial color="#0a0520" side={THREE.BackSide} />
    </mesh>
  );
}

// Interactive prop in the scene
function InteractiveProp({ position }: { position: [number, number, number] }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActivated, setIsActivated] = useState(false);

  return (
    <mesh
      position={position}
      onPointerOver={() => setIsHovered(true)}
      onPointerOut={() => setIsHovered(false)}
      onClick={() => setIsActivated(!isActivated)}
      scale={isActivated ? 1.5 : 1}
    >
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial
        color={isActivated ? '#ff00ff' : isHovered ? '#00ffff' : '#888888'}
        emissive={isActivated ? '#ff00ff' : '#000000'}
        emissiveIntensity={isActivated ? 0.5 : 0}
      />
    </mesh>
  );
}
