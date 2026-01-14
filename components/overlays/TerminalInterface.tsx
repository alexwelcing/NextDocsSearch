import React, { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useSupabaseData } from '../contexts/SupabaseDataContext';
import { useJourney } from '../contexts/JourneyContext';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';
import WorldGallery from '../WorldGallery';

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
  onToggleArticleDisplay?: () => void;
  isArticleDisplayOpen?: boolean;
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
  onToggleArticleDisplay,
  isArticleDisplayOpen = false,
}: TerminalInterfaceProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [chatInput, setChatInput] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [enhancedArticles, setEnhancedArticles] = useState<EnhancedArticleData[]>([]);
  const [articleSearch, setArticleSearch] = useState('');
  const [articleFilter, setArticleFilter] = useState<string>('all');
  const [isChatFocused, setIsChatFocused] = useState(false);

  const { chatData, sendMessage, chatHistory } = useSupabaseData();
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

  // Intelligent diversity scoring for article selection
  const scoreDiversity = (articles: EnhancedArticleData[]): EnhancedArticleData[] => {
    if (articles.length <= 20) return articles;

    // Create a diversity-aware selection
    const result: EnhancedArticleData[] = [];
    const usedPolarities = new Map<string, number>();
    const usedHorizons = new Map<string, number>();
    const usedDomains = new Set<string>();

    // Score each article based on how much diversity it adds
    const scoredArticles = articles.map(article => {
      const polarity = article.polarity || 'N0';
      const horizon = article.horizon || 'NY';
      const domains = article.domains || [];

      let diversityScore = 0;

      // Lower polarity count = higher diversity value
      diversityScore += Math.max(0, 3 - (usedPolarities.get(polarity) || 0));
      // Lower horizon count = higher diversity value
      diversityScore += Math.max(0, 3 - (usedHorizons.get(horizon) || 0));
      // New domains add diversity
      diversityScore += domains.filter(d => !usedDomains.has(d)).length * 0.5;
      // Recent articles get slight boost
      const daysSincePublished = (Date.now() - new Date(article.date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublished < 30) diversityScore += 1;

      return { article, diversityScore };
    });

    // Sort by diversity score (highest first) then pick top 20
    scoredArticles.sort((a, b) => b.diversityScore - a.diversityScore);

    for (const { article } of scoredArticles.slice(0, 20)) {
      result.push(article);
      const polarity = article.polarity || 'N0';
      const horizon = article.horizon || 'NY';
      usedPolarities.set(polarity, (usedPolarities.get(polarity) || 0) + 1);
      usedHorizons.set(horizon, (usedHorizons.get(horizon) || 0) + 1);
      (article.domains || []).forEach(d => usedDomains.add(d));
    }

    return result;
  };

  // Filter enhanced articles with diversity awareness
  const filteredEnhancedArticles = (() => {
    let filtered = enhancedArticles.filter(article => {
      const matchesSearch = !articleSearch ||
        article.title.toLowerCase().includes(articleSearch.toLowerCase()) ||
        article.description?.toLowerCase().includes(articleSearch.toLowerCase());
      const matchesFilter = articleFilter === 'all' ||
        article.horizon === articleFilter ||
        article.polarity === articleFilter ||
        article.mechanics?.includes(articleFilter as any);
      return matchesSearch && matchesFilter;
    });

    // Apply diversity scoring when showing all articles without search
    if (!articleSearch && articleFilter === 'all') {
      filtered = scoreDiversity(filtered);
    }

    return filtered.slice(0, 20);
  })();

  const handleChatSubmit = useCallback(async () => {
    if (chatInput.trim()) {
      sendMessage(chatInput);
      setChatInput('');
      updateStats('questionsAsked', 1);
      if (currentQuest?.id === 'first-question') completeQuest('first-question');
    }
  }, [chatInput, sendMessage, updateStats, currentQuest, completeQuest]);

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

  // Calculate terminal dimensions based on chat focus
  const isExpanded = isChatFocused && viewMode === 'chat';
  const terminalWidth = isMobile 
    ? '100%' 
    : isExpanded 
      ? 'min(95vw, 900px)'  // Expanded width for desktop
      : 'min(95vw, 600px)';
  const terminalHeight = isMobile
    ? isExpanded ? '85vh' : '70vh'  // Expanded height for mobile
    : isExpanded ? '80vh' : '65vh';  // Expanded height for desktop

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        // Close when clicking the backdrop
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Terminal Interface"
        style={{
          width: terminalWidth,
          maxHeight: terminalHeight,
          background: 'rgba(10, 10, 10, 0.95)',
          borderRadius: isMobile ? '20px 20px 0 0' : '16px 16px 0 0',
          border: '1px solid #222',
          borderBottom: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
          transition: 'all 0.3s ease-in-out',
        }}
      >
      {/* Header */}
      <div style={{
        height: isMobile ? '50px' : '44px',
        background: 'rgba(17, 17, 17, 0.9)',
        borderBottom: '1px solid #222',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ color: '#0f0', fontFamily: 'monospace', fontSize: '14px' }}>
          {'>_'} terminal
        </div>
        <button
          onClick={onClose}
          aria-label="Close terminal"
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
        background: 'rgba(13, 13, 13, 0.9)',
        flexShrink: 0,
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
        minHeight: 0,
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
                    ? 'rgba(0, 212, 255, 0.15)'
                    : 'rgba(10, 10, 26, 0.8)',
                  border: is3DExploreActive ? '2px solid rgba(0, 212, 255, 0.5)' : '1px solid #222',
                  borderRadius: '6px',
                  color: is3DExploreActive ? '#00d4ff' : '#fff',
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
                {is3DExploreActive ? 'EXIT 3D GALAXY VIEW' : 'ENTER 3D GALAXY VIEW'}
              </button>
            )}

            {/* Article Panel Toggle */}
            {onToggleArticleDisplay && (
              <button
                onClick={() => { onToggleArticleDisplay(); onClose(); }}
                style={{
                  width: '100%',
                  padding: isMobile ? '18px' : '16px',
                  marginBottom: '16px',
                  background: isArticleDisplayOpen
                    ? 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)'
                    : 'linear-gradient(135deg, #1a1a3a 0%, #2a2a4a 100%)',
                  border: isArticleDisplayOpen ? '2px solid #00ffff' : '1px solid #333',
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
                <span style={{ fontSize: '18px' }}>▣</span>
                {isArticleDisplayOpen ? 'CLOSE ARTICLE PANEL' : 'OPEN ARTICLE PANEL'}
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
                    background: articleFilter === value ? 'rgba(0, 212, 255, 0.15)' : '#111',
                    border: articleFilter === value ? '1px solid rgba(0, 212, 255, 0.4)' : '1px solid #222',
                    borderRadius: '4px',
                    color: articleFilter === value ? '#00d4ff' : '#666',
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
                          background: 'rgba(0, 212, 255, 0.15)',
                          color: '#00d4ff',
                          borderRadius: '3px',
                          fontSize: '10px',
                        }}>
                          {article.horizon}
                        </span>
                      )}
                      {article.polarity && article.polarity !== 'N0' && (
                        <span style={{
                          padding: '2px 6px',
                          background: 'rgba(255, 215, 0, 0.15)',
                          color: '#ffd700',
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
                background: 'rgba(0, 212, 255, 0.08)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: '6px',
                color: '#00d4ff',
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
                onFocus={() => setIsChatFocused(true)}
                onBlur={() => setIsChatFocused(false)}
                placeholder="What would you love to know? 🚀"
                aria-label="Chat input"
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
                aria-label="Send message"
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
            {/* Notice when in 3D exploration mode */}
            {is3DExploreActive && (
              <div style={{
                padding: '12px 16px',
                marginBottom: '16px',
                background: 'rgba(0, 212, 255, 0.1)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#00d4ff',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>3D EXPLORATION ACTIVE</div>
                <div style={{ color: '#9ca3af' }}>
                  Selecting a scene will exit 3D exploration mode and load the background.
                </div>
              </div>
            )}
            <WorldGallery
              onSelectWorld={(world) => {
                onChangeScenery?.(world);
                // If 3D exploration is active, close the terminal after selecting a scene
                if (is3DExploreActive && onToggle3DExplore) {
                  onToggle3DExplore();
                }
              }}
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
    </div>
  );
}
