import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useSupabaseData } from './SupabaseDataContext';
import { useJourney } from './JourneyContext';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';
import WorldGallery from './WorldGallery';

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
  onStartGame?: () => void;
  onChangeScenery?: (scenery: SceneryOption) => void;
  availableScenery?: SceneryOption[];
  currentScenery?: string;
  initialView?: ViewMode;
  onToggle3DExplore?: () => void;
  is3DExploreActive?: boolean;
}

type ViewMode = 'chat' | 'game' | 'scenery' | 'about' | 'explore';

export default function TerminalInterface({
  isOpen,
  onClose,
  articles = [],
  onStartGame,
  onChangeScenery,
  availableScenery = [],
  currentScenery,
  initialView = 'chat',
  onToggle3DExplore,
  is3DExploreActive = false,
}: TerminalInterfaceProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [chatInput, setChatInput] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [enhancedArticles, setEnhancedArticles] = useState<EnhancedArticleData[]>([]);
  const [articleSearch, setArticleSearch] = useState('');
  const [articleFilter, setArticleFilter] = useState<string>('all');

  const { chatData, setChatData, chatHistory } = useSupabaseData();
  const { updateStats, currentQuest, completeQuest, missionBriefs, progress } = useJourney();
  const currentMissionBrief = currentQuest ? missionBriefs[currentQuest.id] : undefined;

  // Update viewMode when initialView changes
  useEffect(() => {
    if (isOpen) {
      setViewMode(initialView);
    }
  }, [isOpen, initialView]);

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

  // Fetch enhanced articles for explore view
  useEffect(() => {
    if (viewMode === 'explore' && isOpen && enhancedArticles.length === 0) {
      fetch('/api/articles-enhanced')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setEnhancedArticles(data);
          }
        })
        .catch(err => console.error('Failed to fetch enhanced articles:', err));
    }
  }, [viewMode, isOpen, enhancedArticles.length]);

  // Filter enhanced articles
  const filteredEnhancedArticles = enhancedArticles.filter(article => {
    const matchesSearch = !articleSearch ||
      article.title.toLowerCase().includes(articleSearch.toLowerCase()) ||
      article.description?.toLowerCase().includes(articleSearch.toLowerCase());
    const matchesFilter = articleFilter === 'all' ||
      article.horizon === articleFilter ||
      article.polarity === articleFilter ||
      article.mechanics?.includes(articleFilter as any);
    return matchesSearch && matchesFilter;
  }).slice(0, 20);

  const handleChatSubmit = useCallback(async () => {
    if (chatInput.trim()) {
      setChatData({ question: chatInput, response: chatData.response });
      setChatInput('');
      updateStats('questionsAsked', 1);
      if (currentQuest?.id === 'first-question') completeQuest('first-question');
    }
  }, [chatInput, setChatData, chatData.response, updateStats, currentQuest, completeQuest]);

  const handlePlayGame = useCallback(() => {
    if (onStartGame) {
      onStartGame();
      onClose();
    }
  }, [onStartGame, onClose]);

  const handleDownloadMissionLog = useCallback(async () => {
    try {
      const response = await fetch('/api/mission-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress,
          history: chatHistory,
          missionBriefs,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate mission log');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mission-log.md';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Mission log download failed:', error);
    }
  }, [progress, chatHistory, missionBriefs]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'explore', label: 'EXPLORE' },
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
        {/* EXPLORE */}
        {viewMode === 'explore' && (
          <div>
            {/* 3D Mode Toggle */}
            {onToggle3DExplore && (
              <button
                onClick={() => { onToggle3DExplore(); onClose(); }}
                style={{
                  width: '100%',
                  padding: isMobile ? '18px' : '16px',
                  marginBottom: '16px',
                  background: is3DExploreActive
                    ? 'linear-gradient(135deg, #6366f1 0%, #de7ea2 100%)'
                    : 'linear-gradient(135deg, #1a1a3a 0%, #2a2a4a 100%)',
                  border: is3DExploreActive ? '2px solid #a5b4fc' : '1px solid #333',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: isMobile ? '15px' : '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '18px' }}>◈</span>
                {is3DExploreActive ? 'EXIT 3D EXPLORATION' : 'ENTER 3D EXPLORATION'}
              </button>
            )}

            {/* Search */}
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                value={articleSearch}
                onChange={(e) => setArticleSearch(e.target.value)}
                placeholder="Search articles..."
                style={{
                  width: '100%',
                  padding: isMobile ? '14px' : '12px',
                  background: '#111',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: isMobile ? '16px' : '14px',
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>

            {/* Quick Filters */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '16px',
            }}>
              {[
                { value: 'all', label: 'All' },
                { value: 'NY', label: '1 Year' },
                { value: 'N5', label: '5 Years' },
                { value: 'N20', label: '20 Years' },
                { value: 'C2', label: 'Crisis' },
                { value: 'P2', label: 'Transform' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setArticleFilter(value)}
                  style={{
                    padding: '6px 12px',
                    background: articleFilter === value ? 'rgba(99, 102, 241, 0.3)' : '#111',
                    border: articleFilter === value ? '1px solid #6366f1' : '1px solid #222',
                    borderRadius: '6px',
                    color: articleFilter === value ? '#a5b4fc' : '#666',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Articles List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredEnhancedArticles.length > 0 ? (
                filteredEnhancedArticles.map((article) => (
                  <a
                    key={article.slug}
                    href={`/articles/${article.slug}`}
                    style={{
                      padding: '14px 16px',
                      background: '#111',
                      borderRadius: '8px',
                      color: '#fff',
                      textDecoration: 'none',
                      fontFamily: 'monospace',
                      display: 'block',
                      border: '1px solid #222',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: isMobile ? '14px' : '13px', marginBottom: '6px' }}>
                      {article.title}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {article.horizon && (
                        <span style={{
                          padding: '2px 6px',
                          background: 'rgba(99, 102, 241, 0.2)',
                          color: '#a5b4fc',
                          borderRadius: '3px',
                          fontSize: '10px',
                        }}>
                          {article.horizon}
                        </span>
                      )}
                      {article.polarity && article.polarity !== 'N0' && (
                        <span style={{
                          padding: '2px 6px',
                          background: 'rgba(222, 126, 162, 0.2)',
                          color: '#de7ea2',
                          borderRadius: '3px',
                          fontSize: '10px',
                        }}>
                          {article.polarity}
                        </span>
                      )}
                      <span style={{ color: '#555', fontSize: '10px' }}>
                        {article.readingTime} min
                      </span>
                    </div>
                  </a>
                ))
              ) : (
                <div style={{ color: '#555', textAlign: 'center', padding: '20px', fontFamily: 'monospace' }}>
                  {enhancedArticles.length === 0 ? 'Loading articles...' : 'No matching articles'}
                </div>
              )}
            </div>

            {/* Link to full discovery page */}
            <Link
              href="/articles"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '14px',
                marginTop: '16px',
                background: '#111',
                border: '1px solid #de7ea2',
                borderRadius: '8px',
                color: '#de7ea2',
                textDecoration: 'none',
                fontFamily: 'monospace',
                fontSize: '12px',
              }}
            >
              VIEW ALL ARTICLES →
            </Link>
          </div>
        )}

        {/* CHAT */}
        {viewMode === 'chat' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {currentQuest && (
              <div style={{
                background: '#0f1410',
                borderRadius: '8px',
                padding: isMobile ? '12px' : '14px 16px',
                marginBottom: '12px',
                border: '1px solid #1c2b1c',
                fontFamily: 'monospace',
              }}>
                <div style={{ color: '#8f8', fontSize: '11px', marginBottom: '6px' }}>
                  MISSION BRIEF — {currentQuest.title.toUpperCase()}
                </div>
                <div style={{ color: '#cfc', fontSize: isMobile ? '13px' : '12px', lineHeight: 1.6 }}>
                  {currentMissionBrief || '✨ Ready when you are! Ask me anything and let\'s kick off this adventure together.'}
                </div>
              </div>
            )}
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
              {chatData.response && !chatData.response.includes('ready to chat whenever you are') ? (
                <>
                  <div style={{ color: '#0f0', marginBottom: '12px' }}>
                    <span style={{ color: '#555' }}>you:</span> {chatData.question}
                  </div>
                  <div style={{ color: '#ccc', whiteSpace: 'pre-wrap' }}>
                    <span style={{ color: '#555' }}>ai:</span> {chatData.response}
                  </div>
                </>
              ) : (
                <div style={{ color: '#8f8', lineHeight: 1.6 }}>
                  🚀 Hey there! I&apos;m Ship AI, and I&apos;m genuinely excited to help you discover Alex&apos;s work!
                  <br/><br/>
                  Ask me anything - I love talking about Alex&apos;s projects, skills, experience, and the cool stuff he&apos;s built.
                  Let&apos;s have a great conversation!
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                placeholder="What would you love to know? 🚀"
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
            <div style={{ marginTop: '12px' }}>
              <button
                onClick={handleDownloadMissionLog}
                style={{
                  width: '100%',
                  padding: isMobile ? '12px' : '10px',
                  background: '#111',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#8f8',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  letterSpacing: '0.4px',
                }}
              >
                DOWNLOAD MISSION LOG
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
            <WorldGallery
              onSelectWorld={(world) => onChangeScenery?.(world)}
              currentWorld={currentScenery}
              isMobile={isMobile}
            />
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
