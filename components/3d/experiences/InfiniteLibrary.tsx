/**
 * InfiniteLibrary - The complete 3D article exploration experience
 *
 * A dreamy, cosmic space where articles float as luminous orbs,
 * connected by gossamer threads that reveal the relationships
 * between ideas. This is the realization of our artistic vision.
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import Atmosphere from '../atmosphere/Atmosphere';
import ArticleOrb from '../interactive/ArticleOrb';
import ConnectionLines, { FlowingConnection } from '../interactive/ConnectionLines';
import {
  COSMIC_LIBRARY,
  DIGITAL_GARDEN,
  NOIR_ARCHIVE,
  DAWN_HORIZON,
  EXPERIENCE_THEMES,
  type ExperienceTheme,
  type LayoutPattern,
} from '@/lib/3d/vision';
import type { QualityLevel } from '@/lib/worlds/types';

// Article interface
interface Article {
  id: string;
  title: string;
  polarity?: number;
  horizon?: string;
  publishedAt?: Date;
  category?: string;
  relatedTo?: string[];
}

interface InfiniteLibraryProps {
  articles: Article[];
  theme?: ExperienceTheme | string;
  quality?: QualityLevel;
  layout?: LayoutPattern;
  radius?: number;
  onArticleSelect?: (article: Article) => void;
  onArticleHover?: (article: Article | null) => void;
  selectedArticleId?: string;
  /** Set to true if parent component provides OrbitControls */
  externalControls?: boolean;
}

/**
 * Calculate positions for articles based on layout pattern
 */
function calculatePositions(
  articles: Article[],
  layout: LayoutPattern,
  radius: number
): Map<string, [number, number, number]> {
  const positions = new Map<string, [number, number, number]>();

  switch (layout) {
    case 'constellation': {
      // Organic clustering with some randomness
      articles.forEach((article, i) => {
        const phi = Math.acos(-1 + (2 * i) / articles.length);
        const theta = Math.sqrt(articles.length * Math.PI) * phi;

        // Add some randomness for organic feel
        const jitter = 0.3;
        const x =
          radius *
            Math.cos(theta) *
            Math.sin(phi) *
            (0.8 + Math.random() * 0.4) +
          (Math.random() - 0.5) * jitter * radius;
        const y =
          radius * Math.sin(theta) * Math.sin(phi) * 0.5 +
          (Math.random() - 0.5) * jitter * radius;
        const z =
          radius * Math.cos(phi) * (0.8 + Math.random() * 0.4) +
          (Math.random() - 0.5) * jitter * radius;

        positions.set(article.id, [x, y, z]);
      });
      break;
    }

    case 'galaxy': {
      // Spiral galaxy pattern
      const arms = 3;
      articles.forEach((article, i) => {
        const armIndex = i % arms;
        const posInArm = Math.floor(i / arms);
        const armAngle = (armIndex / arms) * Math.PI * 2;

        const distance = (posInArm / (articles.length / arms)) * radius;
        const spiralAngle = armAngle + distance * 0.3;

        const x = distance * Math.cos(spiralAngle);
        const z = distance * Math.sin(spiralAngle);
        const y = (Math.random() - 0.5) * 3;

        positions.set(article.id, [x, y, z]);
      });
      break;
    }

    case 'timeline': {
      // Linear timeline arrangement
      articles.forEach((article, i) => {
        const x = ((i / articles.length) * 2 - 1) * radius;
        const y = (article.polarity ?? 0) * 5;
        const z = (Math.random() - 0.5) * 5;

        positions.set(article.id, [x, y, z]);
      });
      break;
    }

    case 'clusters': {
      // Category-based clustering
      const categories = new Map<string, Article[]>();
      articles.forEach((article) => {
        const cat = article.category ?? 'uncategorized';
        if (!categories.has(cat)) categories.set(cat, []);
        categories.get(cat)!.push(article);
      });

      let clusterIndex = 0;
      const numClusters = categories.size;

      categories.forEach((clusterArticles, category) => {
        const clusterAngle = (clusterIndex / numClusters) * Math.PI * 2;
        const clusterDistance = radius * 0.6;

        const clusterCenter: [number, number, number] = [
          clusterDistance * Math.cos(clusterAngle),
          0,
          clusterDistance * Math.sin(clusterAngle),
        ];

        clusterArticles.forEach((article, i) => {
          const localAngle = (i / clusterArticles.length) * Math.PI * 2;
          const localRadius = Math.sqrt(i) * 2;

          positions.set(article.id, [
            clusterCenter[0] + localRadius * Math.cos(localAngle),
            clusterCenter[1] + (Math.random() - 0.5) * 3,
            clusterCenter[2] + localRadius * Math.sin(localAngle),
          ]);
        });

        clusterIndex++;
      });
      break;
    }

    case 'sphere': {
      // Fibonacci sphere distribution
      const goldenRatio = (1 + Math.sqrt(5)) / 2;

      articles.forEach((article, i) => {
        const theta = (2 * Math.PI * i) / goldenRatio;
        const phi = Math.acos(1 - (2 * (i + 0.5)) / articles.length);

        const x = radius * Math.cos(theta) * Math.sin(phi);
        const y = radius * Math.sin(theta) * Math.sin(phi);
        const z = radius * Math.cos(phi);

        positions.set(article.id, [x, y, z]);
      });
      break;
    }

    case 'helix': {
      // Double helix - contrasting viewpoints on opposite strands
      articles.forEach((article, i) => {
        const polarity = article.polarity ?? 0;
        const strand = polarity >= 0 ? 0 : 1;

        const height = ((i / articles.length) * 2 - 1) * radius;
        const angle = (i / articles.length) * Math.PI * 8 + strand * Math.PI;
        const helixRadius = radius * 0.3;

        const x = helixRadius * Math.cos(angle);
        const z = helixRadius * Math.sin(angle);

        positions.set(article.id, [x, height, z]);
      });
      break;
    }
  }

  return positions;
}

/**
 * Calculate connections between related articles
 */
function calculateConnections(
  articles: Article[],
  positions: Map<string, [number, number, number]>
): Array<{ from: [number, number, number]; to: [number, number, number]; strength: number }> {
  const connections: Array<{
    from: [number, number, number];
    to: [number, number, number];
    strength: number;
  }> = [];

  articles.forEach((article) => {
    if (!article.relatedTo) return;

    const fromPos = positions.get(article.id);
    if (!fromPos) return;

    article.relatedTo.forEach((relatedId) => {
      const toPos = positions.get(relatedId);
      if (!toPos) return;

      // Avoid duplicate connections
      const existingConnection = connections.find(
        (c) =>
          (c.from === fromPos && c.to === toPos) ||
          (c.from === toPos && c.to === fromPos)
      );
      if (existingConnection) return;

      connections.push({
        from: fromPos,
        to: toPos,
        strength: 0.5,
      });
    });
  });

  return connections;
}

export default function InfiniteLibrary({
  articles,
  theme: themeProp,
  quality = 'high',
  layout = 'constellation',
  radius = 20,
  onArticleSelect,
  onArticleHover,
  selectedArticleId,
  externalControls = false,
}: InfiniteLibraryProps) {
  const { camera } = useThree();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Resolve theme
  const theme = useMemo(() => {
    if (!themeProp) return COSMIC_LIBRARY;
    if (typeof themeProp === 'string') {
      return EXPERIENCE_THEMES[themeProp] ?? COSMIC_LIBRARY;
    }
    return themeProp;
  }, [themeProp]);

  // Calculate article positions
  const positions = useMemo(
    () => calculatePositions(articles, layout, radius),
    [articles, layout, radius]
  );

  // Calculate connections
  const connections = useMemo(
    () => calculateConnections(articles, positions),
    [articles, positions]
  );

  // Handlers
  const handleArticleClick = useCallback(
    (id: string) => {
      const article = articles.find((a) => a.id === id);
      if (article) onArticleSelect?.(article);
    },
    [articles, onArticleSelect]
  );

  const handleArticleHover = useCallback(
    (id: string | null) => {
      setHoveredId(id);
      const article = id ? articles.find((a) => a.id === id) : null;
      onArticleHover?.(article ?? null);
    },
    [articles, onArticleHover]
  );

  // Gentle camera floating
  const cameraOffset = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const floatAmount = theme.animation.cameraFloatAmount;
    const floatSpeed = theme.animation.cameraFloatSpeed;

    // Subtle camera sway
    cameraOffset.current.x = Math.sin(time * floatSpeed) * floatAmount;
    cameraOffset.current.y = Math.cos(time * floatSpeed * 0.7) * floatAmount * 0.5;
  });

  return (
    <>
      {/* Atmosphere and effects */}
      <Atmosphere theme={theme} quality={quality} />

      {/* Camera controls - only render if parent doesn't provide controls */}
      {!externalControls && (
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={radius * 2}
          maxPolarAngle={Math.PI * 0.85}
          minPolarAngle={Math.PI * 0.15}
        />
      )}

      {/* Connection lines */}
      {connections.length > 0 && (
        <ConnectionLines
          connections={connections}
          theme={theme}
          animated
          pulseSpeed={0.5}
        />
      )}

      {/* Flowing connection to selected article */}
      {selectedArticleId && hoveredId && selectedArticleId !== hoveredId && (
        <FlowingConnection
          from={positions.get(selectedArticleId)!}
          to={positions.get(hoveredId)!}
          color={theme.colors.accent}
          speed={2}
        />
      )}

      {/* Article orbs */}
      {articles.map((article) => {
        const position = positions.get(article.id);
        if (!position) return null;

        return (
          <ArticleOrb
            key={article.id}
            id={article.id}
            title={article.title}
            position={position}
            polarity={article.polarity}
            horizon={article.horizon}
            publishedAt={article.publishedAt}
            category={article.category}
            theme={theme}
            selected={article.id === selectedArticleId}
            quality={quality}
            onClick={handleArticleClick}
            onHover={handleArticleHover}
          />
        );
      })}
    </>
  );
}

// Export themes for convenience
export { COSMIC_LIBRARY, DIGITAL_GARDEN, NOIR_ARCHIVE, DAWN_HORIZON };
