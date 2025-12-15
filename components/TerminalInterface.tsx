import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSupabaseData } from './SupabaseDataContext';
import { useJourney } from './JourneyContext';

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

interface SceneryOption {
  id: string;
  name: string;
  type: 'image' | 'splat';
  path: string;
  thumbnail?: string;
}

interface TerminalInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  articles?: ArticleData[];
  onStartGame?: () => void;
  onChangeScenery?: (scenery: SceneryOption) => void;
  availableScenery?: SceneryOption[];
  currentScenery?: string;
}

type ViewMode = 'home' | 'chat' | 'game' | 'scenery' | 'about';

export default function TerminalInterface({
  isOpen,
  onClose,
  articles = [],
  onStartGame,
  onChangeScenery,
  availableScenery = [],
  currentScenery,
}: TerminalInterfaceProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [chatInput, setChatInput] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const { chatData, setChatData } = useSupabaseData();
  const { updateStats, currentQuest, completeQuest } = useJourney();

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Fetch leaderboard when viewing game tab
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const response = await fetch('/api/game/get-leaderboard');
      if (!response.ok) {
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

  useEffect(() => {
    if (viewMode === 'game' && isOpen) {
      fetchLeaderboard();
    }
  }, [viewMode, isOpen, fetchLeaderboard]);

  const handleChatSubmit = useCallback(async () => {
    if (chatInput.trim()) {
      setChatData({ question: chatInput, response: chatData.response });
      setChatInput('');
      updateStats('questionsAsked', 1);
      if (currentQuest?.id === 'first-question') {
        completeQuest('first-question');
      }
    }
  }, [chatInput, setChatData, chatData.response, updateStats, currentQuest, completeQuest]);

  const handlePlayGame = useCallback(() => {
    if (onStartGame) {
      onStartGame();
      onClose();
    }
  }, [onStartGame, onClose]);

  if (!isOpen) return null;

  const menuItems = [
    { id: 'home', icon: '/', label: 'HOME' },
    { id: 'chat', icon: '>', label: 'ASK AI' },
    { id: 'game', icon: '#', label: 'GAME' },
    { id: 'scenery', icon: '*', label: 'SCENE' },
    { id: 'about', icon: '?', label: 'ABOUT' },
  ] as const;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      {/* Terminal Window */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(95vw, 900px)',
          height: 'min(90vh, 600px)',
          background: '#0d0d0d',
          border: '1px solid #333',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Title Bar */}
        <div style={{
          height: '32px',
          background: '#1a1a1a',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={onClose}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#ff5f56',
                border: 'none',
                cursor: 'pointer',
              }}
            />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27ca40' }} />
          </div>
          <div style={{
            flex: 1,
            textAlign: 'center',
            color: '#666',
            fontSize: '12px',
            letterSpacing: '1px',
          }}>
            terminal -- alex@portfolio
          </div>
          <div style={{ width: '50px' }} />
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{
            width: '140px',
            background: '#111',
            borderRight: '1px solid #222',
            padding: '16px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setViewMode(item.id as ViewMode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 16px',
                  background: viewMode === item.id ? '#1f1f1f' : 'transparent',
                  border: 'none',
                  borderLeft: viewMode === item.id ? '2px solid #0f0' : '2px solid transparent',
                  color: viewMode === item.id ? '#0f0' : '#666',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ color: viewMode === item.id ? '#0f0' : '#444', fontWeight: 'bold' }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}

            {/* Close Button at Bottom */}
            <div style={{ flex: 1 }} />
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderLeft: '2px solid transparent',
                color: '#f55',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontWeight: 'bold' }}>x</span>
              EXIT
            </button>
          </div>

          {/* Content Area */}
          <div style={{
            flex: 1,
            padding: '20px 24px',
            overflowY: 'auto',
            color: '#ccc',
            fontSize: '14px',
            lineHeight: '1.6',
          }}>
            {/* HOME View */}
            {viewMode === 'home' && (
              <div>
                <div style={{ color: '#0f0', marginBottom: '20px' }}>
                  $ welcome --user=visitor
                </div>
                <div style={{ color: '#888', marginBottom: '24px' }}>
                  Interactive portfolio terminal. Select an option from the menu.
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                  {[
                    { cmd: 'ask-ai', desc: 'Chat with AI about Alex', action: () => setViewMode('chat') },
                    { cmd: 'play-game', desc: 'Sphere Hunt - click fast!', action: () => setViewMode('game') },
                    { cmd: 'change-scene', desc: 'Switch background environment', action: () => setViewMode('scenery') },
                    { cmd: 'about', desc: 'Learn about Alex Welcing', action: () => setViewMode('about') },
                  ].map((item) => (
                    <button
                      key={item.cmd}
                      onClick={item.action}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '12px 16px',
                        background: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        color: '#ccc',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0f0';
                        e.currentTarget.style.background = '#1f1f1f';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#333';
                        e.currentTarget.style.background = '#1a1a1a';
                      }}
                    >
                      <span style={{ color: '#0f0', fontFamily: 'monospace' }}>$</span>
                      <span style={{ color: '#fff', flex: 1 }}>{item.cmd}</span>
                      <span style={{ color: '#666', fontSize: '12px' }}>{item.desc}</span>
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: '24px', color: '#444', fontSize: '12px' }}>
                  Press ESC or click outside to close
                </div>
              </div>
            )}

            {/* CHAT View */}
            {viewMode === 'chat' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#0f0', marginBottom: '16px' }}>
                  $ ai-chat --mode=interactive
                </div>

                {/* Chat History */}
                <div style={{
                  flex: 1,
                  background: '#0a0a0a',
                  border: '1px solid #222',
                  borderRadius: '4px',
                  padding: '16px',
                  marginBottom: '16px',
                  overflowY: 'auto',
                }}>
                  {chatData.response && chatData.response !== 'Waiting for your question...' ? (
                    <>
                      <div style={{ color: '#0f0', marginBottom: '12px' }}>
                        <span style={{ color: '#666' }}>you@terminal:</span> {chatData.question}
                      </div>
                      <div style={{ color: '#fff', whiteSpace: 'pre-wrap' }}>
                        <span style={{ color: '#666' }}>ai@terminal:</span> {chatData.response}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#444' }}>
                      Ask me anything about Alex - his work, skills, projects, or experience.
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: '#0f0', padding: '10px 0' }}>$</span>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                    placeholder="Type your question..."
                    autoFocus
                    style={{
                      flex: 1,
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      padding: '10px 14px',
                      color: '#fff',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleChatSubmit}
                    style={{
                      background: '#0f0',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '10px 20px',
                      color: '#000',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    SEND
                  </button>
                </div>
              </div>
            )}

            {/* GAME View */}
            {viewMode === 'game' && (
              <div>
                <div style={{ color: '#0f0', marginBottom: '16px' }}>
                  $ sphere-hunt --difficulty=normal
                </div>

                {/* Play Button */}
                <button
                  onClick={handlePlayGame}
                  style={{
                    width: '100%',
                    padding: '20px',
                    background: 'linear-gradient(135deg, #0a0 0%, #070 100%)',
                    border: '2px solid #0f0',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    marginBottom: '20px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  START GAME
                </button>

                {/* Instructions */}
                <div style={{
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  padding: '16px',
                  marginBottom: '20px',
                }}>
                  <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>HOW TO PLAY:</div>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#666', fontSize: '13px' }}>
                    <li>Click spheres before they disappear</li>
                    <li>Build combos for bonus points</li>
                    <li>Golden spheres = 3x points</li>
                    <li>30 seconds to get the highest score</li>
                  </ul>
                </div>

                {/* Leaderboard */}
                <div style={{
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  padding: '16px',
                }}>
                  <div style={{ color: '#ff0', fontSize: '14px', marginBottom: '12px', fontWeight: 'bold' }}>
                    LEADERBOARD
                  </div>
                  {loadingLeaderboard ? (
                    <div style={{ color: '#444' }}>Loading...</div>
                  ) : leaderboard.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {leaderboard.slice(0, 5).map((entry, i) => (
                        <div key={entry.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: i === 0 ? 'rgba(255, 255, 0, 0.1)' : '#111',
                          borderRadius: '4px',
                          color: i === 0 ? '#ff0' : '#888',
                        }}>
                          <span>{i + 1}. {entry.player_name}</span>
                          <span style={{ fontWeight: 'bold' }}>{entry.score.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: '#444' }}>No scores yet. Be the first!</div>
                  )}
                </div>
              </div>
            )}

            {/* SCENERY View */}
            {viewMode === 'scenery' && (
              <div>
                <div style={{ color: '#0f0', marginBottom: '16px' }}>
                  $ set-environment --list
                </div>

                {availableScenery.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                    {availableScenery.map((scene) => (
                      <button
                        key={scene.id}
                        onClick={() => onChangeScenery?.(scene)}
                        style={{
                          padding: '16px 12px',
                          background: currentScenery === scene.path ? '#1a2a1a' : '#1a1a1a',
                          border: currentScenery === scene.path ? '2px solid #0f0' : '1px solid #333',
                          borderRadius: '4px',
                          color: currentScenery === scene.path ? '#0f0' : '#888',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (currentScenery !== scene.path) {
                            e.currentTarget.style.borderColor = '#555';
                            e.currentTarget.style.color = '#ccc';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentScenery !== scene.path) {
                            e.currentTarget.style.borderColor = '#333';
                            e.currentTarget.style.color = '#888';
                          }
                        }}
                      >
                        <div style={{ fontSize: '20px', marginBottom: '6px' }}>
                          {scene.type === 'splat' ? '[3D]' : '[2D]'}
                        </div>
                        <div style={{ fontSize: '12px', fontFamily: 'inherit' }}>{scene.name}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '32px',
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    textAlign: 'center',
                    color: '#444',
                  }}>
                    <div style={{ marginBottom: '8px' }}>No additional environments available</div>
                    <div style={{ fontSize: '12px' }}>Add .splat files to enable 3D backgrounds</div>
                  </div>
                )}
              </div>
            )}

            {/* ABOUT View */}
            {viewMode === 'about' && (
              <div>
                <div style={{ color: '#0f0', marginBottom: '16px' }}>
                  $ cat about.txt
                </div>

                <div style={{
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  padding: '20px',
                }}>
                  <div style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>
                    Alex Welcing
                  </div>
                  <div style={{ color: '#888', marginBottom: '16px', lineHeight: '1.8' }}>
                    Product leader and developer with expertise in AI, spatial computing,
                    and modern web technologies. Currently exploring the intersection of
                    immersive experiences and practical applications.
                  </div>

                  <div style={{ color: '#666', fontSize: '13px', marginBottom: '12px' }}>
                    -- EXPERTISE --
                  </div>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '20px',
                  }}>
                    {['React', 'Three.js', 'TypeScript', 'AI/ML', 'WebXR', 'Product Strategy'].map((skill) => (
                      <span key={skill} style={{
                        padding: '4px 10px',
                        background: '#111',
                        border: '1px solid #333',
                        borderRadius: '3px',
                        color: '#0f0',
                        fontSize: '12px',
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => setViewMode('chat')}
                    style={{
                      padding: '10px 20px',
                      background: 'transparent',
                      border: '1px solid #0f0',
                      borderRadius: '4px',
                      color: '#0f0',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '13px',
                    }}
                  >
                    Ask AI for more info
                  </button>
                </div>

                {/* Articles Section */}
                {articles.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ color: '#666', fontSize: '13px', marginBottom: '12px' }}>
                      -- RECENT ARTICLES --
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {articles.slice(0, 3).map((article, i) => (
                        <div key={i} style={{
                          padding: '12px 16px',
                          background: '#1a1a1a',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <span style={{ color: '#ccc' }}>{article.title}</span>
                          <span style={{ color: '#444', fontSize: '12px' }}>{article.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
