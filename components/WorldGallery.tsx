import React, { useState, useEffect, useCallback } from 'react';
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

// World display names and descriptions based on actual panoramas
const WORLD_METADATA: Record<string, { name: string; description: string }> = {
  'bg1': { name: "Dreamer's Study", description: 'Cozy mountain retreat' },
  'bg2': { name: 'Coastal Retreat', description: 'Beachside workspace' },
  'bg3': { name: 'Midnight Office', description: 'Sleek urban den' },
  'bg4': { name: "Artist's Loft", description: 'Vibrant teal studio' },
  'bg5': { name: "Scholar's Archive", description: 'Victorian library' },
  'bg6': { name: 'Executive Suite', description: 'Refined workspace' },
  'bg7': { name: 'Vinyl Lounge', description: 'Retro music room' },
  'bg8': { name: 'Sound Lab', description: 'Creative studio' },
  'bg9': { name: "Enchanter's Den", description: 'Mystical workshop' },
  'cave': { name: 'Hollow Haven', description: 'Magical treehouse' },
  'scifi1': { name: 'Neon Nexus', description: 'Cyberpunk lab' },
  'space': { name: 'Orbital Station', description: 'Cosmic command' },
  'start': { name: 'Command Deck', description: 'Starship bridge' },
  'train': { name: 'Sky Pavilion', description: 'Mountain observatory' },
  'splat4s': { name: '3D Reality', description: 'Immersive dimension' },
};

function getWorldNameFromPath(path: string): { name: string; description: string } {
  const filename = path.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Unknown';
  return WORLD_METADATA[filename] || { name: filename.charAt(0).toUpperCase() + filename.slice(1), description: 'Unexplored territory' };
}

export default function WorldGallery({ onSelectWorld, currentWorld, isMobile = false }: WorldGalleryProps) {
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUnlockAnimation, setShowUnlockAnimation] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);

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

  // Detect when power is newly unlocked
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

  const handleSelectWorld = useCallback((world: WorldInfo) => {
    markVisited(world.id);
    onSelectWorld({
      id: world.id,
      name: world.name,
      type: world.type,
      path: world.path,
    });
  }, [markVisited, onSelectWorld]);

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
      {/* Unlock Animation Overlay */}
      {showUnlockAnimation && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '2px solid #fff',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: '24px' }}>*</span>
          </div>
          <div style={{
            color: '#fff',
            fontSize: '1.5rem',
            fontWeight: 600,
            fontFamily: 'monospace',
            textAlign: 'center',
            marginBottom: '12px',
            letterSpacing: '0.1em',
          }}>
            ALL WORLDS DISCOVERED
          </div>
          <div style={{
            color: '#666',
            fontSize: '0.85rem',
            fontFamily: 'monospace',
            textAlign: 'center',
          }}>
            Reality Warp unlocked
          </div>
        </div>
      )}

      {/* Header with Progress */}
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          fontFamily: 'monospace',
          fontSize: '0.7rem',
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          {cosmicPowerUnlocked ? 'Explorer' : 'Collection'}
        </div>
        <div style={{
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          color: cosmicPowerUnlocked ? '#fff' : '#888',
        }}>
          {visitedCount}/{totalWorlds}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        height: '2px',
        background: '#222',
        marginBottom: '24px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${(visitedCount / Math.max(totalWorlds, 1)) * 100}%`,
          background: cosmicPowerUnlocked ? '#fff' : '#555',
          transition: 'width 0.4s ease-out',
        }} />
      </div>

      {/* Reality Warp Button (when unlocked) */}
      {cosmicPowerUnlocked && (
        <button
          onClick={() => {
            document.body.style.filter = 'invert(1)';
            setTimeout(() => {
              document.body.style.filter = '';
            }, 1500);
          }}
          style={{
            width: '100%',
            padding: '14px',
            marginBottom: '24px',
            background: '#fff',
            border: 'none',
            color: '#000',
            fontSize: '0.8rem',
            fontWeight: 600,
            fontFamily: 'monospace',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Reality Warp
        </button>
      )}

      {/* World Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: '8px',
      }}>
        {worlds.map((world) => {
          const visited = isVisited(world.id);
          const isCurrent = currentWorld === world.path;

          return (
            <button
              key={world.id}
              onClick={() => handleSelectWorld(world)}
              style={{
                position: 'relative',
                padding: 0,
                background: '#0a0a0a',
                border: isCurrent ? '2px solid #fff' : '1px solid #222',
                cursor: 'pointer',
                overflow: 'hidden',
                aspectRatio: '16/10',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Thumbnail */}
              {world.type === 'image' ? (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${world.thumbnail})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: visited ? 1 : 0.5,
                  transition: 'opacity 0.2s',
                }} />
              ) : (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: '24px',
                    color: '#333',
                    fontFamily: 'monospace',
                  }}>3D</span>
                </div>
              )}

              {/* Gradient overlay for text readability */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)',
              }} />

              {/* Visited indicator */}
              {visited && (
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '16px',
                  height: '16px',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{
                    color: '#000',
                    fontSize: '10px',
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
                  padding: '2px 6px',
                  background: '#fff',
                  color: '#000',
                  fontSize: '8px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                }}>
                  Active
                </div>
              )}

              {/* 3D badge for splats */}
              {world.type === 'splat' && !isCurrent && (
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  padding: '2px 6px',
                  background: 'rgba(255,255,255,0.9)',
                  color: '#000',
                  fontSize: '8px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
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
                padding: '8px',
              }}>
                <div style={{
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  lineHeight: 1.2,
                }}>
                  {world.name}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
