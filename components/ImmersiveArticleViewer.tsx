import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Text, Billboard, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';

// Environment configuration - maps splat files to curated article selections
export interface EnvironmentConfig {
  id: string;
  name: string;
  splatPath: string;
  description: string;
  // Curated article slugs for this environment (if empty, uses filter)
  curatedArticles?: string[];
  // Or filter by these properties
  filter?: {
    horizons?: string[];
    polarities?: string[];
    mechanics?: string[];
  };
  // Spawn configuration
  spawn: {
    center: [number, number, number];
    radius: number;
    height: number;
    arrangement: 'orbital' | 'constellation' | 'amphitheater' | 'spiral';
  };
  // Visual theme
  theme: {
    primaryColor: string;
    accentColor: string;
    cardOpacity: number;
  };
}

// Default environment for the existing splat
export const DEFAULT_ENVIRONMENT: EnvironmentConfig = {
  id: 'nexus',
  name: 'The Nexus',
  splatPath: '/splats/splat4s.spz',
  description: 'Central hub for exploring speculative futures',
  spawn: {
    center: [0, 1.6, 0],
    radius: 4,
    height: 0.5,
    arrangement: 'orbital',
  },
  theme: {
    primaryColor: '#6366f1',
    accentColor: '#de7ea2',
    cardOpacity: 0.92,
  },
};

// Floating article card in 3D space
interface ArticleCard3DProps {
  article: EnhancedArticleData;
  position: [number, number, number];
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onBlur: () => void;
  theme: EnvironmentConfig['theme'];
}

function ArticleCard3D({
  article,
  position,
  index,
  isSelected,
  isFocused,
  onSelect,
  onFocus,
  onBlur,
  theme,
}: ArticleCard3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const cardRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const baseY = position[1];

  // Smooth floating animation
  useFrame((state) => {
    if (groupRef.current) {
      // Gentle float
      const floatOffset = Math.sin(state.clock.elapsedTime * 0.5 + index * 0.7) * 0.05;
      groupRef.current.position.y = baseY + floatOffset;

      // Face camera when focused or selected
      if (isFocused || isSelected) {
        groupRef.current.lookAt(state.camera.position);
      } else {
        // Gentle rotation otherwise
        groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2 + index) * 0.1;
      }
    }

    if (cardRef.current) {
      // Scale pulse on hover/focus
      const targetScale = hovered || isFocused ? 1.08 : 1;
      cardRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );
    }
  });

  const polarityColors: Record<string, string> = {
    C3: '#ef4444', C2: '#f97316', C1: '#eab308',
    N0: '#9ca3af',
    P1: '#22c55e', P2: '#14b8a6', P3: '#06b6d4',
  };

  const cardColor = polarityColors[article.polarity || 'N0'];

  return (
    <group ref={groupRef} position={position}>
      {/* Glow ring when focused */}
      {(isFocused || isSelected) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
          <ringGeometry args={[0.5, 0.55, 32]} />
          <meshBasicMaterial color={theme.accentColor} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Card background */}
      <RoundedBox
        ref={cardRef}
        args={[1.2, 0.7, 0.02]}
        radius={0.04}
        smoothness={4}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onFocus(); }}
        onPointerOut={() => { setHovered(false); onBlur(); }}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <meshStandardMaterial
          color="#0a0a12"
          transparent
          opacity={theme.cardOpacity}
          roughness={0.3}
          metalness={0.1}
        />
      </RoundedBox>

      {/* Accent border */}
      <RoundedBox args={[1.22, 0.72, 0.01]} radius={0.04} smoothness={4} position={[0, 0, -0.01]}>
        <meshBasicMaterial color={cardColor} transparent opacity={0.4} />
      </RoundedBox>

      {/* Title */}
      <Text
        position={[0, 0.15, 0.02]}
        fontSize={0.065}
        maxWidth={1}
        textAlign="center"
        color="#ffffff"
        anchorY="middle"
        font="/fonts/inter-medium.woff"
      >
        {article.title.length > 50 ? article.title.substring(0, 47) + '...' : article.title}
      </Text>

      {/* Metadata badges */}
      <group position={[0, -0.12, 0.02]}>
        {article.horizon && (
          <Text
            position={[-0.25, 0, 0]}
            fontSize={0.04}
            color={theme.primaryColor}
            anchorX="center"
          >
            {article.horizon}
          </Text>
        )}
        <Text
          position={[0, 0, 0]}
          fontSize={0.04}
          color={cardColor}
          anchorX="center"
        >
          {article.polarity || 'N0'}
        </Text>
        <Text
          position={[0.25, 0, 0]}
          fontSize={0.04}
          color="#6b7280"
          anchorX="center"
        >
          {article.readingTime}m
        </Text>
      </group>

      {/* Selection indicator */}
      {isSelected && (
        <mesh position={[0, -0.28, 0.02]}>
          <circleGeometry args={[0.03, 16]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
      )}
    </group>
  );
}

// Full article detail panel (appears when selected)
interface DetailPanelProps {
  article: EnhancedArticleData;
  position: [number, number, number];
  onClose: () => void;
  onNavigate: () => void;
  theme: EnvironmentConfig['theme'];
}

function DetailPanel({ article, position, onClose, onNavigate, theme }: DetailPanelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.lookAt(camera.position);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Background panel */}
      <RoundedBox args={[2, 1.4, 0.02]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color="#0a0a12" transparent opacity={0.95} />
      </RoundedBox>

      {/* Border glow */}
      <RoundedBox args={[2.04, 1.44, 0.01]} radius={0.06} smoothness={4} position={[0, 0, -0.01]}>
        <meshBasicMaterial color={theme.accentColor} transparent opacity={0.3} />
      </RoundedBox>

      {/* Title */}
      <Text
        position={[0, 0.5, 0.02]}
        fontSize={0.08}
        maxWidth={1.8}
        textAlign="center"
        color="#ffffff"
        anchorY="top"
      >
        {article.title}
      </Text>

      {/* Description */}
      <Text
        position={[0, 0.15, 0.02]}
        fontSize={0.05}
        maxWidth={1.7}
        textAlign="center"
        color="#9ca3af"
        anchorY="top"
        lineHeight={1.4}
      >
        {article.description?.substring(0, 150) + '...'}
      </Text>

      {/* Metadata */}
      <group position={[0, -0.25, 0.02]}>
        <Text position={[-0.4, 0, 0]} fontSize={0.045} color={theme.primaryColor}>
          {article.horizon || 'N/A'}
        </Text>
        <Text position={[0, 0, 0]} fontSize={0.045} color={theme.accentColor}>
          {article.polarity || 'N0'}
        </Text>
        <Text position={[0.4, 0, 0]} fontSize={0.045} color="#6b7280">
          {article.readingTime} min read
        </Text>
      </group>

      {/* Mechanics tags */}
      {article.mechanics && article.mechanics.length > 0 && (
        <Text
          position={[0, -0.4, 0.02]}
          fontSize={0.035}
          color="#6ee7b7"
          maxWidth={1.8}
          textAlign="center"
        >
          {article.mechanics.slice(0, 3).join(' • ')}
        </Text>
      )}

      {/* Action buttons using Html for interactivity */}
      <Html position={[0, -0.55, 0.03]} center transform>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onNavigate}
            style={{
              padding: '10px 24px',
              background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`,
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'system-ui',
            }}
          >
            Read Article
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: '#9ca3af',
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: 'system-ui',
            }}
          >
            Close
          </button>
        </div>
      </Html>
    </group>
  );
}

// Main immersive viewer component
interface ImmersiveArticleViewerProps {
  articles: EnhancedArticleData[];
  environment?: EnvironmentConfig;
  maxArticles?: number;
  onArticleNavigate?: (article: EnhancedArticleData) => void;
}

export default function ImmersiveArticleViewer({
  articles,
  environment = DEFAULT_ENVIRONMENT,
  maxArticles = 12,
  onArticleNavigate,
}: ImmersiveArticleViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Filter/curate articles based on environment config
  const displayArticles = useMemo(() => {
    let filtered = [...articles];

    if (environment.curatedArticles && environment.curatedArticles.length > 0) {
      // Use curated list
      filtered = environment.curatedArticles
        .map(slug => articles.find(a => a.slug === slug))
        .filter((a): a is EnhancedArticleData => a !== undefined);
    } else if (environment.filter) {
      // Apply filters
      const { horizons, polarities, mechanics } = environment.filter;
      if (horizons?.length) {
        filtered = filtered.filter(a => horizons.includes(a.horizon || ''));
      }
      if (polarities?.length) {
        filtered = filtered.filter(a => polarities.includes(a.polarity || ''));
      }
      if (mechanics?.length) {
        filtered = filtered.filter(a =>
          a.mechanics?.some(m => mechanics.includes(m))
        );
      }
    }

    return filtered.slice(0, maxArticles);
  }, [articles, environment, maxArticles]);

  // Calculate positions based on arrangement type
  const positions = useMemo(() => {
    const { center, radius, height, arrangement } = environment.spawn;
    const count = displayArticles.length;
    const result: [number, number, number][] = [];

    switch (arrangement) {
      case 'orbital':
        // Circle around viewer at eye level
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
          result.push([
            center[0] + Math.cos(angle) * radius,
            center[1] + (Math.sin(i * 0.5) * height * 0.3),
            center[2] + Math.sin(angle) * radius,
          ]);
        }
        break;

      case 'constellation':
        // Scattered like stars with depth variation
        for (let i = 0; i < count; i++) {
          const theta = (i / count) * Math.PI * 2;
          const phi = Math.acos(1 - 2 * ((i + 0.5) / count));
          const r = radius * (0.8 + Math.random() * 0.4);
          result.push([
            center[0] + r * Math.sin(phi) * Math.cos(theta),
            center[1] + (r * Math.cos(phi) * 0.5) + height,
            center[2] + r * Math.sin(phi) * Math.sin(theta),
          ]);
        }
        break;

      case 'amphitheater':
        // Semi-circle tiers facing viewer
        const tiers = 3;
        const perTier = Math.ceil(count / tiers);
        for (let i = 0; i < count; i++) {
          const tier = Math.floor(i / perTier);
          const posInTier = i % perTier;
          const tierCount = Math.min(perTier, count - tier * perTier);
          const angle = ((posInTier / (tierCount - 1 || 1)) - 0.5) * Math.PI * 0.8;
          const tierRadius = radius + tier * 1.2;
          result.push([
            center[0] + Math.sin(angle) * tierRadius,
            center[1] + tier * 0.6,
            center[2] - Math.cos(angle) * tierRadius + radius,
          ]);
        }
        break;

      case 'spiral':
        // Ascending spiral
        for (let i = 0; i < count; i++) {
          const t = i / count;
          const angle = t * Math.PI * 4;
          const r = radius * (0.5 + t * 0.5);
          result.push([
            center[0] + Math.cos(angle) * r,
            center[1] + t * height * 3,
            center[2] + Math.sin(angle) * r,
          ]);
        }
        break;
    }

    return result;
  }, [displayArticles.length, environment.spawn]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null);
        setFocusedIndex(null);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex(prev =>
          prev === null ? 0 : (prev + 1) % displayArticles.length
        );
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(prev =>
          prev === null ? displayArticles.length - 1 : (prev - 1 + displayArticles.length) % displayArticles.length
        );
      } else if (e.key === 'Enter' && focusedIndex !== null) {
        if (selectedIndex === focusedIndex) {
          // Navigate to article
          onArticleNavigate?.(displayArticles[focusedIndex]);
        } else {
          setSelectedIndex(focusedIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, selectedIndex, displayArticles, onArticleNavigate]);

  const handleNavigate = useCallback(() => {
    if (selectedIndex !== null) {
      onArticleNavigate?.(displayArticles[selectedIndex]);
    }
  }, [selectedIndex, displayArticles, onArticleNavigate]);

  // Slow ambient rotation when not interacting
  useFrame((state) => {
    if (groupRef.current && selectedIndex === null && focusedIndex === null) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  const selectedArticle = selectedIndex !== null ? displayArticles[selectedIndex] : null;

  return (
    <group ref={groupRef}>
      {/* Article cards */}
      {displayArticles.map((article, index) => (
        <ArticleCard3D
          key={article.slug}
          article={article}
          position={positions[index]}
          index={index}
          isSelected={selectedIndex === index}
          isFocused={focusedIndex === index}
          onSelect={() => setSelectedIndex(index)}
          onFocus={() => setFocusedIndex(index)}
          onBlur={() => {
            if (focusedIndex === index) setFocusedIndex(null);
          }}
          theme={environment.theme}
        />
      ))}

      {/* Detail panel for selected article */}
      {selectedArticle && (
        <DetailPanel
          article={selectedArticle}
          position={[0, 1.8, -2]}
          onClose={() => setSelectedIndex(null)}
          onNavigate={handleNavigate}
          theme={environment.theme}
        />
      )}

      {/* Environment info text */}
      <Billboard position={[0, 3.5, 0]}>
        <Text
          fontSize={0.15}
          color={environment.theme.primaryColor}
          anchorX="center"
          anchorY="middle"
        >
          {environment.name}
        </Text>
        <Text
          position={[0, -0.2, 0]}
          fontSize={0.06}
          color="#6b7280"
          anchorX="center"
        >
          {displayArticles.length} articles • Arrow keys to navigate • Enter to select
        </Text>
      </Billboard>
    </group>
  );
}

// Environment presets for future splat files
export const ENVIRONMENT_PRESETS: Record<string, Partial<EnvironmentConfig>> = {
  'nexus-hub': {
    name: 'The Nexus Hub',
    description: 'Central navigation space for all futures',
    spawn: { center: [0, 1.6, 0], radius: 4, height: 0.5, arrangement: 'orbital' },
    theme: { primaryColor: '#6366f1', accentColor: '#de7ea2', cardOpacity: 0.92 },
  },
  'calamity-engine': {
    name: 'The Calamity Engine',
    description: 'Exploring catastrophic outcomes',
    filter: { polarities: ['C3', 'C2', 'C1'] },
    spawn: { center: [0, 1.6, 0], radius: 5, height: 1, arrangement: 'constellation' },
    theme: { primaryColor: '#ef4444', accentColor: '#f97316', cardOpacity: 0.88 },
  },
  'emergence-garden': {
    name: 'The Emergence Garden',
    description: 'Positive transformations and breakthroughs',
    filter: { polarities: ['P1', 'P2', 'P3'] },
    spawn: { center: [0, 1.4, 0], radius: 4, height: 0.8, arrangement: 'amphitheater' },
    theme: { primaryColor: '#22c55e', accentColor: '#14b8a6', cardOpacity: 0.9 },
  },
  'deep-archive': {
    name: 'The Deep Archive',
    description: 'Long-term futures and speculations',
    filter: { horizons: ['N50', 'N100'] },
    spawn: { center: [0, 2, 0], radius: 6, height: 2, arrangement: 'spiral' },
    theme: { primaryColor: '#8b5cf6', accentColor: '#d946ef', cardOpacity: 0.85 },
  },
};
