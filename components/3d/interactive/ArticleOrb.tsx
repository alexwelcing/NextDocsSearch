/**
 * ArticleOrb - Glowing orb representing an article with image preview
 *
 * Each article appears as a luminous orb with visual properties that
 * communicate its nature: size (importance), color (sentiment),
 * glow (recency), and subtle animations. Now with article image display!
 */

import React, { useRef, useState, useMemo, Suspense } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Billboard, Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { calculateOrbVisuals, type ExperienceTheme } from '@/lib/3d/vision';

interface ArticleOrbProps {
  id: string;
  title: string;
  position: [number, number, number];
  polarity?: number;
  horizon?: string;
  publishedAt?: Date;
  category?: string;
  theme?: ExperienceTheme;
  selected?: boolean;
  onClick?: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** Article image URL for display on orb */
  imageUrl?: string;
}

// Inner component that loads and displays the image
function ArticleImage({
  imageUrl,
  scale,
  visible
}: {
  imageUrl: string;
  scale: number;
  visible: boolean;
}) {
  const texture = useTexture(imageUrl);

  // Configure texture
  useMemo(() => {
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
  }, [texture]);

  if (!visible) return null;

  return (
    <Billboard position={[0, 0, 0]}>
      <mesh>
        <planeGeometry args={[scale * 1.8, scale * 1.2]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Border frame */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[scale * 1.9, scale * 1.3]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.8}
        />
      </mesh>
    </Billboard>
  );
}

export default function ArticleOrb({
  id,
  title,
  position,
  polarity = 0,
  horizon = 'N24',
  publishedAt,
  category,
  theme,
  selected = false,
  onClick,
  onHover,
  imageUrl,
}: ArticleOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const imageGroupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Calculate visual properties from article data
  const visuals = useMemo(
    () => calculateOrbVisuals({ polarity, horizon, publishedAt, category }),
    [polarity, horizon, publishedAt, category]
  );

  // Animation state
  const animationRef = useRef({
    time: Math.random() * Math.PI * 2,
    hoverScale: 1,
    pulsePhase: Math.random() * Math.PI * 2,
    imageOpacity: 0,
  });

  // Animate the orb
  useFrame((state, delta) => {
    if (!meshRef.current || !glowRef.current) return;

    const anim = animationRef.current;
    anim.time += delta;

    // Smooth hover scale transition
    const targetScale = hovered || selected ? 1.3 : 1;
    anim.hoverScale += (targetScale - anim.hoverScale) * delta * 8;

    // Pulsing effect based on recency
    const pulse = Math.sin(anim.time * visuals.pulseSpeed + anim.pulsePhase);
    const pulseScale = 1 + pulse * 0.05 * visuals.glowIntensity;

    // Apply scale
    const finalScale = visuals.baseSize * anim.hoverScale * pulseScale;
    meshRef.current.scale.setScalar(finalScale);

    // Glow scales slightly larger
    glowRef.current.scale.setScalar(finalScale * 1.5);

    // Glow opacity pulses
    const glowMat = glowRef.current.material as THREE.MeshBasicMaterial;
    glowMat.opacity = (0.3 + pulse * 0.1) * visuals.glowIntensity;

    // Subtle floating motion (local offset only, parent group handles world position)
    const floatOffset = Math.sin(anim.time * 0.5) * 0.1;
    meshRef.current.position.y = floatOffset;
    glowRef.current.position.y = floatOffset;

    // Rotate slightly when hovered
    if (hovered || selected) {
      meshRef.current.rotation.y += delta * 0.5;
    }

    // Animate image visibility
    const targetImageOpacity = hovered || selected ? 1 : 0;
    anim.imageOpacity += (targetImageOpacity - anim.imageOpacity) * delta * 5;

    // Scale and position image group
    if (imageGroupRef.current) {
      imageGroupRef.current.position.y = floatOffset + visuals.baseSize * 0.8;
      imageGroupRef.current.scale.setScalar(anim.imageOpacity);
    }
  });

  // Interaction handlers
  const handlePointerOver = () => {
    setHovered(true);
    onHover?.(id);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    onHover?.(null);
    document.body.style.cursor = 'auto';
  };

  const handleClick = () => {
    onClick?.(id);
  };

  // Truncate title for display
  const displayTitle = title.length > 40 ? title.slice(0, 37) + '...' : title;

  return (
    <group position={position}>
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={visuals.glowColor}
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Core orb */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color={visuals.coreColor}
          emissive={visuals.glowColor}
          emissiveIntensity={visuals.glowIntensity * 0.5}
          metalness={0.2}
          roughness={0.3}
          envMapIntensity={1}
        />
      </mesh>

      {/* Article image preview (shows on hover) */}
      {imageUrl && (
        <group ref={imageGroupRef} scale={0}>
          <Suspense fallback={null}>
            <ArticleImage
              imageUrl={imageUrl}
              scale={visuals.baseSize}
              visible={hovered || selected}
            />
          </Suspense>
        </group>
      )}

      {/* Title label (shows on hover) */}
      {(hovered || selected) && (
        <Billboard
          follow
          lockX={false}
          lockY={false}
          lockZ={false}
          position={[0, visuals.baseSize * (imageUrl ? 2.2 : 1.5) + 0.5, 0]}
        >
          <Text
            fontSize={0.25}
            color={theme?.colors.text ?? '#e0e0ff'}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {displayTitle}
          </Text>
        </Billboard>
      )}

      {/* Selection ring */}
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[visuals.baseSize * 1.8, visuals.baseSize * 2, 32]} />
          <meshBasicMaterial
            color={theme?.colors.accent ?? '#ffd700'}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

export type { ArticleOrbProps };
