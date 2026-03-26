/**
 * ProGen Demo Page
 * 
 * Showcases the procedural character generation system
 * with real-time preview and admin controls.
 */

import React, { useState, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, ContactShadows } from '@react-three/drei';
import { ProGenCharacterMesh, ProGenCharacterRef, ProGenAdmin } from '@/components/3d/progen';
import { ProGenCharacter } from '@/lib/progen';
import { CharacterGenerator } from '@/lib/progen/generators/CharacterGenerator';

export default function ProGenDemoPage() {
  const [character, setCharacter] = useState<ProGenCharacter | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const characterRef = useRef<ProGenCharacterRef>(null);
  
  // Generate initial character
  React.useEffect(() => {
    const generator = new CharacterGenerator();
    const initial = generator.generate({
      archetype: 'explorer',
      theme: 'cyberpunk',
      seed: 12345
    });
    setCharacter(initial);
  }, []);
  
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>ProGen Character System</h1>
        <p style={styles.subtitle}>Procedural Character Generation with Quality Validation</p>
        <button
          onClick={() => setShowAdmin(!showAdmin)}
          style={styles.adminToggle}
        >
          {showAdmin ? 'Hide Admin' : 'Show Admin'}
        </button>
      </header>
      
      <div style={styles.main}>
        {/* 3D Viewport */}
        <div style={styles.viewport}>
          <Canvas
            camera={{ position: [3, 2, 4], fov: 45 }}
            gl={{ antialias: true }}
          >
            <color attach="background" args={['#0a0a0f']} />
            <fog attach="fog" args={['#0a0a0f', 5, 20]} />
            
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
            <pointLight position={[-5, 5, -5]} intensity={0.5} color="#4ECDC4" />
            
            <Suspense fallback={null}>
              {character && (
                <ProGenCharacterMesh
                  ref={characterRef}
                  character={character}
                  position={[0, 0, 0]}
                  scale={1}
                  castShadow
                  receiveShadow
                />
              )}
              
              <Grid
                position={[0, -0.01, 0]}
                args={[20, 20]}
                cellSize={1}
                cellThickness={0.5}
                cellColor="#2a2a40"
                sectionSize={5}
                sectionThickness={1}
                sectionColor="#4ECDC4"
                fadeDistance={15}
                fadeStrength={1}
                infiniteGrid
              />
              
              <ContactShadows
                position={[0, 0, 0]}
                opacity={0.4}
                scale={20}
                blur={2}
                far={5}
              />
              
              <Environment preset="city" />
            </Suspense>
            
            <OrbitControls
              target={[0, 1, 0]}
              minDistance={2}
              maxDistance={10}
              enablePan={false}
              maxPolarAngle={Math.PI / 2 - 0.1}
            />
          </Canvas>
          
          {/* Character Info Overlay */}
          {character && (
            <div style={styles.infoOverlay}>
              <h3 style={styles.infoName}>{character.identity.displayName}</h3>
              <div style={styles.infoGrid}>
                <InfoItem label="Archetype" value={character.identity.archetype} />
                <InfoItem label="Build" value={character.body.build} />
                <InfoItem label="Height" value={`${character.body.proportions.height.toFixed(2)}m`} />
                <InfoItem label="Quality" value={`${character.generation.quality.overall}/100`} />
                <InfoItem label="Proportions" value={`${character.generation.quality.proportions}/100`} />
                <InfoItem label="Aesthetics" value={`${character.generation.quality.aesthetics}/100`} />
              </div>
              
              {/* Animation Controls */}
              <div style={styles.animControls}>
                <button
                  onClick={() => characterRef.current?.setAnimation('idle')}
                  style={styles.animButton}
                >
                  Idle
                </button>
                <button
                  onClick={() => characterRef.current?.setAnimation('walk')}
                  style={styles.animButton}
                >
                  Walk
                </button>
                <button
                  onClick={() => characterRef.current?.setAnimation('run')}
                  style={styles.animButton}
                >
                  Run
                </button>
              </div>
              
              {/* Color Preview */}
              <div style={styles.colorPreview}>
                <ColorDot color={character.colors.primary} label="Primary" />
                <ColorDot color={character.colors.secondary} label="Secondary" />
                <ColorDot color={character.colors.skinTone} label="Skin" />
                <ColorDot color={character.colors.eyeColor} label="Eyes" />
              </div>
            </div>
          )}
        </div>
        
        {/* Admin Panel */}
        {showAdmin && (
          <div style={styles.adminPanel}>
            <ProGenAdmin onCharacterSelect={setCharacter} />
          </div>
        )}
      </div>
      
      {/* Quick Actions */}
      <div style={styles.quickActions}>
        <QuickAction
          label="Explorer"
          onClick={() => {
            const gen = new CharacterGenerator();
            setCharacter(gen.generate({ archetype: 'explorer', theme: 'cyberpunk' }));
          }}
        />
        <QuickAction
          label="Warrior"
          onClick={() => {
            const gen = new CharacterGenerator();
            setCharacter(gen.generate({ archetype: 'warrior', theme: 'industrial' }));
          }}
        />
        <QuickAction
          label="Mystic"
          onClick={() => {
            const gen = new CharacterGenerator();
            setCharacter(gen.generate({ archetype: 'mystic', theme: 'neon' }));
          }}
        />
        <QuickAction
          label="Random"
          onClick={() => {
            const gen = new CharacterGenerator();
            setCharacter(gen.generate());
          }}
        />
      </div>
    </div>
  );
}

// === Subcomponents ===

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={styles.infoItem}>
    <span style={styles.infoLabel}>{label}</span>
    <span style={styles.infoValue}>{value}</span>
  </div>
);

const ColorDot: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div style={styles.colorDotWrapper}>
    <div style={{ ...styles.colorDot, backgroundColor: color }} />
    <span style={styles.colorDotLabel}>{label}</span>
  </div>
);

const QuickAction: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button onClick={onClick} style={styles.quickAction}>
    {label}
  </button>
);

// === Styles ===

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0f',
    color: '#e0e0e0',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #2a2a40',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px'
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#4ECDC4'
  },
  subtitle: {
    margin: 0,
    flex: 1,
    color: '#888',
    fontSize: '14px'
  },
  adminToggle: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid #4ECDC4',
    backgroundColor: 'transparent',
    color: '#4ECDC4',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden'
  },
  viewport: {
    flex: 1,
    position: 'relative',
    minHeight: '500px'
  },
  infoOverlay: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    backgroundColor: 'rgba(10, 10, 15, 0.9)',
    backdropFilter: 'blur(10px)',
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #2a2a40',
    minWidth: '220px',
    maxWidth: '280px'
  },
  infoName: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    color: '#4ECDC4',
    borderBottom: '1px solid #2a2a40',
    paddingBottom: '8px'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px 16px',
    marginBottom: '16px'
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  infoLabel: {
    fontSize: '10px',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  infoValue: {
    fontSize: '13px',
    color: '#e0e0e0',
    fontWeight: 500
  },
  animControls: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px'
  },
  animButton: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #3a3a50',
    backgroundColor: '#1e1e30',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s'
  },
  colorPreview: {
    display: 'flex',
    gap: '12px'
  },
  colorDotWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  },
  colorDot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    border: '2px solid #3a3a50'
  },
  colorDotLabel: {
    fontSize: '9px',
    color: '#666'
  },
  adminPanel: {
    width: '400px',
    borderLeft: '1px solid #2a2a40',
    overflowY: 'auto',
    backgroundColor: '#0a0a0f'
  },
  quickActions: {
    display: 'flex',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid #2a2a40',
    backgroundColor: '#0a0a0f'
  },
  quickAction: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: '1px solid #3a3a50',
    backgroundColor: '#1e1e30',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
  }
};
