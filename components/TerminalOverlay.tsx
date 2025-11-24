import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSupabaseData } from './SupabaseDataContext';
import { useJourney } from './JourneyContext';
import { R3FTopic, R3F_KNOWLEDGE_INDEX, searchTopics, getTopicsByCategory } from '../lib/knowledge/r3f-taxonomy';
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

interface TerminalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  articles?: ArticleData[];
  onStartGame?: () => void;
}

// Terminal tab modes - chat is always unlocked, others require quest completion
type TabMode = 'chat' | 'articles' | 'quiz' | 'create' | 'leaderboard';

/**
 * Simplified terminal overlay component with external state control.
 * Completely independent from 3D scene for reliable rendering.
 */
export default function TerminalOverlay({
  isOpen,
  onClose,
  articles = [],
  onStartGame
}: TerminalOverlayProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('chat');
  const [chatInput, setChatInput] = useState('');
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  
  // R3F Knowledge state
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<R3FTopic | null>(null);

  const { chatData, setChatData } = useSupabaseData();
  const { isFeatureUnlocked, completeQuest, updateStats, currentQuest } = useJourney();

  const displayArticles = useMemo(() => articles.length > 0 ? articles : [
    { title: "Getting Started", date: "2024-10-01", author: ["Team"] },
    { title: "Advanced Features", date: "2024-10-15", author: ["Team"] },
    { title: "Best Practices", date: "2024-10-20", author: ["Team"] },
  ], [articles]);

  // Filtered R3F knowledge topics
  const filteredTopics = useMemo(() => {
    let topics = R3F_KNOWLEDGE_INDEX;
    if (knowledgeSearch) {
      topics = searchTopics(knowledgeSearch);
    } else if (selectedCategory) {
      topics = getTopicsByCategory(selectedCategory);
    }
    return topics;
  }, [knowledgeSearch, selectedCategory]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const response = await fetch('/api/game/get-leaderboard');
      if (!response.ok) {
        setLeaderboard([]);
        return;
      }
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [isOpen, activeTab, fetchLeaderboard]);

  // Handle chat submission
  const handleChatSubmit = useCallback(async () => {
    if (!chatInput.trim()) return;

    const question = chatInput.trim();
    setChatInput('');
    setChatData({ question, response: 'Thinking...' });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question }),
      });

      const data = await response.json();
      setChatData({ question, response: data.response || 'No response received.' });
      
      // Track progress
      updateStats('questionsAsked', 1);
      if (currentQuest?.id === 'first-question') {
        completeQuest('first-question');
      }
    } catch (error) {
      setChatData({ question, response: 'Error: Could not reach AI service.' });
    }
  }, [chatInput, setChatData, updateStats, currentQuest, completeQuest]);

  // Handle article view
  const handleArticleView = useCallback((index: number) => {
    setCurrentArticleIndex(index);
    const article = displayArticles[index];
    if (article?.title) {
      setTimeout(() => {
        updateStats('articlesRead', article.title);
      }, 2000);
    }
  }, [displayArticles, updateStats]);

  if (!isOpen) {
    return null;
  }

  // Tab button component
  const TabButton = ({ mode, label, icon }: { mode: TabMode; label: string; icon: string }) => {
    const isActive = activeTab === mode;
    const isLocked = !isFeatureUnlocked(mode === 'leaderboard' ? 'leaderboard' : mode);

    return (
      <button
        onClick={() => !isLocked && setActiveTab(mode)}
        disabled={isLocked}
        style={{
          padding: '14px 28px',
          fontSize: '20px',
          fontWeight: 'bold',
          fontFamily: 'monospace',
          color: isActive ? '#00ff88' : isLocked ? '#555' : '#ffffff',
          background: isActive 
            ? 'linear-gradient(135deg, #004d00 0%, #00ff88 100%)'
            : isLocked
            ? 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)'
            : 'linear-gradient(135deg, #1a2332 0%, #2a3f5f 100%)',
          border: `3px solid ${isActive ? '#00ff88' : isLocked ? '#333' : 'rgba(255, 255, 255, 0.2)'}`,
          borderRadius: '12px',
          cursor: isLocked ? 'not-allowed' : 'pointer',
          boxShadow: isActive 
            ? '0 0 20px rgba(0, 255, 136, 0.6), inset 0 2px 8px rgba(255, 255, 255, 0.2)'
            : '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
          transition: 'all 0.3s ease',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          textShadow: isActive ? '0 0 10px rgba(0, 255, 136, 0.8)' : 'none',
          opacity: isLocked ? 0.5 : 1,
          flex: 1,
          minWidth: '140px',
        }}
        onMouseEnter={(e) => {
          if (!isLocked && !isActive) {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 255, 255, 0.2), inset 0 2px 4px rgba(255, 255, 255, 0.2)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isLocked && !isActive) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.1)';
          }
        }}
      >
        {icon} {label}
      </button>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '90%',
          maxWidth: '1400px',
          height: '85%',
          maxHeight: '900px',
          background: 'linear-gradient(135deg, #0a1628 0%, #1a2d47 50%, #0a1628 100%)',
          border: '4px solid #00ff88',
          borderRadius: '24px',
          boxShadow: '0 20px 80px rgba(0, 255, 136, 0.3), inset 0 4px 16px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 32px',
            background: 'linear-gradient(135deg, #0d1f36 0%, #1a3352 100%)',
            borderBottom: '3px solid #00ff88',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              color: '#00ff88',
              letterSpacing: '3px',
              textShadow: '0 0 15px rgba(0, 255, 136, 0.8)',
            }}
          >
            ▶ TERMINAL
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              fontSize: '18px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              color: '#ffffff',
              background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255, 68, 68, 0.4)',
              transition: 'all 0.2s ease',
              letterSpacing: '2px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 68, 68, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 68, 68, 0.4)';
            }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            padding: '20px 32px',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            background: 'rgba(0, 0, 0, 0.3)',
            borderBottom: '2px solid rgba(0, 255, 136, 0.3)',
          }}
        >
          <TabButton mode="chat" label="AI CHAT" icon="💬" />
          <TabButton mode="articles" label="ARTICLES" icon="📚" />
          <TabButton mode="quiz" label="QUIZ" icon="❓" />
          <TabButton mode="create" label="CREATE" icon="🎨" />
          <TabButton mode="leaderboard" label="LEADERBOARD" icon="🏆" />
        </div>

        {/* Content Area */}
        <div
          style={{
            flex: 1,
            padding: '32px',
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
              <div
                style={{
                  flex: 1,
                  padding: '24px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '12px',
                  border: '2px solid rgba(0, 255, 136, 0.3)',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '16px',
                  color: '#ffffff',
                  lineHeight: '1.6',
                }}
              >
                {chatData.question && (
                  <>
                    <div style={{ marginBottom: '20px' }}>
                      <strong style={{ color: '#00ff88' }}>YOU:</strong>
                      <p style={{ margin: '8px 0', color: '#ffffff' }}>{chatData.question}</p>
                    </div>
                    <div>
                      <strong style={{ color: '#4488ff' }}>AI:</strong>
                      <p style={{ margin: '8px 0', color: '#cccccc' }}>{chatData.response}</p>
                    </div>
                  </>
                )}
                {!chatData.question && (
                  <p style={{ color: '#888', textAlign: 'center', marginTop: '40px' }}>
                    Ask me anything about React Three Fiber...
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                  placeholder="Type your question..."
                  style={{
                    flex: 1,
                    padding: '16px 20px',
                    fontSize: '18px',
                    fontFamily: 'monospace',
                    background: 'rgba(0, 0, 0, 0.6)',
                    border: '2px solid rgba(0, 255, 136, 0.5)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleChatSubmit}
                  style={{
                    padding: '16px 32px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    background: 'linear-gradient(135deg, #0066ff 0%, #00ff88 100%)',
                    border: '3px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    letterSpacing: '2px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  SEND
                </button>
              </div>
            </div>
          )}

          {/* Articles Tab */}
          {activeTab === 'articles' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  flex: 1,
                  padding: '32px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '12px',
                  border: '2px solid rgba(0, 255, 136, 0.3)',
                  overflowY: 'auto',
                }}
              >
                <h3
                  style={{
                    fontSize: '26px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    color: '#00ff88',
                    marginBottom: '16px',
                    letterSpacing: '2px',
                  }}
                >
                  {displayArticles[currentArticleIndex]?.title}
                </h3>
                <p style={{ fontSize: '16px', fontFamily: 'monospace', color: '#888', marginBottom: '24px' }}>
                  {displayArticles[currentArticleIndex]?.date} • By{' '}
                  {displayArticles[currentArticleIndex]?.author?.join(', ')}
                </p>
                <div style={{ fontSize: '18px', lineHeight: '1.8', color: '#cccccc', fontFamily: 'sans-serif' }}>
                  <p>Article content would be displayed here...</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => handleArticleView(Math.max(0, currentArticleIndex - 1))}
                  disabled={currentArticleIndex === 0}
                  style={{
                    padding: '14px 28px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    color: currentArticleIndex === 0 ? '#555' : '#ffffff',
                    background: currentArticleIndex === 0 
                      ? 'rgba(0, 0, 0, 0.5)' 
                      : 'linear-gradient(135deg, #1a2332 0%, #2a3f5f 100%)',
                    border: '3px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    cursor: currentArticleIndex === 0 ? 'not-allowed' : 'pointer',
                    letterSpacing: '2px',
                    opacity: currentArticleIndex === 0 ? 0.5 : 1,
                  }}
                >
                  ◀ PREV
                </button>
                <button
                  onClick={() => handleArticleView(Math.min(displayArticles.length - 1, currentArticleIndex + 1))}
                  disabled={currentArticleIndex === displayArticles.length - 1}
                  style={{
                    padding: '14px 28px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    color: currentArticleIndex === displayArticles.length - 1 ? '#555' : '#ffffff',
                    background: currentArticleIndex === displayArticles.length - 1 
                      ? 'rgba(0, 0, 0, 0.5)' 
                      : 'linear-gradient(135deg, #1a2332 0%, #2a3f5f 100%)',
                    border: '3px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    cursor: currentArticleIndex === displayArticles.length - 1 ? 'not-allowed' : 'pointer',
                    letterSpacing: '2px',
                    opacity: currentArticleIndex === displayArticles.length - 1 ? 0.5 : 1,
                  }}
                >
                  NEXT ▶
                </button>
              </div>
            </div>
          )}

          {/* Quiz Tab */}
          {activeTab === 'quiz' && (
            <div style={{ height: '100%', padding: '32px', background: 'rgba(0, 0, 0, 0.4)', borderRadius: '12px', border: '2px solid rgba(0, 255, 136, 0.3)' }}>
              <QuizSystem
                articleFilename={displayArticles[currentArticleIndex]?.filename || 'getting-started'}
                articleTitle={displayArticles[currentArticleIndex]?.title || 'Getting Started'}
                onClose={() => setActiveTab('articles')}
              />
            </div>
          )}

          {/* Create Tab */}
          {activeTab === 'create' && (
            <div style={{ height: '100%' }}>
              <CreationStudio />
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  flex: 1,
                  padding: '24px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '12px',
                  border: '2px solid rgba(0, 255, 136, 0.3)',
                  overflowY: 'auto',
                }}
              >
                <h3
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    color: '#00ff88',
                    marginBottom: '24px',
                    textAlign: 'center',
                    letterSpacing: '2px',
                  }}
                >
                  🏆 TOP SCORES
                </h3>
                {loadingLeaderboard ? (
                  <p style={{ textAlign: 'center', color: '#888', fontSize: '18px' }}>Loading...</p>
                ) : leaderboard.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#888', fontSize: '18px' }}>No scores yet. Be the first!</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {leaderboard.map((entry, index) => (
                      <div
                        key={entry.id}
                        style={{
                          padding: '16px 24px',
                          background: index === 0 
                            ? 'linear-gradient(135deg, #ffd700 0%, #ffaa00 100%)'
                            : 'rgba(0, 0, 0, 0.5)',
                          border: `2px solid ${index === 0 ? '#ffd700' : 'rgba(255, 255, 255, 0.2)'}`,
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontFamily: 'monospace',
                          fontSize: '18px',
                          color: index === 0 ? '#000' : '#ffffff',
                        }}
                      >
                        <span style={{ fontWeight: 'bold' }}>#{index + 1}</span>
                        <span>{entry.player_name}</span>
                        <span style={{ fontWeight: 'bold' }}>{entry.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {onStartGame && (
                <button
                  onClick={() => {
                    onClose();
                    onStartGame();
                  }}
                  style={{
                    padding: '16px 32px',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    color: '#ffffff',
                    background: 'linear-gradient(135deg, #ff6600 0%, #ff0066 100%)',
                    border: '3px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    boxShadow: '0 8px 24px rgba(255, 102, 0, 0.5)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 12px 36px rgba(255, 102, 0, 0.7)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 102, 0, 0.5)';
                  }}
                >
                  🎮 PLAY GAME
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
