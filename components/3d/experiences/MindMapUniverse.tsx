/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MIND MAP UNIVERSE - 3D VISUALIZATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A 3D visualization of the Modern Workshop mind map structure.
 * Categories expand outward from the center like a cosmic tree of knowledge,
 * with resources floating around their parent categories like satellites.
 *
 * DESIGN PRINCIPLES:
 * - Root at center, branches radiate outward
 * - Categories are prominent glowing nodes
 * - Resources orbit their category as smaller particles
 * - Connections flow with animated energy
 * - Expansion/collapse reveals deeper knowledge
 */

import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Billboard, Line } from '@react-three/drei';
import * as THREE from 'three';

import type { MindMapCategory, WorkshopResource } from '@/types/workshop';
import type { ExperienceTheme } from '@/lib/3d/vision';
import type { QualityLevel } from '@/lib/worlds/types';
import { COSMIC_LIBRARY, EXPERIENCE_THEMES } from '@/lib/3d/vision';
import { BRANCH_COLORS } from '@/lib/workshop/mindmap-data';
import Atmosphere from '../atmosphere/Atmosphere';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface MindMapUniverseProps {
  categories: Record<string, MindMapCategory>;
  resources: WorkshopResource[];
  expandedCategories: Set<string>;
  selectedCategoryId: string | null;
  selectedResourceId: string | null;
  hoveredCategoryId: string | null;
  resourceCounts: Record<string, number>;
  theme?: ExperienceTheme | string;
  quality?: QualityLevel;
  onCategorySelect?: (categoryId: string) => void;
  onCategoryExpand?: (categoryId: string) => void;
  onCategoryHover?: (categoryId: string | null) => void;
  onResourceSelect?: (resourceId: string) => void;
  onResourceHover?: (resourceId: string | null) => void;
}

interface NodePosition {
  id: string;
  position: THREE.Vector3;
  parentPosition?: THREE.Vector3;
  depth: number;
  visible: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT CALCULATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate 3D positions for all nodes in the mind map
 */
function calculateNodePositions(
  categories: Record<string, MindMapCategory>,
  expandedCategories: Set<string>,
  rootId: string
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();

  // Configuration
  const LEVEL_DISTANCE = 12;     // Distance between hierarchy levels
  const SPREAD_ANGLE = Math.PI * 2;  // Full circle spread

  function positionNode(
    categoryId: string,
    depth: number,
    angleStart: number,
    angleEnd: number,
    parentPos: THREE.Vector3
  ) {
    const category = categories[categoryId];
    if (!category) return;

    // Calculate position
    const angle = (angleStart + angleEnd) / 2;
    const distance = depth * LEVEL_DISTANCE;

    // 3D spiral positioning
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const y = depth * 2 - 4; // Slight vertical offset per level

    const position = new THREE.Vector3(x, y, z);
    const isVisible = depth === 0 || expandedCategories.has(category.parentId || '');

    positions.set(categoryId, {
      id: categoryId,
      position,
      parentPosition: parentPos,
      depth,
      visible: isVisible,
    });

    // Position children if expanded
    if (expandedCategories.has(categoryId) && category.children.length > 0) {
      const childAngleSpan = (angleEnd - angleStart) / category.children.length;

      category.children.forEach((childId, index) => {
        const childAngleStart = angleStart + childAngleSpan * index;
        const childAngleEnd = childAngleStart + childAngleSpan;

        positionNode(childId, depth + 1, childAngleStart, childAngleEnd, position);
      });
    }
  }

  // Start from root
  const root = categories[rootId];
  if (root) {
    positions.set(rootId, {
      id: rootId,
      position: new THREE.Vector3(0, 0, 0),
      depth: 0,
      visible: true,
    });

    if (expandedCategories.has(rootId) && root.children.length > 0) {
      const childAngleSpan = SPREAD_ANGLE / root.children.length;

      root.children.forEach((childId, index) => {
        const angleStart = childAngleSpan * index;
        const angleEnd = angleStart + childAngleSpan;

        positionNode(childId, 1, angleStart, angleEnd, new THREE.Vector3(0, 0, 0));
      });
    }
  }

  return positions;
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORY NODE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface CategoryNodeProps {
  category: MindMapCategory;
  position: THREE.Vector3;
  isSelected: boolean;
  isHovered: boolean;
  isExpanded: boolean;
  resourceCount: number;
  theme: ExperienceTheme;
  onClick: () => void;
  onDoubleClick: () => void;
  onHover: (hovered: boolean) => void;
}

function CategoryNode({
  category,
  position,
  isSelected,
  isHovered,
  isExpanded,
  resourceCount,
  theme,
  onClick,
  onDoubleClick,
  onHover,
}: CategoryNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Size based on depth and resource count
  const baseSize = 1.5 - category.depth * 0.2;
  const size = baseSize + Math.min(resourceCount * 0.02, 0.5);

  // Animation
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const time = clock.elapsedTime;

      // Gentle rotation
      meshRef.current.rotation.y = time * 0.2;

      // Pulse when selected
      if (isSelected) {
        const pulse = Math.sin(time * 3) * 0.1 + 1;
        meshRef.current.scale.setScalar(size * pulse);
      } else {
        meshRef.current.scale.setScalar(size);
      }
    }

    if (glowRef.current) {
      const time = clock.elapsedTime;
      const breathe = Math.sin(time * 0.5) * 0.2 + 0.8;
      glowRef.current.scale.setScalar(size * 2 * breathe);
    }
  });

  // Color based on branch
  const color = new THREE.Color(category.color);
  const emissiveIntensity = isSelected ? 1 : isHovered ? 0.6 : 0.3;

  return (
    <group position={position}>
      {/* Glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={category.color}
          transparent
          opacity={isSelected ? 0.3 : isHovered ? 0.2 : 0.1}
          depthWrite={false}
        />
      </mesh>

      {/* Main node */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick();
        }}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      {/* Expansion indicator */}
      {category.children.length > 0 && (
        <mesh position={[0, size * 1.2, 0]} scale={0.3}>
          <ringGeometry args={[0.5, 0.7, 6]} />
          <meshBasicMaterial
            color={isExpanded ? theme.colors.accent : '#ffffff'}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Label */}
      <Billboard position={[0, -size - 0.8, 0]}>
        <Text
          fontSize={0.5}
          color={isSelected ? theme.colors.accent : theme.colors.text}
          anchorX="center"
          anchorY="top"
          maxWidth={8}
        >
          {category.name}
        </Text>
        {resourceCount > 0 && (
          <Text
            fontSize={0.3}
            color={theme.colors.ambient}
            anchorX="center"
            anchorY="top"
            position={[0, -0.6, 0]}
          >
            {resourceCount} resources
          </Text>
        )}
      </Billboard>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOURCE PARTICLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ResourceParticleProps {
  resource: WorkshopResource;
  categoryPosition: THREE.Vector3;
  index: number;
  total: number;
  isSelected: boolean;
  isHovered: boolean;
  theme: ExperienceTheme;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
}

function ResourceParticle({
  resource,
  categoryPosition,
  index,
  total,
  isSelected,
  isHovered,
  theme,
  onClick,
  onHover,
}: ResourceParticleProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Orbit parameters
  const orbitRadius = 3;
  const angleOffset = (index / total) * Math.PI * 2;
  const heightOffset = (index % 3 - 1) * 0.5;

  // Color by type
  const typeColors: Record<string, string> = {
    link: '#60a5fa',      // Blue
    video: '#f87171',     // Red
    pdf: '#34d399',       // Green
    report: '#a78bfa',    // Purple
    presentation: '#fbbf24', // Yellow
  };
  const color = typeColors[resource.type] || '#94a3b8';

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const time = clock.elapsedTime;

      // Orbit around category
      const angle = time * 0.3 + angleOffset;
      const x = categoryPosition.x + Math.cos(angle) * orbitRadius;
      const z = categoryPosition.z + Math.sin(angle) * orbitRadius;
      const y = categoryPosition.y + heightOffset + Math.sin(time * 0.5 + index) * 0.3;

      meshRef.current.position.set(x, y, z);

      // Pulse when selected
      const scale = isSelected ? 0.4 + Math.sin(time * 4) * 0.1 : 0.3;
      meshRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh
      ref={meshRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isSelected ? 1 : isHovered ? 0.6 : 0.2}
        metalness={0.5}
        roughness={0.3}
      />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTION LINE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ConnectionProps {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: string;
  theme: ExperienceTheme;
}

function Connection({ from, to, color }: ConnectionProps) {
  const points = useMemo(() => {
    // Create curved connection
    const mid = new THREE.Vector3().lerpVectors(from, to, 0.5);
    mid.y += 1; // Arc upward

    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    return curve.getPoints(20);
  }, [from, to]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1}
      transparent
      opacity={0.4}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function MindMapUniverse({
  categories,
  resources,
  expandedCategories,
  selectedCategoryId,
  selectedResourceId,
  hoveredCategoryId,
  resourceCounts,
  theme: themeProp,
  quality = 'high',
  onCategorySelect,
  onCategoryExpand,
  onCategoryHover,
  onResourceSelect,
  onResourceHover,
}: MindMapUniverseProps) {
  const { camera } = useThree();

  // Resolve theme
  const theme = useMemo(() => {
    if (!themeProp) return COSMIC_LIBRARY;
    if (typeof themeProp === 'string') {
      return EXPERIENCE_THEMES[themeProp] ?? COSMIC_LIBRARY;
    }
    return themeProp;
  }, [themeProp]);

  // Find root category
  const rootId = useMemo(() => {
    return Object.values(categories).find(c => c.parentId === null)?.id || '';
  }, [categories]);

  // Calculate positions
  const nodePositions = useMemo(() => {
    return calculateNodePositions(categories, expandedCategories, rootId);
  }, [categories, expandedCategories, rootId]);

  // Group resources by category
  const resourcesByCategory = useMemo(() => {
    const grouped = new Map<string, WorkshopResource[]>();

    for (const resource of resources) {
      const categoryId = resource.subcategoryId || resource.categoryId;
      const existing = grouped.get(categoryId) || [];
      grouped.set(categoryId, [...existing, resource]);
    }

    return grouped;
  }, [resources]);

  // Handlers
  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      onCategorySelect?.(categoryId);
    },
    [onCategorySelect]
  );

  const handleCategoryDoubleClick = useCallback(
    (categoryId: string) => {
      onCategoryExpand?.(categoryId);
    },
    [onCategoryExpand]
  );

  // Render visible categories and their connections
  const visibleCategories = useMemo(() => {
    return Array.from(nodePositions.entries())
      .filter(([_, node]) => node.visible)
      .map(([id, node]) => ({
        category: categories[id],
        node,
      }))
      .filter(item => item.category);
  }, [nodePositions, categories]);

  return (
    <>
      {/* Atmosphere */}
      <Atmosphere theme={theme} quality={quality} />

      {/* Camera controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={100}
        maxPolarAngle={Math.PI * 0.85}
        minPolarAngle={Math.PI * 0.15}
      />

      {/* Connections */}
      {visibleCategories.map(({ category, node }) => {
        if (!node.parentPosition) return null;

        return (
          <Connection
            key={`conn-${category.id}`}
            from={node.parentPosition}
            to={node.position}
            color={category.color}
            theme={theme}
          />
        );
      })}

      {/* Category nodes */}
      {visibleCategories.map(({ category, node }) => (
        <CategoryNode
          key={category.id}
          category={category}
          position={node.position}
          isSelected={selectedCategoryId === category.id}
          isHovered={hoveredCategoryId === category.id}
          isExpanded={expandedCategories.has(category.id)}
          resourceCount={resourceCounts[category.id] || 0}
          theme={theme}
          onClick={() => handleCategoryClick(category.id)}
          onDoubleClick={() => handleCategoryDoubleClick(category.id)}
          onHover={(hovered) => onCategoryHover?.(hovered ? category.id : null)}
        />
      ))}

      {/* Resource particles - only show for selected/expanded categories */}
      {visibleCategories.map(({ category, node }) => {
        const categoryResources = resourcesByCategory.get(category.id) || [];
        if (categoryResources.length === 0) return null;
        if (!expandedCategories.has(category.id) && selectedCategoryId !== category.id) return null;

        return categoryResources.slice(0, 10).map((resource, index) => (
          <ResourceParticle
            key={resource.id}
            resource={resource}
            categoryPosition={node.position}
            index={index}
            total={Math.min(categoryResources.length, 10)}
            isSelected={selectedResourceId === resource.id}
            isHovered={false}
            theme={theme}
            onClick={() => onResourceSelect?.(resource.id)}
            onHover={(hovered) => onResourceHover?.(hovered ? resource.id : null)}
          />
        ));
      })}

      {/* Ambient lighting */}
      <ambientLight intensity={0.4} color={theme.lighting.ambientColor} />
      <directionalLight
        position={theme.lighting.keyLightPosition}
        intensity={theme.lighting.keyLightIntensity}
        color={theme.lighting.keyLightColor}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WRAPPER WITH CANVAS
// ═══════════════════════════════════════════════════════════════════════════

export { MindMapUniverse };
