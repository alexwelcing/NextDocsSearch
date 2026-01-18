import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useWorldTracker, WorldInfo } from '@/lib/hooks/useWorldTracker';

interface SceneryOption {
  id: string;
  name: string;
  type: 'image' | 'splat';
  path: string;
}

interface WorldGalleryProps {
  onSelectWorld: (world: SceneryOption) => void;
  currentWorld?: string;
  isMobile?: boolean;
}

// World display names and descriptions - mapped to actual panorama content
// These names reflect what you actually see in each 360° scene
const WORLD_METADATA: Record<string, { name: string; description: string; preview: string }> = {
  'bg1': { name: 'Mountain Study', description: 'Cozy cabin workspace', preview: 'Wooden desk with mountain views' },
  'bg2': { name: 'Beach Office', description: 'Coastal workspace', preview: 'Ocean breeze desk setup' },
  'bg3': { name: 'Night Studio', description: 'Urban creative space', preview: 'City lights workstation' },
  'bg4': { name: 'Teal Loft', description: 'Modern art studio', preview: 'Vibrant creative corner' },
  'bg5': { name: 'Grand Library', description: 'Classic reading room', preview: 'Books and warm lighting' },
  'bg6': { name: 'Corner Office', description: 'Executive workspace', preview: 'Sleek professional setup' },
  'bg7': { name: 'Vinyl Lounge', description: 'Retro music room', preview: 'Records and warm wood' },
  'bg8': { name: 'Sound Lab', description: 'Audio production suite', preview: 'Mixing desk and monitors' },
  'bg9': { name: "Enchanter's Den", description: 'Mystical workshop', preview: 'Magical artifacts and tomes' },
  'cave': { name: 'Hollow Haven', description: 'Fantasy treehouse', preview: 'Whimsical forest dwelling' },
  'scifi1': { name: 'Neon Nexus', description: 'Cyberpunk command', preview: 'Holographic displays' },
  'space': { name: 'Orbital Station', description: 'Space station view', preview: 'Earth from above' },
  'start': { name: 'Command Deck', description: 'Starship bridge', preview: 'Sci-fi control panels' },
  'train': { name: 'Sky Pavilion', description: 'Mountain platform', preview: 'Panoramic peaks' },
  'splat4s': { name: '3D Reality', description: 'Immersive dimension', preview: 'Full 3D environment' },
};

// Special features that can be unlocked
export interface UnlockableFeature {
  id: string;
  name: string;
  description: string;
  requiredWorlds: number; // How many worlds need to be visited
  unlocked: boolean;
}

const UNLOCKABLE_FEATURES: UnlockableFeature[] = [
  { id: 'warp', name: 'Reality Warp', description: 'Invert the universe', requiredWorlds: -1, unlocked: false }, // -1 means all worlds
  { id: 'random', name: 'Random Jump', description: 'Teleport to a random world', requiredWorlds: 5, unlocked: false },
  { id: 'speed', name: 'Hyper Transit', description: 'Instant world switching', requiredWorlds: 10, unlocked: false },
  { id: 'secret', name: '???', description: 'Complete your journey to discover', requiredWorlds: -1, unlocked: false },
];

function getWorldNameFromPath(path: string): { name: string; description: string; preview?: string } {
  const filename = path.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown';
  return WORLD_METADATA[filename] || { name: filename.charAt(0).toUpperCase() + filename.slice(1), description: 'Unexplored territory', preview: 'Unknown realm' };
}

// Transition messages for world switching
const TRANSITION_MESSAGES = [
  'Warping reality...',
  'Shifting dimensions...',
  'Traversing the void...',
  'Realigning coordinates...',
  'Quantum tunneling...',
  'Folding spacetime...',
  'Entering wormhole...',
  'Calibrating reality...',
];

export default function WorldGallery({ onSelectWorld, currentWorld, isMobile = false }: WorldGalleryProps) {
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);

  // Transition state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('');
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [targetWorld, setTargetWorld] = useState<WorldInfo | null>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Unlockable features state
  const [unlockedFeatures, setUnlockedFeatures] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('nextdocs_unlocked_features');
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  const {
    allWorldsVisited,
    cosmicPowerUnlocked,
    totalWorlds,
    visitedCount,
    markVisited,
    isVisited
  } = useWorldTracker(worlds);

  // Fetch all available worlds
  useEffect(() => {
    const fetchWorlds = async () => {
      try {
        const response = await fetch('/api/backgrounds');
        const data = await response.json();
        if (data.backgrounds) {
          const worldList: WorldInfo[] = data.backgrounds.map((bg: { id: string; name: string; path: string; type: 'image' | 'splat' }) => {
            const meta = getWorldNameFromPath(bg.path);
            return {
              id: bg.id,
              name: meta.name,
              path: bg.path,
              type: bg.type,
              thumbnail: bg.path,
            };
          });
          setWorlds(worldList);
        }
      } catch (error) {
        console.error('Failed to fetch worlds:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorlds();
  }, []);

  // Check and unlock features based on visited count
  useEffect(() => {
    const newUnlocks: string[] = [];

    UNLOCKABLE_FEATURES.forEach(feature => {
      if (unlockedFeatures.includes(feature.id)) return;

      const shouldUnlock = feature.requiredWorlds === -1
        ? allWorldsVisited && totalWorlds > 0
        : visitedCount >= feature.requiredWorlds;

      if (shouldUnlock) {
        newUnlocks.push(feature.id);
      }
    });

    if (newUnlocks.length > 0) {
      const updated = [...unlockedFeatures, ...newUnlocks];
      setUnlockedFeatures(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nextdocs_unlocked_features', JSON.stringify(updated));
      }
    }
  }, [visitedCount, totalWorlds, allWorldsVisited, unlockedFeatures]);

  // Detect when power is newly unlocked (all worlds visited)
  useEffect(() => {
    if (allWorldsVisited && !justUnlocked && visitedCount === totalWorlds && totalWorlds > 0) {
      const wasUnlockedBefore = localStorage.getItem('nextdocs_unlock_shown') === 'true';
      if (!wasUnlockedBefore) {
        setShowUnlockAnimation(true);
        setJustUnlocked(true);
        localStorage.setItem('nextdocs_unlock_shown', 'true');
        setTimeout(() => setShowUnlockAnimation(false), 4000);
      }
    }
  }, [allWorldsVisited, justUnlocked, visitedCount, totalWorlds]);

  // Cleanup transition timer on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  // Handle world selection with transition animation
  const handleSelectWorld = useCallback((world: WorldInfo) => {
    // Skip if already at this world or transitioning
    if (currentWorld === world.path || isTransitioning) return;

    // Start transition
    setIsTransitioning(true);
    setTargetWorld(world);
    setTransitionMessage(TRANSITION_MESSAGES[Math.floor(Math.random() * TRANSITION_MESSAGES.length)]);
    setTransitionProgress(0);

    // Animate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 0.05;
      setTransitionProgress(Math.min(progress, 0.9));
      if (progress >= 0.9) {
        clearInterval(progressInterval);
      }
    }, 50);

    // After a short delay, trigger the actual world change
    transitionTimerRef.current = setTimeout(() => {
      clearInterval(progressInterval);
      setTransitionProgress(1);

      markVisited(world.id);
      onSelectWorld({
        id: world.id,
        name: world.name,
        type: world.type,
        path: world.path,
      });

      // End transition after world loads
      setTimeout(() => {
        setIsTransitioning(false);
        setTargetWorld(null);
        setTransitionProgress(0);
      }, 500);
    }, 800);
  }, [currentWorld, isTransitioning, markVisited, onSelectWorld]);

  // Random jump to unvisited world (unlockable feature)
  const handleRandomJump = useCallback(() => {
    const unvisitedWorlds = worlds.filter(w => !isVisited(w.id));
    const targetWorlds = unvisitedWorlds.length > 0 ? unvisitedWorlds : worlds;
    const randomWorld = targetWorlds[Math.floor(Math.random() * targetWorlds.length)];
    if (randomWorld) {
      handleSelectWorld(randomWorld);
    }
  }, [worlds, isVisited, handleSelectWorld]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        color: '#555',
        fontFamily: 'monospace',
        fontSize: '0.85rem',
      }}>
        Loading worlds...
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Transition Overlay */}
      {isTransitioning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
        }}>
          {/* Animated ring */}
          <div style={{
            width: '80px',
            height: '80px',
            border: '2px solid transparent',
            borderTopColor: '#0f0',
            borderRadius: '50%',
            marginBottom: '24px',
            animation: 'spin 1s linear infinite',
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '2px solid transparent',
              borderRightColor: '#0f0',
              borderRadius: '50%',
              margin: '8px',
              animation: 'spin 0.8s linear infinite reverse',
            }} />
          </div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{
            color: '#0f0',
            fontSize: '1rem',
            fontWeight: 500,
            fontFamily: 'monospace',
            textAlign: 'center',
            marginBottom: '8px',
            letterSpacing: '0.15em',
          }}>
            {transitionMessage}
          </div>
          {targetWorld && (
            <div style={{
              color: '#fff',
              fontSize: '1.2rem',
              fontWeight: 600,
              fontFamily: 'monospace',
              textAlign: 'center',
              marginBottom: '16px',
            }}>
              → {targetWorld.name}
            </div>
          )}
          {/* Progress bar */}
          <div style={{
            width: '200px',
            height: '4px',
            background: '#222',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${transitionProgress * 100}%`,
              background: 'linear-gradient(90deg, #0f0, #0ff)',
              transition: 'width 0.1s ease-out',
            }} />
          </div>
        </div>
      )}

      {/* Unlock Animation Overlay - Cosmic Power Celebration */}
      {showUnlockAnimation && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(128, 0, 255, 0.3) 0%, rgba(0, 0, 0, 0.98) 70%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Animated cosmic orb */}
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            marginBottom: '32px',
            background: 'radial-gradient(circle at 30% 30%, #fff 0%, #ff00ff 30%, #00ffff 60%, #8000ff 100%)',
            boxShadow: '0 0 60px #ff00ff, 0 0 100px #00ffff, 0 0 140px #8000ff',
            animation: 'cosmicPulse 1.5s ease-in-out infinite, cosmicSpin 3s linear infinite',
          }} />
          <style>{`
            @keyframes cosmicPulse {
              0%, 100% { transform: scale(1); box-shadow: 0 0 60px #ff00ff, 0 0 100px #00ffff, 0 0 140px #8000ff; }
              50% { transform: scale(1.15); box-shadow: 0 0 80px #ff00ff, 0 0 130px #00ffff, 0 0 180px #8000ff; }
            }
            @keyframes cosmicSpin {
              to { filter: hue-rotate(360deg); }
            }
            @keyframes laserFlash {
              0%, 100% { opacity: 0; }
              50% { opacity: 1; }
            }
          `}</style>

          {/* Laser beam decorations */}
          <div style={{
            position: 'absolute',
            width: '2px',
            height: '40%',
            background: 'linear-gradient(to bottom, transparent, #00ffff, transparent)',
            top: '0',
            animation: 'laserFlash 0.5s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute',
            width: '40%',
            height: '2px',
            background: 'linear-gradient(to right, transparent, #ff00ff, transparent)',
            left: '30%',
            animation: 'laserFlash 0.5s ease-in-out infinite 0.25s',
          }} />

          <div style={{
            color: '#fff',
            fontSize: '2rem',
            fontWeight: 700,
            fontFamily: 'monospace',
            textAlign: 'center',
            marginBottom: '16px',
            letterSpacing: '0.15em',
            textShadow: '0 0 20px #ff00ff, 0 0 40px #00ffff',
          }}>
            COSMIC POWER UNLOCKED
          </div>

          <div style={{
            color: '#0ff',
            fontSize: '1.1rem',
            fontFamily: 'monospace',
            textAlign: 'center',
            marginBottom: '24px',
            letterSpacing: '0.1em',
          }}>
            All Worlds Discovered
          </div>

          {/* Bonus list */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '20px',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 0, 255, 0.3)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#ff00ff',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
            }}>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <span>2.5x LARGER HIT ZONE</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#00ffff',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
            }}>
              <span style={{ fontSize: '1.2rem' }}>━━━</span>
              <span>LASER BEAM EFFECTS</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#ffd700',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
            }}>
              <span style={{ fontSize: '1.2rem' }}>★</span>
              <span>1.5x COMBO BOOST</span>
            </div>
          </div>

          <div style={{
            marginTop: '24px',
            color: '#888',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
          }}>
            Play the game to experience your new powers
          </div>
        </div>
      )}

      {/* Casual Counter Header */}
      <div style={{
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'linear-gradient(135deg, rgba(15, 255, 0, 0.1) 0%, rgba(0, 255, 255, 0.05) 100%)',
        borderRadius: '8px',
        border: '1px solid rgba(15, 255, 0, 0.2)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#0f0',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            Worlds Explored
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '1.2rem',
            fontWeight: 700,
            color: '#fff',
            display: 'flex',
            alignItems: 'baseline',
            gap: '4px',
          }}>
            <span style={{ color: '#0f0' }}>{visitedCount}</span>
            <span style={{ color: '#555', fontSize: '0.9rem' }}>/</span>
            <span style={{ color: '#888', fontSize: '0.9rem' }}>{totalWorlds}</span>
          </div>
        </div>
        {/* Progress Bar */}
        <div style={{
          height: '4px',
          background: '#222',
          borderRadius: '2px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${(visitedCount / Math.max(totalWorlds, 1)) * 100}%`,
            background: cosmicPowerUnlocked
              ? 'linear-gradient(90deg, #0f0, #0ff, #f0f)'
              : 'linear-gradient(90deg, #0f0, #0a0)',
            transition: 'width 0.4s ease-out',
            boxShadow: cosmicPowerUnlocked ? '0 0 10px #0f0' : 'none',
          }} />
        </div>
        {/* Casual encouragement */}
        {!cosmicPowerUnlocked && visitedCount > 0 && (
          <div style={{
            marginTop: '8px',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            color: '#666',
          }}>
            {visitedCount === 1 && "Nice start! Keep exploring..."}
            {visitedCount > 1 && visitedCount < totalWorlds / 2 && "You're getting around!"}
            {visitedCount >= totalWorlds / 2 && visitedCount < totalWorlds - 1 && "Almost there, dimension hopper!"}
            {visitedCount === totalWorlds - 1 && "One more world awaits..."}
          </div>
        )}
        {cosmicPowerUnlocked && (
          <div style={{
            marginTop: '8px',
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            color: '#0f0',
          }}>
            Multiverse Master
          </div>
        )}
      </div>

      {/* Unlocked Features */}
      {unlockedFeatures.includes('random') && (
        <button
          onClick={handleRandomJump}
          disabled={isTransitioning}
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '12px',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(0, 255, 255, 0.3)',
            borderRadius: '6px',
            color: '#0ff',
            fontSize: '0.8rem',
            fontWeight: 600,
            fontFamily: 'monospace',
            cursor: isTransitioning ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            opacity: isTransitioning ? 0.5 : 1,
          }}
        >
          ⚡ Random Jump
        </button>
      )}

      {/* Reality Warp Button (when all worlds unlocked) */}
      {cosmicPowerUnlocked && (
        <button
          onClick={() => {
            document.body.style.filter = 'invert(1) hue-rotate(180deg)';
            setTimeout(() => {
              document.body.style.filter = '';
            }, 2000);
          }}
          style={{
            width: '100%',
            padding: '14px',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #fff 0%, #ddd 100%)',
            border: 'none',
            borderRadius: '6px',
            color: '#000',
            fontSize: '0.8rem',
            fontWeight: 600,
            fontFamily: 'monospace',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          ★ Reality Warp
        </button>
      )}

      {/* World Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: '10px',
      }}>
        {worlds.map((world) => {
          const visited = isVisited(world.id);
          const isCurrent = currentWorld === world.path;
          const isTarget = targetWorld?.id === world.id;

          return (
            <button
              key={world.id}
              onClick={() => handleSelectWorld(world)}
              disabled={isTransitioning}
              style={{
                position: 'relative',
                padding: 0,
                background: '#0a0a0a',
                border: isCurrent
                  ? '2px solid #0f0'
                  : isTarget
                  ? '2px solid #0ff'
                  : '1px solid #333',
                borderRadius: '8px',
                cursor: isTransitioning ? 'not-allowed' : 'pointer',
                overflow: 'hidden',
                aspectRatio: '16/10',
                transition: 'all 0.2s ease',
                opacity: isTransitioning && !isTarget ? 0.6 : 1,
                transform: isTarget ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              {/* Thumbnail */}
              {world.type === 'image' && world.thumbnail ? (
                <Image
                  src={world.thumbnail}
                  alt={world.name}
                  fill
                  style={{
                    objectFit: 'cover',
                    opacity: visited ? 1 : 0.6,
                    transition: 'opacity 0.3s, transform 0.3s',
                    transform: isTarget ? 'scale(1.1)' : 'scale(1)',
                  }}
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              ) : (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: '28px',
                    color: visited ? '#0ff' : '#444',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                  }}>3D</span>
                </div>
              )}

              {/* Gradient overlay for text readability */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
              }} />

              {/* Target transition indicator */}
              {isTarget && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    border: '2px solid #0ff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                </div>
              )}

              {/* Visited indicator */}
              {visited && !isTarget && (
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '18px',
                  height: '18px',
                  background: '#0f0',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}>
                  <span style={{
                    color: '#000',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}>✓</span>
                </div>
              )}

              {/* Current indicator */}
              {isCurrent && (
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  padding: '3px 8px',
                  background: '#0f0',
                  color: '#000',
                  fontSize: '9px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  borderRadius: '3px',
                }}>
                  Here
                </div>
              )}

              {/* 3D badge for splats */}
              {world.type === 'splat' && !isCurrent && (
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  padding: '3px 8px',
                  background: 'rgba(0, 255, 255, 0.9)',
                  color: '#000',
                  fontSize: '9px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  borderRadius: '3px',
                }}>
                  3D
                </div>
              )}

              {/* World name */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '10px',
              }}>
                <div style={{
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  lineHeight: 1.2,
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}>
                  {world.name}
                </div>
                {!visited && (
                  <div style={{
                    color: '#666',
                    fontSize: '0.65rem',
                    fontFamily: 'monospace',
                    marginTop: '2px',
                  }}>
                    Unexplored
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
