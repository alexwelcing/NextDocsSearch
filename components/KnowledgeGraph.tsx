/**
 * KnowledgeGraph Component
 * 
 * Visual knowledge graph for navigating topics and their relationships
 * Uses existing r3f-taxonomy infrastructure
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  R3F_KNOWLEDGE_INDEX,
  R3F_CATEGORIES,
  getTopicsByCategory,
  type R3FTopic,
} from '../lib/knowledge/r3f-taxonomy';

interface KnowledgeGraphProps {
  onTopicSelect?: (topic: R3FTopic) => void;
  selectedTopic?: R3FTopic | null;
}

export default function KnowledgeGraph({ onTopicSelect, selectedTopic }: KnowledgeGraphProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<R3FTopic['difficulty'] | ''>('');

  // Group topics by category
  const topicsByCategory = useMemo(() => {
    const grouped = new Map<string, R3FTopic[]>();
    
    Object.values(R3F_CATEGORIES).forEach(category => {
      grouped.set(category, getTopicsByCategory(category));
    });

    return grouped;
  }, []);

  // Filter topics based on search and difficulty
  const filteredCategories = useMemo(() => {
    const filtered = new Map<string, R3FTopic[]>();

    topicsByCategory.forEach((topics, category) => {
      let filteredTopics = topics;

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredTopics = filteredTopics.filter(topic =>
          topic.title.toLowerCase().includes(query) ||
          topic.keywords.some(k => k.toLowerCase().includes(query)) ||
          topic.subcategory.toLowerCase().includes(query)
        );
      }

      // Apply difficulty filter
      if (selectedDifficulty) {
        filteredTopics = filteredTopics.filter(topic =>
          topic.difficulty === selectedDifficulty
        );
      }

      if (filteredTopics.length > 0) {
        filtered.set(category, filteredTopics);
      }
    });

    return filtered;
  }, [topicsByCategory, searchQuery, selectedDifficulty]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedCategories(new Set(Array.from(filteredCategories.keys())));
  }, [filteredCategories]);

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  const totalTopics = Array.from(filteredCategories.values())
    .reduce((sum, topics) => sum + topics.length, 0);

  const difficultyColors = {
    beginner: '#00ff88',
    intermediate: '#4488ff',
    advanced: '#FFD700',
    expert: '#ff4444',
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid rgba(68, 136, 255, 0.2)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}>
          <h2 style={{
            color: '#4488ff',
            fontSize: '20px',
            fontFamily: 'monospace',
            margin: 0,
          }}>
            📊 Knowledge Graph
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={expandAll}
              style={{
                background: 'rgba(68, 136, 255, 0.2)',
                border: '2px solid rgba(68, 136, 255, 0.5)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: '#4488ff',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              style={{
                background: 'rgba(68, 136, 255, 0.2)',
                border: '2px solid rgba(68, 136, 255, 0.5)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: '#4488ff',
                cursor: 'pointer',
                fontSize: '12px',
                fontFamily: 'monospace',
              }}
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Search topics..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '2px solid rgba(68, 136, 255, 0.3)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#ffffff',
            fontSize: '13px',
            fontFamily: 'monospace',
            outline: 'none',
            marginBottom: '8px',
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

        {/* Difficulty Filter */}
        <select
          value={selectedDifficulty}
          onChange={(e) => setSelectedDifficulty(e.target.value as R3FTopic['difficulty'] | '')}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '2px solid rgba(68, 136, 255, 0.3)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#ffffff',
            fontSize: '13px',
            fontFamily: 'monospace',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <option value="">All Difficulty Levels</option>
          <option value="beginner">🟢 Beginner</option>
          <option value="intermediate">🔵 Intermediate</option>
          <option value="advanced">🟡 Advanced</option>
          <option value="expert">🔴 Expert</option>
        </select>

        {/* Stats */}
        <div style={{
          marginTop: '12px',
          color: '#888',
          fontSize: '12px',
          fontFamily: 'monospace',
        }}>
          {totalTopics} topics across {filteredCategories.size} categories
        </div>
      </div>

      {/* Graph Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px',
      }}>
        {filteredCategories.size === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#666',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
            <div>No topics found matching your criteria</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from(filteredCategories.entries()).map(([category, topics]) => (
              <CategoryNode
                key={category}
                category={category}
                topics={topics}
                isExpanded={expandedCategories.has(category)}
                onToggle={() => toggleCategory(category)}
                onTopicSelect={onTopicSelect}
                selectedTopic={selectedTopic}
                difficultyColors={difficultyColors}
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(68, 136, 255, 0.2)',
      }}>
        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          fontSize: '11px',
          color: '#888',
          fontFamily: 'monospace',
        }}>
          <span>🟢 Beginner</span>
          <span>🔵 Intermediate</span>
          <span>🟡 Advanced</span>
          <span>🔴 Expert</span>
        </div>
      </div>
    </div>
  );
}

// Category Node Component
interface CategoryNodeProps {
  category: string;
  topics: R3FTopic[];
  isExpanded: boolean;
  onToggle: () => void;
  onTopicSelect?: (topic: R3FTopic) => void;
  selectedTopic?: R3FTopic | null;
  difficultyColors: Record<R3FTopic['difficulty'], string>;
}

function CategoryNode({
  category,
  topics,
  isExpanded,
  onToggle,
  onTopicSelect,
  selectedTopic,
  difficultyColors,
}: CategoryNodeProps) {
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null);

  // Group by subcategory
  const topicsBySubcategory = useMemo(() => {
    const grouped = new Map<string, R3FTopic[]>();
    
    topics.forEach(topic => {
      const subcategory = topic.subcategory;
      if (!grouped.has(subcategory)) {
        grouped.set(subcategory, []);
      }
      grouped.get(subcategory)!.push(topic);
    });

    return grouped;
  }, [topics]);

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.3)',
      border: '2px solid rgba(68, 136, 255, 0.3)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {/* Category Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          background: isExpanded ? 'rgba(68, 136, 255, 0.2)' : 'transparent',
          border: 'none',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isExpanded) {
            e.currentTarget.style.background = 'rgba(68, 136, 255, 0.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isExpanded) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{
            color: '#4488ff',
            fontSize: '16px',
            fontWeight: 'bold',
          }}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span style={{
            color: '#00ff88',
            fontSize: '15px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
          }}>
            {category}
          </span>
        </div>
        <div style={{
          background: 'rgba(68, 136, 255, 0.3)',
          borderRadius: '12px',
          padding: '4px 10px',
          color: '#4488ff',
          fontSize: '12px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }}>
          {topics.length}
        </div>
      </button>

      {/* Topics */}
      {isExpanded && (
        <div style={{
          padding: '8px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {Array.from(topicsBySubcategory.entries()).map(([subcategory, subTopics]) => (
            <div key={subcategory} style={{ marginBottom: '8px' }}>
              {/* Subcategory Label */}
              <div style={{
                color: '#888',
                fontSize: '12px',
                fontFamily: 'monospace',
                marginBottom: '6px',
                marginLeft: '8px',
              }}>
                {subcategory}
              </div>

              {/* Topics in subcategory */}
              {subTopics.map(topic => {
                const isSelected = selectedTopic?.id === topic.id;
                const isHovered = hoveredTopic === topic.id;
                const difficultyColor = difficultyColors[topic.difficulty];

                const difficultyEmoji = {
                  beginner: '🟢',
                  intermediate: '🔵',
                  advanced: '🟡',
                  expert: '🔴',
                };

                return (
                  <button
                    key={topic.id}
                    onClick={() => onTopicSelect?.(topic)}
                    onMouseEnter={() => setHoveredTopic(topic.id)}
                    onMouseLeave={() => setHoveredTopic(null)}
                    style={{
                      width: '100%',
                      background: isSelected
                        ? 'rgba(68, 136, 255, 0.3)'
                        : isHovered
                        ? 'rgba(68, 136, 255, 0.15)'
                        : 'transparent',
                      border: isSelected ? '2px solid #4488ff' : '2px solid transparent',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>
                      {difficultyEmoji[topic.difficulty]}
                    </span>
                    <span style={{
                      flex: 1,
                      color: isSelected ? '#4488ff' : '#ffffff',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                    }}>
                      {topic.title}
                    </span>
                    {topic.seoValue >= 8 && (
                      <span style={{
                        background: 'rgba(255, 215, 0, 0.2)',
                        border: '1px solid rgba(255, 215, 0, 0.5)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        color: '#FFD700',
                        fontSize: '10px',
                        fontWeight: 'bold',
                      }}>
                        SEO
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
