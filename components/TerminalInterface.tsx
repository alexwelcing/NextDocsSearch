import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSupabaseData } from './SupabaseDataContext';
import { useJourney } from './JourneyContext';
import QuizSystem from './QuizSystem';
import CreationStudio from './CreationStudio';

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

interface TerminalInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  articles?: ArticleData[];
  onStartGame?: () => void;
}

type ViewMode = 'chat' | 'blog' | 'quiz' | 'create';
type PageMode = 1 | 2;

export default function TerminalInterface({
  isOpen,
  onClose,
  articles = [],
  onStartGame
}: TerminalInterfaceProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [chatInput, setChatInput] = useState('');
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState<PageMode>(1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [lockedTabHover, setLockedTabHover] = useState<string | null>(null);

  const { chatData, setChatData } = useSupabaseData();
  const { isFeatureUnlocked, completeQuest, updateStats, currentQuest } = useJourney();

  const displayArticles = useMemo(() => articles.length > 0 ? articles : [
    { title: "Getting Started", date: "2024-10-01", author: ["Team"] },
    { title: "Advanced Features", date: "2024-10-15", author: ["Team"] },
    { title: "Best Practices", date: "2024-10-20", author: ["Team"] },
  ], [articles]);

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

  // Fetch leaderboard when switching to page 2
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

  useEffect(() => {
    if (currentPage === 2 && isOpen) {
      fetchLeaderboard();
    }
  }, [currentPage, isOpen, fetchLeaderboard]);

  const handleChatSubmit = useCallback(async () => {
    if (chatInput.trim()) {
      setChatData({ question: chatInput, response: chatData.response });
      setChatInput('');

      // Track quest completion and stats
      updateStats('questionsAsked', 1);
      if (currentQuest?.id === 'first-question') {
        completeQuest('first-question');
      }
    }
  }, [chatInput, setChatData, chatData.response, updateStats, currentQuest, completeQuest]);

  // Track when user views an article
  useEffect(() => {
    if (viewMode === 'blog' && displayArticles[currentArticleIndex]) {
      const articleTitle = displayArticles[currentArticleIndex].title;

      // Track article read
      updateStats('articlesRead', [articleTitle]);

      // Complete quest if active
      if (currentQuest?.id === 'read-article') {
        // Give user 2 seconds to actually read before completing
        const timer = setTimeout(() => {
          completeQuest('read-article');
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [viewMode, currentArticleIndex, displayArticles, currentQuest, completeQuest, updateStats]);

  const navigateArticle = useCallback((direction: 'prev' | 'next') => {
    setCurrentArticleIndex(prev => {
      if (direction === 'prev') {
        return prev > 0 ? prev - 1 : displayArticles.length - 1;
      }
      return (prev + 1) % displayArticles.length;
    });
  }, [displayArticles.length]);

  const handlePlayGame = useCallback(() => {
    if (onStartGame) {
      onStartGame();
      onClose(); // Close terminal when starting game
    }
  }, [onStartGame, onClose]);

  if (!isOpen) return null;

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
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.3s ease-out',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {/* Terminal Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(90vw, 1200px)',
          height: 'min(85vh, 900px)',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
          border: '2px solid #4488ff',
          borderRadius: '24px',
          boxShadow: '0 0 60px rgba(68, 136, 255, 0.3), 0 0 120px rgba(68, 136, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideIn 0.4s ease-out',
          fontFamily: "'Courier New', monospace",
        }}
      >
        {/* Header Bar */}
        <div style={{
          padding: '20px 30px',
          background: 'rgba(68, 136, 255, 0.1)',
          borderBottom: '1px solid rgba(68, 136, 255, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#4488ff',
              textShadow: '0 0 10px rgba(68, 136, 255, 0.5)',
            }}>
              ▶ TERMINAL
            </div>

            {/* Page Navigation */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setCurrentPage(1)}
                style={{
                  background: currentPage === 1 ? 'rgba(68, 136, 255, 0.3)' : 'transparent',
                  border: currentPage === 1 ? '2px solid #4488ff' : '2px solid rgba(68, 136, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: currentPage === 1 ? '#4488ff' : '#888',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  transition: 'all 0.2s ease',
                }}
              >
                APPS
              </button>
              <button
                onClick={() => isFeatureUnlocked('leaderboard') && setCurrentPage(2)}
                disabled={!isFeatureUnlocked('leaderboard')}
                style={{
                  background: currentPage === 2 ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                  border: currentPage === 2 ? '2px solid #FFD700' : '2px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: !isFeatureUnlocked('leaderboard') ? '#444' : (currentPage === 2 ? '#FFD700' : '#888'),
                  cursor: !isFeatureUnlocked('leaderboard') ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  transition: 'all 0.2s ease',
                  opacity: !isFeatureUnlocked('leaderboard') ? 0.4 : 1,
                }}
              >
                {!isFeatureUnlocked('leaderboard') && '🔒 '}🏆 LEADERBOARD
              </button>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 68, 68, 0.2)',
              border: '2px solid rgba(255, 68, 68, 0.5)',
              borderRadius: '8px',
              padding: '8px 20px',
              color: '#ff4444',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 68, 68, 0.3)';
              e.currentTarget.style.borderColor = '#ff4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 68, 68, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(255, 68, 68, 0.5)';
            }}
          >
            ✕ CLOSE [ESC]
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {currentPage === 1 ? (
            <>
              {/* View Mode Tabs */}
              <div style={{
                display: 'flex',
                gap: '0',
                padding: '20px 30px 0',
                position: 'relative',
              }}>
                {(['chat', 'blog', 'quiz', 'create'] as ViewMode[]).map((mode) => {
                  const featureMap = { chat: 'chat', blog: 'articles', quiz: 'quiz', create: 'creation-studio' };
                  const isLocked = !isFeatureUnlocked(featureMap[mode]);

                  return (
                    <div key={mode} style={{ flex: 1, position: 'relative' }}>
                      <button
                        onClick={() => !isLocked && setViewMode(mode)}
                        onMouseEnter={(e) => {
                          if (isLocked) {
                            setLockedTabHover(mode);
                          } else if (viewMode !== mode) {
                            e.currentTarget.style.color = '#aaa';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isLocked) {
                            setLockedTabHover(null);
                          } else if (viewMode !== mode) {
                            e.currentTarget.style.color = '#888';
                          }
                        }}
                        style={{
                          width: '100%',
                          background: viewMode === mode
                            ? 'linear-gradient(180deg, rgba(68, 136, 255, 0.3), rgba(68, 136, 255, 0.1))'
                            : 'transparent',
                          border: 'none',
                          borderBottom: viewMode === mode ? '3px solid #00ff88' : '3px solid transparent',
                          padding: '15px 20px',
                          color: isLocked ? '#444' : (viewMode === mode ? '#00ff88' : '#888'),
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          fontFamily: 'monospace',
                          textTransform: 'uppercase',
                          transition: 'all 0.2s ease',
                          opacity: isLocked ? 0.4 : 1,
                          position: 'relative',
                        }}
                      >
                        {isLocked && '🔒 '}
                        {mode === 'chat' ? '💬 AI CHAT' : mode === 'blog' ? '📄 ARTICLES' : mode === 'quiz' ? '❓ QUIZ' : '✨ CREATE'}
                      </button>

                      {/* Locked Tooltip */}
                      {isLocked && lockedTabHover === mode && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          marginTop: '8px',
                          background: 'rgba(0, 0, 0, 0.9)',
                          border: '1px solid #ff4444',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          zIndex: 1000,
                          whiteSpace: 'nowrap',
                          fontSize: '13px',
                          color: '#ff8888',
                          fontFamily: 'monospace',
                          pointerEvents: 'none',
                        }}>
                          🔒 Complete current quest to unlock
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Content Display */}
              <div style={{
                flex: 1,
                padding: '30px',
                overflowY: 'auto',
              }}>
                {viewMode === 'chat' && (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Chat Response */}
                    <div style={{
                      flex: 1,
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(68, 136, 255, 0.2)',
                      borderRadius: '12px',
                      padding: '24px',
                      overflowY: 'auto',
                    }}>
                      {chatData.response && chatData.response !== 'Waiting for your question...' ? (
                        <div>
                          <div style={{
                            color: '#00ff88',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            marginBottom: '16px',
                            textShadow: '0 0 10px rgba(0, 255, 136, 0.3)',
                          }}>
                            ❯ {chatData.question}
                          </div>
                          <div style={{
                            color: '#ffffff',
                            fontSize: '15px',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                          }}>
                            {chatData.response}
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          color: '#666',
                          fontSize: '16px',
                          textAlign: 'center',
                          padding: '40px',
                        }}>
                          <div style={{ fontSize: '48px', marginBottom: '20px' }}>💬</div>
                          <div>Ask a question to get started...</div>
                        </div>
                      )}
                    </div>

                    {/* Chat Input */}
                    <div style={{
                      display: 'flex',
                      gap: '12px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(68, 136, 255, 0.2)',
                    }}>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                        placeholder="Type your question..."
                        autoFocus
                        style={{
                          flex: 1,
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '2px solid rgba(68, 136, 255, 0.3)',
                          borderRadius: '8px',
                          padding: '14px 18px',
                          color: '#ffffff',
                          fontSize: '15px',
                          fontFamily: 'monospace',
                          outline: 'none',
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#4488ff';
                          e.currentTarget.style.boxShadow = '0 0 10px rgba(68, 136, 255, 0.3)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(68, 136, 255, 0.3)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                      <button
                        onClick={handleChatSubmit}
                        style={{
                          background: 'linear-gradient(135deg, #4488ff, #00ff88)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '14px 32px',
                          color: '#ffffff',
                          fontWeight: 'bold',
                          fontSize: '15px',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          textTransform: 'uppercase',
                          boxShadow: '0 4px 15px rgba(68, 136, 255, 0.3)',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(68, 136, 255, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 15px rgba(68, 136, 255, 0.3)';
                        }}
                      >
                        Send ➤
                      </button>
                    </div>
                  </div>
                )}

                {viewMode === 'blog' && (
                  <div style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '30px',
                  }}>
                    {/* Article Card */}
                    <div style={{
                      width: '100%',
                      maxWidth: '700px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '2px solid rgba(68, 136, 255, 0.3)',
                      borderRadius: '16px',
                      padding: '40px',
                      textAlign: 'center',
                    }}>
                      <h2 style={{
                        color: '#00ff88',
                        fontSize: '28px',
                        marginBottom: '20px',
                        textShadow: '0 0 15px rgba(0, 255, 136, 0.3)',
                      }}>
                        {displayArticles[currentArticleIndex]?.title || 'No Articles'}
                      </h2>
                      <div style={{
                        color: '#888',
                        fontSize: '14px',
                        marginBottom: '8px',
                      }}>
                        📅 {displayArticles[currentArticleIndex]?.date || ''}
                      </div>
                      <div style={{
                        color: '#4488ff',
                        fontSize: '14px',
                      }}>
                        ✍️ by {displayArticles[currentArticleIndex]?.author?.join(', ') || 'Unknown'}
                      </div>
                    </div>

                    {/* Navigation */}
                    <div style={{
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'center',
                    }}>
                      <button
                        onClick={() => navigateArticle('prev')}
                        style={{
                          background: 'rgba(68, 136, 255, 0.2)',
                          border: '2px solid rgba(68, 136, 255, 0.5)',
                          borderRadius: '10px',
                          padding: '12px 24px',
                          color: '#4488ff',
                          cursor: 'pointer',
                          fontSize: '15px',
                          fontWeight: 'bold',
                          fontFamily: 'monospace',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(68, 136, 255, 0.3)';
                          e.currentTarget.style.transform = 'translateX(-3px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(68, 136, 255, 0.2)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        ← PREV
                      </button>

                      <div style={{
                        color: '#666',
                        fontSize: '14px',
                      }}>
                        {currentArticleIndex + 1} / {displayArticles.length}
                      </div>

                      <button
                        onClick={() => navigateArticle('next')}
                        style={{
                          background: 'rgba(68, 136, 255, 0.2)',
                          border: '2px solid rgba(68, 136, 255, 0.5)',
                          borderRadius: '10px',
                          padding: '12px 24px',
                          color: '#4488ff',
                          cursor: 'pointer',
                          fontSize: '15px',
                          fontWeight: 'bold',
                          fontFamily: 'monospace',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(68, 136, 255, 0.3)';
                          e.currentTarget.style.transform = 'translateX(3px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(68, 136, 255, 0.2)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        NEXT →
                      </button>
                    </div>

                    <button
                      onClick={() => window.open(`/articles/${currentArticleIndex}`, '_blank')}
                      style={{
                        background: 'linear-gradient(135deg, #4488ff, #00ff88)',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '16px 48px',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                        textTransform: 'uppercase',
                        boxShadow: '0 6px 20px rgba(68, 136, 255, 0.4)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(68, 136, 255, 0.6)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(68, 136, 255, 0.4)';
                      }}
                    >
                      📖 Read Full Article
                    </button>
                  </div>
                )}

                {viewMode === 'quiz' && (
                  <QuizSystem
                    articleFilename={displayArticles[currentArticleIndex]?.filename || ''}
                    articleTitle={displayArticles[currentArticleIndex]?.title || ''}
                    onClose={() => setViewMode('blog')}
                  />
                )}

                {viewMode === 'create' && (
                  <CreationStudio onClose={() => setViewMode('chat')} />
                )}
              </div>
            </>
          ) : (
            // Page 2: Leaderboard
            <div style={{
              flex: 1,
              padding: '30px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}>
              <div style={{
                textAlign: 'center',
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#FFD700',
                textShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
                marginBottom: '10px',
              }}>
                🏆 HIGH SCORES 🏆
              </div>

              {/* Leaderboard List */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid rgba(255, 215, 0, 0.2)',
              }}>
                {loadingLeaderboard ? (
                  <div style={{
                    color: '#FFD700',
                    textAlign: 'center',
                    padding: '60px',
                    fontSize: '18px',
                  }}>
                    Loading leaderboard...
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div style={{
                    color: '#888',
                    textAlign: 'center',
                    padding: '60px',
                    fontSize: '18px',
                  }}>
                    <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎮</div>
                    <div>Be the first to set a high score!</div>
                  </div>
                ) : (
                  leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        padding: '20px',
                        margin: '12px 0',
                        background: index === 0 ? 'linear-gradient(90deg, rgba(255, 215, 0, 0.25), transparent)' :
                                   index === 1 ? 'linear-gradient(90deg, rgba(192, 192, 192, 0.25), transparent)' :
                                   index === 2 ? 'linear-gradient(90deg, rgba(205, 127, 50, 0.25), transparent)' :
                                   'rgba(255, 255, 255, 0.03)',
                        borderRadius: '12px',
                        border: index < 3 ? '2px solid rgba(255, 215, 0, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateX(5px)';
                        e.currentTarget.style.background = index === 0 ? 'linear-gradient(90deg, rgba(255, 215, 0, 0.35), transparent)' :
                                                           index === 1 ? 'linear-gradient(90deg, rgba(192, 192, 192, 0.35), transparent)' :
                                                           index === 2 ? 'linear-gradient(90deg, rgba(205, 127, 50, 0.35), transparent)' :
                                                           'rgba(255, 255, 255, 0.07)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateX(0)';
                        e.currentTarget.style.background = index === 0 ? 'linear-gradient(90deg, rgba(255, 215, 0, 0.25), transparent)' :
                                                           index === 1 ? 'linear-gradient(90deg, rgba(192, 192, 192, 0.25), transparent)' :
                                                           index === 2 ? 'linear-gradient(90deg, rgba(205, 127, 50, 0.25), transparent)' :
                                                           'rgba(255, 255, 255, 0.03)';
                      }}
                    >
                      <div style={{
                        fontSize: '28px',
                        fontWeight: 'bold',
                        width: '60px',
                        textAlign: 'center',
                        color: index === 0 ? '#FFD700' :
                               index === 1 ? '#C0C0C0' :
                               index === 2 ? '#CD7F32' :
                               '#888',
                      }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: 'bold',
                          color: '#ffffff',
                          marginBottom: '6px',
                        }}>
                          {entry.player_name}
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#888',
                        }}>
                          🔥 Combo: {entry.combo_max}x • 🎯 Accuracy: {entry.accuracy.toFixed(1)}%
                        </div>
                      </div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#FFD700',
                        textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
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
                  border: '4px solid white',
                  borderRadius: '16px',
                  padding: '24px 64px',
                  color: '#000000',
                  fontWeight: 'bold',
                  fontSize: '20px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  fontFamily: 'monospace',
                  boxShadow: '0 8px 30px rgba(255, 215, 0, 0.6)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05) translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(255, 215, 0, 0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1) translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(255, 215, 0, 0.6)';
                }}
              >
                🎮 PLAY GAME
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
