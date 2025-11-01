import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, RoundedBox, Text } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { useSupabaseData } from './SupabaseDataContext';
import QuizSystem from './QuizSystem';

interface ArticleData {
  title: string;
  date: string;
  author: string[];
  filename?: string;
  length?: number;
}

interface LeaderboardEntry {
  id: number;
  player_name: string;
  score: number;
  combo_max: number;
  accuracy: number;
  created_at: string;
}

interface InteractiveTabletProps {
  initialPosition?: [number, number, number];
  isGamePlaying?: boolean;
  articles?: ArticleData[];
  onStartGame?: () => void;
}

type ViewMode = 'chat' | 'blog' | 'quiz';
type PageMode = 1 | 2;

export default function InteractiveTablet({
  initialPosition = [0, 2, 5],
  isGamePlaying = false,
  articles = [],
  onStartGame
}: InteractiveTabletProps) {
  // State management
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [isGrabbed, setIsGrabbed] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState<PageMode>(1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

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

  // Physics body for the tablet (mass: 0 = no gravity)
  const [ref, api] = useBox<THREE.Mesh>(() => ({
    mass: 0,
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

  // Follow pointer when grabbed and always face camera
  useFrame(() => {
    if (groupRef.current && ref.current) {
      // Make tablet always face the camera (billboard effect)
      const cameraWorldPos = new THREE.Vector3();
      camera.getWorldPosition(cameraWorldPos);
      groupRef.current.lookAt(cameraWorldPos);

      // Sync physics body rotation with visual rotation
      ref.current.rotation.copy(groupRef.current.rotation);

      // Handle grabbed state - follow camera
      if (isGrabbed) {
        const target = new THREE.Vector3();
        camera.getWorldDirection(target);
        target.multiplyScalar(6);
        target.add(camera.position);

        api.position.set(target.x, target.y, target.z);
        api.velocity.set(0, 0, 0);
        api.angularVelocity.set(0, 0, 0);
      }
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

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const response = await fetch('/api/game/get-leaderboard');
      if (!response.ok) {
        console.error('Leaderboard API error:', response.status);
        setLeaderboard([]);
        return;
      }
      const text = await response.text();
      if (!text) {
        setLeaderboard([]);
        return;
      }
      const data = JSON.parse(text);
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  // Fetch leaderboard when switching to page 2
  useEffect(() => {
    if (currentPage === 2 && isPoweredOn) {
      fetchLeaderboard();
    }
  }, [currentPage, isPoweredOn, fetchLeaderboard]);

  // Navigate pages
  const changePage = useCallback((page: PageMode) => {
    if (!isPoweredOn) return;
    setCurrentPage(page);
  }, [isPoweredOn]);

  // Handle play game
  const handlePlayGame = useCallback((e: any) => {
    e.stopPropagation();
    if (isPoweredOn && onStartGame) {
      onStartGame();
    }
  }, [isPoweredOn, onStartGame]);

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

        {/* Page 1: View mode toggle buttons */}
        {isPoweredOn && currentPage === 1 && (
          <>
            <mesh
              position={[-tabletWidth / 3, tabletHeight / 2 - 0.3, tabletDepth / 2 + 0.02]}
              onClick={() => switchViewMode('chat')}
            >
              <planeGeometry args={[0.85, 0.3]} />
              <meshStandardMaterial
                color={viewMode === 'chat' ? "#00ff88" : "#333333"}
                emissive={viewMode === 'chat' ? "#00ff88" : "#333333"}
                emissiveIntensity={0.3}
              />
            </mesh>
            <Text
              position={[-tabletWidth / 3, tabletHeight / 2 - 0.3, tabletDepth / 2 + 0.03]}
              fontSize={0.13}
              color={viewMode === 'chat' ? "#000000" : "#ffffff"}
              anchorX="center"
              anchorY="middle"
            >
              Chat
            </Text>

            <mesh
              position={[0, tabletHeight / 2 - 0.3, tabletDepth / 2 + 0.02]}
              onClick={() => switchViewMode('blog')}
            >
              <planeGeometry args={[0.85, 0.3]} />
              <meshStandardMaterial
                color={viewMode === 'blog' ? "#00ff88" : "#333333"}
                emissive={viewMode === 'blog' ? "#00ff88" : "#333333"}
                emissiveIntensity={0.3}
              />
            </mesh>
            <Text
              position={[0, tabletHeight / 2 - 0.3, tabletDepth / 2 + 0.03]}
              fontSize={0.13}
              color={viewMode === 'blog' ? "#000000" : "#ffffff"}
              anchorX="center"
              anchorY="middle"
            >
              Blog
            </Text>

            <mesh
              position={[tabletWidth / 3, tabletHeight / 2 - 0.3, tabletDepth / 2 + 0.02]}
              onClick={() => switchViewMode('quiz')}
            >
              <planeGeometry args={[0.85, 0.3]} />
              <meshStandardMaterial
                color={viewMode === 'quiz' ? "#00ff88" : "#333333"}
                emissive={viewMode === 'quiz' ? "#00ff88" : "#333333"}
                emissiveIntensity={0.3}
              />
            </mesh>
            <Text
              position={[tabletWidth / 3, tabletHeight / 2 - 0.3, tabletDepth / 2 + 0.03]}
              fontSize={0.13}
              color={viewMode === 'quiz' ? "#000000" : "#ffffff"}
              anchorX="center"
              anchorY="middle"
            >
              Quiz
            </Text>
          </>
        )}

        {/* Page 2: High Scores title */}
        {isPoweredOn && currentPage === 2 && (
          <Text
            position={[0, tabletHeight / 2 - 0.3, tabletDepth / 2 + 0.03]}
            fontSize={0.2}
            color="#FFD700"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            🏆 HIGH SCORES 🏆
          </Text>
        )}

        {/* Page navigation dots */}
        {isPoweredOn && (
          <>
            <mesh
              position={[-0.15, -tabletHeight / 2 + 0.5, tabletDepth / 2 + 0.02]}
              onClick={() => changePage(1)}
            >
              <circleGeometry args={[0.08, 16]} />
              <meshStandardMaterial
                color={currentPage === 1 ? "#00ff88" : "#666666"}
                emissive={currentPage === 1 ? "#00ff88" : "#666666"}
                emissiveIntensity={currentPage === 1 ? 0.5 : 0.2}
              />
            </mesh>
            <mesh
              position={[0.15, -tabletHeight / 2 + 0.5, tabletDepth / 2 + 0.02]}
              onClick={() => changePage(2)}
            >
              <circleGeometry args={[0.08, 16]} />
              <meshStandardMaterial
                color={currentPage === 2 ? "#00ff88" : "#666666"}
                emissive={currentPage === 2 ? "#00ff88" : "#666666"}
                emissiveIntensity={currentPage === 2 ? 0.5 : 0.2}
              />
            </mesh>
          </>
        )}

        {/* HTML content overlay for interactive UI */}
        {isPoweredOn && (
          <Html
            position={[0, -0.2, tabletDepth / 2 + 0.02]}
            transform
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
              {currentPage === 1 && viewMode === 'quiz' ? (
                <QuizSystem
                  articleFilename={displayArticles[currentArticleIndex]?.filename || ''}
                  articleTitle={displayArticles[currentArticleIndex]?.title || ''}
                  onClose={() => setViewMode('blog')}
                />
              ) : currentPage === 1 && viewMode === 'chat' ? (
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
              ) : currentPage === 1 && viewMode === 'blog' ? (
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
              ) : currentPage === 2 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* High Scores Display */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    marginBottom: '12px',
                  }}>
                    {loadingLeaderboard ? (
                      <div style={{
                        color: '#de7ea2',
                        textAlign: 'center',
                        padding: '20px',
                        fontSize: '14px',
                      }}>
                        Loading leaderboard...
                      </div>
                    ) : leaderboard.length === 0 ? (
                      <div style={{
                        color: '#888888',
                        textAlign: 'center',
                        padding: '20px',
                        fontSize: '14px',
                      }}>
                        Be the first to set a high score!
                      </div>
                    ) : (
                      leaderboard.map((entry, index) => (
                        <div
                          key={entry.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            margin: '8px 0',
                            background: index === 0 ? 'linear-gradient(90deg, rgba(255, 215, 0, 0.2), transparent)' :
                                       index === 1 ? 'linear-gradient(90deg, rgba(192, 192, 192, 0.2), transparent)' :
                                       index === 2 ? 'linear-gradient(90deg, rgba(205, 127, 50, 0.2), transparent)' :
                                       'rgba(255, 255, 255, 0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          <div style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            width: '40px',
                            textAlign: 'center',
                            color: index === 0 ? '#FFD700' :
                                   index === 1 ? '#C0C0C0' :
                                   index === 2 ? '#CD7F32' :
                                   '#de7ea2',
                          }}>
                            #{index + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 'bold',
                              color: '#ffffff',
                              marginBottom: '4px',
                            }}>
                              {entry.player_name}
                            </div>
                            <div style={{
                              fontSize: '10px',
                              color: '#888888',
                            }}>
                              Combo: {entry.combo_max}x • Accuracy: {entry.accuracy.toFixed(1)}%
                            </div>
                          </div>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#FFD700',
                          }}>
                            {entry.score.toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Play Game Button */}
                  <button
                    onClick={handlePlayGame}
                    style={{
                      background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                      border: '3px solid white',
                      borderRadius: '12px',
                      padding: '16px 32px',
                      color: '#000000',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      fontFamily: 'monospace',
                      boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.5)';
                    }}
                  >
                    🎮 Play Game
                  </button>
                </div>
              ) : null}
            </div>
          </Html>
        )}
      </mesh>
    </group>
  );
}
