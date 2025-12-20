import React, { useState, useCallback, useEffect } from 'react';
import { useSupabaseData } from './SupabaseDataContext';
import { useJourney } from './JourneyContext';
import FeedbackPanel from './FeedbackPanel';
import { trackEvent } from '@/lib/analytics/trackEvent';

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
}

interface TerminalInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  articles?: ArticleData[];
  onStartGame?: (source?: string) => void;
  onChangeScenery?: (scenery: SceneryOption) => void;
  availableScenery?: SceneryOption[];
  currentScenery?: string;
}

type ViewMode = 'chat' | 'game' | 'scenery' | 'about';

export default function TerminalInterface({
  isOpen,
  onClose,
  articles = [],
  onStartGame,
  onChangeScenery,
  availableScenery = [],
  currentScenery,
}: TerminalInterfaceProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [chatInput, setChatInput] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { chatData, setChatData } = useSupabaseData();
  const { updateStats, currentQuest, completeQuest } = useJourney();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const response = await fetch('/api/game/get-leaderboard');
      if (response.ok) {
        const text = await response.text();
        if (text) {
          const data = JSON.parse(text);
          setLeaderboard(data.leaderboard || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'game' && isOpen) fetchLeaderboard();
  }, [viewMode, isOpen, fetchLeaderboard]);

  const handleChatSubmit = useCallback(async () => {
    if (chatInput.trim()) {
      setChatData({ question: chatInput, response: chatData.response });
      trackEvent('ai_chat', {
        messageLength: chatInput.trim().length,
      });
      setChatInput('');
      updateStats('questionsAsked', 1);
      if (currentQuest?.id === 'first-question') completeQuest('first-question');
    }
  }, [chatInput, setChatData, chatData.response, updateStats, currentQuest, completeQuest]);

  const handlePlayGame = useCallback(() => {
    if (onStartGame) {
      onStartGame('terminal_game_tab');
      onClose();
    }
  }, [onStartGame, onClose]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'chat', label: 'CHAT' },
    { id: 'game', label: 'GAME' },
    { id: 'scenery', label: 'SCENE' },
    { id: 'about', label: 'ABOUT' },
  ] as const;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#0a0a0a',
      }}
    >
      {/* Header */}
      <div style={{
        height: isMobile ? '50px' : '44px',
        background: '#111',
        borderBottom: '1px solid #222',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        justifyContent: 'space-between',
      }}>
        <div style={{ color: '#0f0', fontFamily: 'monospace', fontSize: '14px' }}>
          {'>_'} terminal
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '8px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #222',
        background: '#0d0d0d',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id as ViewMode)}
            style={{
              flex: 1,
              padding: isMobile ? '14px 8px' : '12px 16px',
              background: viewMode === tab.id ? '#1a1a1a' : 'transparent',
              border: 'none',
              borderBottom: viewMode === tab.id ? '2px solid #0f0' : '2px solid transparent',
              color: viewMode === tab.id ? '#0f0' : '#555',
              fontFamily: 'monospace',
              fontSize: isMobile ? '12px' : '11px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: isMobile ? '16px' : '20px 24px',
        height: `calc(100vh - ${isMobile ? '115px' : '105px'})`,
      }}>
        {/* CHAT */}
        {viewMode === 'chat' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              flex: 1,
              background: '#111',
              borderRadius: '8px',
              padding: isMobile ? '12px' : '16px',
              marginBottom: '12px',
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: isMobile ? '14px' : '13px',
              lineHeight: 1.6,
            }}>
              {chatData.response && chatData.response !== 'Waiting for your question...' ? (
                <>
                  <div style={{ color: '#0f0', marginBottom: '12px' }}>
                    <span style={{ color: '#555' }}>you:</span> {chatData.question}
                  </div>
                  <div style={{ color: '#ccc', whiteSpace: 'pre-wrap' }}>
                    <span style={{ color: '#555' }}>ai:</span> {chatData.response}
                  </div>
                </>
              ) : (
                <div style={{ color: '#444' }}>
                  Ask me anything about Alex - work, skills, projects, experience.
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                placeholder="Type your question..."
                autoFocus={!isMobile}
                style={{
                  flex: 1,
                  background: '#111',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  padding: isMobile ? '14px' : '12px',
                  color: '#fff',
                  fontSize: isMobile ? '16px' : '14px',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleChatSubmit}
                style={{
                  background: '#0f0',
                  border: 'none',
                  borderRadius: '6px',
                  padding: isMobile ? '14px 20px' : '12px 20px',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                SEND
              </button>
            </div>
          </div>
        )}

        {/* GAME */}
        {viewMode === 'game' && (
          <div>
            <button
              onClick={handlePlayGame}
              style={{
                width: '100%',
                padding: isMobile ? '20px' : '18px',
                background: 'linear-gradient(135deg, #0a0 0%, #060 100%)',
                border: '2px solid #0f0',
                borderRadius: '8px',
                color: '#fff',
                fontSize: isMobile ? '18px' : '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: 'monospace',
                marginBottom: '20px',
              }}
            >
              START GAME
            </button>

            <div style={{
              background: '#111',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <div style={{ color: '#666', fontSize: '11px', marginBottom: '8px', fontFamily: 'monospace' }}>
                HOW TO PLAY
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#888', fontSize: '13px', fontFamily: 'monospace' }}>
                <li>Click spheres before they disappear</li>
                <li>Build combos for bonus points</li>
                <li>Golden spheres = 3x points</li>
              </ul>
            </div>

            <div style={{
              background: '#111',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <div style={{ color: '#ff0', fontSize: '12px', marginBottom: '12px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                LEADERBOARD
              </div>
              {loadingLeaderboard ? (
                <div style={{ color: '#444', fontFamily: 'monospace' }}>Loading...</div>
              ) : leaderboard.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {leaderboard.slice(0, 5).map((entry, i) => (
                    <div key={entry.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: i === 0 ? 'rgba(255, 255, 0, 0.1)' : '#0a0a0a',
                      borderRadius: '4px',
                      color: i === 0 ? '#ff0' : '#666',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                    }}>
                      <span>{i + 1}. {entry.player_name}</span>
                      <span style={{ fontWeight: 'bold' }}>{entry.score.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#444', fontFamily: 'monospace' }}>No scores yet</div>
              )}
            </div>
          </div>
        )}

        {/* SCENE */}
        {viewMode === 'scenery' && (
          <div>
            <div style={{ color: '#666', fontSize: '11px', marginBottom: '16px', fontFamily: 'monospace' }}>
              SELECT ENVIRONMENT
            </div>
            {availableScenery.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                gap: '12px',
              }}>
                {availableScenery.map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() => onChangeScenery?.(scene)}
                    style={{
                      padding: '20px 12px',
                      background: currentScenery === scene.path ? '#1a2a1a' : '#111',
                      border: currentScenery === scene.path ? '2px solid #0f0' : '1px solid #222',
                      borderRadius: '8px',
                      color: currentScenery === scene.path ? '#0f0' : '#666',
                      cursor: 'pointer',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                    }}
                  >
                    <div style={{ fontSize: '18px', marginBottom: '6px' }}>
                      {scene.type === 'splat' ? '◈' : '◻'}
                    </div>
                    <div style={{ fontSize: '11px' }}>{scene.name}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '32px',
                background: '#111',
                borderRadius: '8px',
                textAlign: 'center',
                color: '#444',
                fontFamily: 'monospace',
              }}>
                No environments available
              </div>
            )}
          </div>
        )}

        {/* ABOUT */}
        {viewMode === 'about' && (
          <div>
            <div style={{
              background: '#111',
              borderRadius: '8px',
              padding: isMobile ? '16px' : '20px',
              marginBottom: '16px',
            }}>
              <div style={{ color: '#fff', fontSize: '18px', marginBottom: '12px', fontFamily: 'monospace' }}>
                Alex Welcing
              </div>
              <div style={{ color: '#888', marginBottom: '16px', lineHeight: 1.7, fontFamily: 'monospace', fontSize: '13px' }}>
                Product leader and developer with expertise in AI, spatial computing,
                and modern web technologies.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['React', 'Three.js', 'TypeScript', 'AI/ML', 'WebXR'].map((skill) => (
                  <span key={skill} style={{
                    padding: '4px 10px',
                    background: '#0a0a0a',
                    border: '1px solid #222',
                    borderRadius: '4px',
                    color: '#0f0',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {articles.length > 0 && (
              <div>
                <div style={{ color: '#666', fontSize: '11px', marginBottom: '12px', fontFamily: 'monospace' }}>
                  ARTICLES
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {articles.slice(0, 5).map((article, i) => (
                    <a
                      key={i}
                      href={`/articles/${article.filename?.replace('.mdx', '')}`}
                      style={{
                        padding: '12px 16px',
                        background: '#111',
                        borderRadius: '6px',
                        color: '#888',
                        textDecoration: 'none',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        display: 'block',
                      }}
                    >
                      {article.title}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '20px' }}>
              <FeedbackPanel isMobile={isMobile} />
            </div>

            <div style={{
              marginTop: '20px',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}>
              {[
                { label: 'GitHub', href: 'https://github.com/alexwelcing' },
                { label: 'LinkedIn', href: 'https://linkedin.com/in/alexwelcing' },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '10px 16px',
                    background: '#111',
                    border: '1px solid #222',
                    borderRadius: '6px',
                    color: '#666',
                    textDecoration: 'none',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                  }}
                >
                  {link.label} ↗
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
