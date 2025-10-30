import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, RoundedBox, Text } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { useSupabaseData } from './SupabaseDataContext';

interface ArticleData {
  title: string;
  date: string;
  author: string[];
  filename?: string;
  length?: number;
}

interface InteractiveTabletProps {
  initialPosition?: [number, number, number];
  isGamePlaying?: boolean;
  articles?: ArticleData[];
}

type ViewMode = 'chat' | 'blog';

export default function InteractiveTablet({
  initialPosition = [0, 2, 5],
  isGamePlaying = false,
  articles = []
}: InteractiveTabletProps) {
  // State management
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [isGrabbed, setIsGrabbed] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0);

  // Data from context
  const { chatData, setChatData } = useSupabaseData();

  // Use provided articles or fallback to default
  const displayArticles = articles.length > 0 ? articles : [
    { title: "Getting Started", date: "2024-10-01", author: ["Team"] },
    { title: "Advanced Features", date: "2024-10-15", author: ["Team"] },
    { title: "Best Practices", date: "2024-10-20", author: ["Team"] },
  ];

  // Three.js hooks
  const { camera, gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  // Calculate tablet dimensions based on expanded state
  const tabletWidth = isExpanded ? 8 : 4;
  const tabletHeight = isExpanded ? 6 : 3;
  const tabletDepth = 0.2;

  // Physics body for the tablet
  const [ref, api] = useBox<THREE.Mesh>(() => ({
    mass: 1,
    position: initialPosition,
    args: [tabletWidth, tabletHeight, tabletDepth],
    material: {
      friction: 0.5,
      restitution: 0.3
    }
  }));

  // Handle grabbing/dragging
  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    if (!isPoweredOn) return;

    setIsGrabbed(true);
    gl.domElement.style.cursor = 'grabbing';
  }, [isPoweredOn, gl]);

  const handlePointerUp = useCallback(() => {
    if (isGrabbed) {
      setIsGrabbed(false);
      gl.domElement.style.cursor = 'grab';
    }
  }, [isGrabbed, gl]);

  // Follow pointer when grabbed
  useFrame(() => {
    if (isGrabbed && groupRef.current) {
      const target = new THREE.Vector3();
      camera.getWorldDirection(target);
      target.multiplyScalar(6);
      target.add(camera.position);

      api.position.set(target.x, target.y, target.z);
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);
    }
  });

  // Handle pointer events
  useEffect(() => {
    const handleGlobalPointerUp = () => handlePointerUp();
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [handlePointerUp]);

  // Toggle power
  const togglePower = useCallback((e: any) => {
    e.stopPropagation();
    setIsPoweredOn(prev => !prev);
  }, []);

  // Toggle expand
  const toggleExpand = useCallback((e: any) => {
    e.stopPropagation();
    if (isPoweredOn) {
      setIsExpanded(prev => !prev);
    }
  }, [isPoweredOn]);

  // Switch view mode
  const switchViewMode = useCallback((mode: ViewMode) => {
    if (isPoweredOn) {
      setViewMode(mode);
    }
  }, [isPoweredOn]);

  // Handle chat submission
  const handleChatSubmit = useCallback(async () => {
    if (chatInput.trim() && isPoweredOn) {
      setChatData({ question: chatInput, response: chatData.response });
      setChatInput('');
    }
  }, [chatInput, isPoweredOn, setChatData, chatData.response]);

  // Navigate articles
  const navigateArticle = useCallback((direction: 'prev' | 'next') => {
    if (!isPoweredOn) return;
    setCurrentArticleIndex(prev => {
      if (direction === 'prev') {
        return prev > 0 ? prev - 1 : displayArticles.length - 1;
      }
      return (prev + 1) % displayArticles.length;
    });
  }, [isPoweredOn, displayArticles.length]);

  // Hide during gameplay
  if (isGamePlaying) {
    return null;
  }

  // Screen colors based on state
  const screenEmissive = isPoweredOn ? new THREE.Color(0x4488ff) : new THREE.Color(0x000000);
  const screenColor = isPoweredOn ? new THREE.Color(0x88ccff) : new THREE.Color(0x222222);

  return (
    <group ref={groupRef}>
      {/* Main tablet body */}
      <mesh ref={ref} onPointerDown={handlePointerDown}>
        <RoundedBox args={[tabletWidth, tabletHeight, tabletDepth]} radius={0.1} smoothness={4}>
          <meshStandardMaterial
            color="#1a1a2e"
            metalness={0.8}
            roughness={0.2}
          />
        </RoundedBox>

        {/* Screen - front face */}
        <mesh position={[0, 0, tabletDepth / 2 + 0.01]}>
          <planeGeometry args={[tabletWidth - 0.4, tabletHeight - 0.4]} />
          <meshStandardMaterial
            color={screenColor}
            emissive={screenEmissive}
            emissiveIntensity={isPoweredOn ? 0.5 : 0}
            metalness={0.1}
            roughness={0.9}
          />
        </mesh>

        {/* Light emission when powered on */}
        {isPoweredOn && (
          <pointLight
            position={[0, 0, 1]}
            color="#4488ff"
            intensity={2}
            distance={8}
          />
        )}

        {/* Power button - bottom left */}
        <mesh
          position={[-tabletWidth / 2 + 0.3, -tabletHeight / 2 + 0.2, tabletDepth / 2 + 0.02]}
          onClick={togglePower}
        >
          <circleGeometry args={[0.12, 16]} />
          <meshStandardMaterial
            color={isPoweredOn ? "#00ff88" : "#ff0000"}
            emissive={isPoweredOn ? "#00ff88" : "#880000"}
            emissiveIntensity={0.5}
          />
        </mesh>

        {/* Expand/Collapse button - bottom right */}
        <mesh
          position={[tabletWidth / 2 - 0.3, -tabletHeight / 2 + 0.2, tabletDepth / 2 + 0.02]}
          onClick={toggleExpand}
        >
          <circleGeometry args={[0.12, 16]} />
          <meshStandardMaterial
            color={isExpanded ? "#ffaa00" : "#4488ff"}
            emissive={isExpanded ? "#ffaa00" : "#4488ff"}
            emissiveIntensity={isPoweredOn ? 0.5 : 0}
          />
        </mesh>

        {/* View mode toggle buttons */}
        {isPoweredOn && (
          <>
            <mesh
              position={[-tabletWidth / 4, tabletHeight / 2 - 0.3, tabletDepth / 2 + 0.02]}
              onClick={() => switchViewMode('chat')}
            >
              <planeGeometry args={[1, 0.3]} />
              <meshStandardMaterial
                color={viewMode === 'chat' ? "#00ff88" : "#333333"}
                emissive={viewMode === 'chat' ? "#00ff88" : "#333333"}
                emissiveIntensity={0.3}
              />
            </mesh>
            <Text
              position={[-tabletWidth / 4, tabletHeight / 2 - 0.3, tabletDepth / 2 + 0.03]}
              fontSize={0.15}
              color={viewMode === 'chat' ? "#000000" : "#ffffff"}
              anchorX="center"
              anchorY="middle"
            >
              Chat
            </Text>

            <mesh
              position={[tabletWidth / 4, tabletHeight / 2 - 0.3, tabletDepth / 2 + 0.02]}
              onClick={() => switchViewMode('blog')}
            >
              <planeGeometry args={[1, 0.3]} />
              <meshStandardMaterial
                color={viewMode === 'blog' ? "#00ff88" : "#333333"}
                emissive={viewMode === 'blog' ? "#00ff88" : "#333333"}
                emissiveIntensity={0.3}
              />
            </mesh>
            <Text
              position={[tabletWidth / 4, tabletHeight / 2 - 0.3, tabletDepth / 2 + 0.03]}
              fontSize={0.15}
              color={viewMode === 'blog' ? "#000000" : "#ffffff"}
              anchorX="center"
              anchorY="middle"
            >
              Blog
            </Text>
          </>
        )}

        {/* HTML content overlay for interactive UI */}
        {isPoweredOn && (
          <Html
            position={[0, -0.2, tabletDepth / 2 + 0.02]}
            transform
            occlude
            style={{
              width: `${(tabletWidth - 0.8) * 100}px`,
              height: `${(tabletHeight - 1.2) * 100}px`,
              pointerEvents: 'auto',
            }}
          >
            <div style={{
              width: '100%',
              height: '100%',
              background: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '8px',
              padding: '12px',
              color: '#ffffff',
              fontSize: '12px',
              overflowY: 'auto',
              fontFamily: 'monospace',
            }}>
              {viewMode === 'chat' ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Chat Response Display */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    marginBottom: '12px',
                    padding: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '4px',
                  }}>
                    {chatData.response && chatData.response !== 'Waiting for your question...' ? (
                      <div>
                        <div style={{ color: '#00ff88', marginBottom: '8px', fontWeight: 'bold' }}>
                          Q: {chatData.question}
                        </div>
                        <div style={{ color: '#ffffff' }}>
                          {chatData.response}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#888888', fontStyle: 'italic' }}>
                        Ask a question to get started...
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                      placeholder="Type your question..."
                      style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(68, 136, 255, 0.5)',
                        borderRadius: '4px',
                        padding: '8px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChatSubmit();
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #4488ff, #00ff88)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px 16px',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  {/* Article Display */}
                  <div style={{
                    textAlign: 'center',
                    padding: '16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}>
                    <h3 style={{
                      color: '#00ff88',
                      margin: '0 0 12px 0',
                      fontSize: '16px',
                    }}>
                      {displayArticles[currentArticleIndex]?.title || 'No Articles'}
                    </h3>
                    <div style={{
                      color: '#888888',
                      fontSize: '11px',
                      marginBottom: '4px',
                    }}>
                      {displayArticles[currentArticleIndex]?.date || ''}
                    </div>
                    <div style={{
                      color: '#4488ff',
                      fontSize: '11px',
                    }}>
                      by {displayArticles[currentArticleIndex]?.author?.join(', ') || 'Unknown'}
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateArticle('prev');
                      }}
                      style={{
                        background: 'rgba(68, 136, 255, 0.3)',
                        border: '1px solid #4488ff',
                        borderRadius: '4px',
                        padding: '8px 16px',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                      }}
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateArticle('next');
                      }}
                      style={{
                        background: 'rgba(68, 136, 255, 0.3)',
                        border: '1px solid #4488ff',
                        borderRadius: '4px',
                        padding: '8px 16px',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                      }}
                    >
                      Next →
                    </button>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Navigate to article - implement as needed
                      window.open(`/articles/${currentArticleIndex}`, '_blank');
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #4488ff, #00ff88)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 24px',
                      color: '#ffffff',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      marginTop: '12px',
                      fontFamily: 'monospace',
                    }}
                  >
                    View Article
                  </button>
                </div>
              )}
            </div>
          </Html>
        )}
      </mesh>
    </group>
  );
}
