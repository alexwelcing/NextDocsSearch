import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';

interface ArticleNodeProps {
  article: EnhancedArticleData;
  position: [number, number, number];
  onSelect: (article: EnhancedArticleData) => void;
  isSelected: boolean;
  index: number;
}

const polarityColors: Record<string, string> = {
  C3: '#ff2222',
  C2: '#ff6644',
  C1: '#ff9966',
  N0: '#aaaaaa',
  P1: '#88cc88',
  P2: '#44dd88',
  P3: '#22ffaa',
};

const horizonSizes: Record<string, number> = {
  NQ: 0.3,
  NY: 0.35,
  N5: 0.4,
  N20: 0.5,
  N50: 0.6,
  N100: 0.7,
};

function ArticleNode({ article, position, onSelect, isSelected, index }: ArticleNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const glowRef = useRef<THREE.Mesh>(null);

  const color = polarityColors[article.polarity || 'N0'];
  const size = horizonSizes[article.horizon || 'N5'];

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + index * 0.5) * 0.1;

      // Slow rotation
      meshRef.current.rotation.y += 0.002;

      // Pulse when hovered or selected
      if (hovered || isSelected) {
        const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
        meshRef.current.scale.setScalar(scale);
      } else {
        meshRef.current.scale.setScalar(1);
      }
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar(1.3 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.1);
    }
  });

  return (
    <group position={position}>
      {/* Glow effect */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[size * 1.2, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered || isSelected ? 0.3 : 0.1}
        />
      </mesh>

      {/* Main orb */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); onSelect(article); }}
      >
        <icosahedronGeometry args={[size, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || isSelected ? 0.8 : 0.3}
          metalness={0.3}
          roughness={0.4}
          wireframe={!isSelected}
        />
      </mesh>

      {/* Title label */}
      {(hovered || isSelected) && (
        <Billboard position={[0, size + 0.5, 0]}>
          <Text
            fontSize={0.15}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
            maxWidth={3}
            textAlign="center"
          >
            {article.title.length > 40 ? article.title.substring(0, 40) + '...' : article.title}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

interface ArticleExplorer3DProps {
  articles: EnhancedArticleData[];
  onSelectArticle: (article: EnhancedArticleData | null) => void;
  selectedArticle: EnhancedArticleData | null;
  layout?: 'sphere' | 'timeline' | 'cluster';
}

export default function ArticleExplorer3D({
  articles,
  onSelectArticle,
  selectedArticle,
  layout = 'sphere',
}: ArticleExplorer3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Calculate positions based on layout
  const positions = useMemo(() => {
    const count = Math.min(articles.length, 50); // Limit for performance
    const result: [number, number, number][] = [];

    if (layout === 'sphere') {
      // Fibonacci sphere distribution
      const phi = Math.PI * (3 - Math.sqrt(5));
      const radius = 8;

      for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = phi * i;

        result.push([
          Math.cos(theta) * radiusAtY * radius,
          y * radius * 0.5 + 2,
          Math.sin(theta) * radiusAtY * radius,
        ]);
      }
    } else if (layout === 'timeline') {
      // Arrange by date along X axis
      const sortedArticles = [...articles].slice(0, count).sort((a, b) =>
        new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
      );

      for (let i = 0; i < count; i++) {
        const x = (i / (count - 1)) * 20 - 10;
        const article = sortedArticles[i];
        const polarity = article?.polarity || 'N0';
        const polarityY = ['C3', 'C2', 'C1', 'N0', 'P1', 'P2', 'P3'].indexOf(polarity);
        const y = (polarityY / 6) * 4;

        result.push([
          x,
          y + 1,
          (Math.random() - 0.5) * 4,
        ]);
      }
    } else {
      // Cluster by mechanic
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = 5 + Math.random() * 3;

        result.push([
          Math.cos(angle) * radius,
          2 + Math.random() * 3,
          Math.sin(angle) * radius,
        ]);
      }
    }

    return result;
  }, [articles, layout]);

  useFrame((state) => {
    if (groupRef.current && layout === 'sphere') {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  const displayArticles = articles.slice(0, 50);

  return (
    <group ref={groupRef}>
      {displayArticles.map((article, index) => (
        <ArticleNode
          key={article.slug}
          article={article}
          position={positions[index] || [0, 2, 0]}
          onSelect={onSelectArticle}
          isSelected={selectedArticle?.slug === article.slug}
          index={index}
        />
      ))}
    </group>
  );
}

// Selected article detail panel (HTML overlay)
interface ArticleDetailPanelProps {
  article: EnhancedArticleData;
  onClose: () => void;
  onNavigate: () => void;
}

export function ArticleDetailPanel({ article, onClose, onNavigate }: ArticleDetailPanelProps) {
  return (
    <div
      style={{
        position: 'fixed',
        right: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '320px',
        maxWidth: 'calc(100vw - 40px)',
        background: 'rgba(10, 10, 20, 0.95)',
        border: '1px solid rgba(222, 126, 162, 0.3)',
        borderRadius: '12px',
        padding: '20px',
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'none',
          border: 'none',
          color: '#666',
          fontSize: '20px',
          cursor: 'pointer',
        }}
      >
        ×
      </button>

      <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '12px', paddingRight: '24px' }}>
        {article.title}
      </h3>

      <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '16px' }}>
        {article.description}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
        {article.horizon && (
          <span style={{
            padding: '4px 8px',
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#a5b4fc',
            borderRadius: '4px',
            fontSize: '0.7rem',
          }}>
            {article.horizon}
          </span>
        )}
        {article.polarity && (
          <span style={{
            padding: '4px 8px',
            background: 'rgba(222, 126, 162, 0.2)',
            color: '#de7ea2',
            borderRadius: '4px',
            fontSize: '0.7rem',
          }}>
            {article.polarity}
          </span>
        )}
        {article.mechanics?.slice(0, 2).map(m => (
          <span key={m} style={{
            padding: '4px 8px',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#6ee7b7',
            borderRadius: '4px',
            fontSize: '0.7rem',
          }}>
            {m.replace(/-/g, ' ')}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
          {article.readingTime} min read
        </span>
        <button
          onClick={onNavigate}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #de7ea2 0%, #6366f1 100%)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Read Article →
        </button>
      </div>
    </div>
  );
}
