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

// World display names and descriptions
const WORLD_METADATA: Record<string, { name: string; description: string }> = {
  'bg1': { name: 'Sunset Valley', description: 'Warm golden horizons' },
  'bg2': { name: 'Mountain Peak', description: 'Alpine serenity' },
  'bg3': { name: 'Ocean Vista', description: 'Endless blue waters' },
  'bg4': { name: 'Desert Dunes', description: 'Shifting golden sands' },
  'bg5': { name: 'Forest Glade', description: 'Ancient woodland magic' },
  'bg6': { name: 'City Lights', description: 'Urban nightscape' },
  'bg7': { name: 'Northern Lights', description: 'Aurora dancing' },
  'bg8': { name: 'Tropical Paradise', description: 'Island dreams' },
  'bg9': { name: 'Starfield', description: 'Cosmic wonder' },
  'cave': { name: 'Crystal Cave', description: 'Underground mysteries' },
  'scifi1': { name: 'Cyber Station', description: 'Future tech realm' },
  'space': { name: 'Deep Space', description: 'Infinite cosmos' },
  'start': { name: 'Genesis Point', description: 'Where it all begins' },
  'train': { name: 'Night Express', description: 'Journey through time' },
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
    visitedWorlds,
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
        setTimeout(() => setShowUnlockAnimation(false), 5000);
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
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            display: 'inline-block',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}>◈</span>
          Loading worlds...
        </div>
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
          background: 'radial-gradient(circle at center, rgba(138, 43, 226, 0.9) 0%, rgba(0, 0, 0, 0.95) 70%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.5s ease-out',
        }}>
          <div style={{
            fontSize: '80px',
            marginBottom: '20px',
            animation: 'cosmicPulse 1s ease-in-out infinite',
          }}>
            ✧
          </div>
          <div style={{
            color: '#fff',
            fontSize: '28px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            textAlign: 'center',
            textShadow: '0 0 20px rgba(138, 43, 226, 0.8)',
            marginBottom: '12px',
          }}>
            COSMIC POWER UNLOCKED
          </div>
          <div style={{
            color: '#a78bfa',
            fontSize: '16px',
            fontFamily: 'monospace',
            textAlign: 'center',
            maxWidth: '300px',
          }}>
            You have visited all worlds! Reality Warp mode is now available.
          </div>
        </div>
      )}

      {/* Progress Header */}
      <div style={{
        marginBottom: '16px',
        padding: '12px 16px',
        background: cosmicPowerUnlocked
          ? 'linear-gradient(135deg, rgba(138, 43, 226, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)'
          : 'rgba(17, 17, 17, 0.8)',
        borderRadius: '10px',
        border: cosmicPowerUnlocked
          ? '1px solid rgba(138, 43, 226, 0.5)'
          : '1px solid #222',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}>
          <span style={{
            color: cosmicPowerUnlocked ? '#a78bfa' : '#666',
            fontSize: '11px',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            {cosmicPowerUnlocked ? '✧ COSMIC EXPLORER ✧' : 'World Collection'}
          </span>
          <span style={{
            color: cosmicPowerUnlocked ? '#ec4899' : '#0f0',
            fontSize: '13px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
          }}>
            {visitedCount} / {totalWorlds}
          </span>
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
              ? 'linear-gradient(90deg, #8b5cf6, #ec4899, #8b5cf6)'
              : 'linear-gradient(90deg, #0f0, #0a0)',
            backgroundSize: cosmicPowerUnlocked ? '200% 100%' : '100% 100%',
            animation: cosmicPowerUnlocked ? 'shimmer 2s linear infinite' : 'none',
            transition: 'width 0.5s ease-out',
          }} />
        </div>

        {!cosmicPowerUnlocked && (
          <div style={{
            marginTop: '8px',
            color: '#555',
            fontSize: '10px',
            fontFamily: 'monospace',
          }}>
            Visit all worlds to unlock Cosmic Power
          </div>
        )}
      </div>

      {/* Cosmic Power Button (when unlocked) */}
      {cosmicPowerUnlocked && (
        <button
          onClick={() => {
            // Trigger reality warp effect
            document.body.style.filter = 'hue-rotate(180deg)';
            setTimeout(() => {
              document.body.style.filter = '';
            }, 2000);
          }}
          style={{
            width: '100%',
            padding: '14px',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #8b5cf6 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 3s linear infinite',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
          }}
        >
          <span style={{ fontSize: '18px' }}>✧</span>
          ACTIVATE REALITY WARP
          <span style={{ fontSize: '18px' }}>✧</span>
        </button>
      )}

      {/* World Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: '12px',
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
                background: '#111',
                border: isCurrent
                  ? '2px solid #0f0'
                  : visited
                    ? '1px solid rgba(138, 43, 226, 0.5)'
                    : '1px solid #222',
                borderRadius: '10px',
                cursor: 'pointer',
                overflow: 'hidden',
                aspectRatio: '4/3',
                transition: 'all 0.2s ease',
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
                  filter: visited ? 'none' : 'grayscale(0.3)',
                  transition: 'filter 0.3s ease',
                }} />
              ) : (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, #1a1a3a 0%, #2d1f4e 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '32px', opacity: 0.8 }}>◈</span>
                </div>
              )}

              {/* Gradient overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
              }} />

              {/* Visited checkmark */}
              {visited && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(138, 43, 226, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(138, 43, 226, 0.5)',
                }}>
                  <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>
                </div>
              )}

              {/* Current indicator */}
              {isCurrent && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: 'rgba(0, 255, 0, 0.9)',
                  color: '#000',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                }}>
                  Active
                </div>
              )}

              {/* Type badge for splats */}
              {world.type === 'splat' && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: 'rgba(99, 102, 241, 0.9)',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 'bold',
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
                padding: '10px',
                textAlign: 'left',
              }}>
                <div style={{
                  color: isCurrent ? '#0f0' : '#fff',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  fontFamily: 'monospace',
                  marginBottom: '2px',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}>
                  {world.name}
                </div>
                <div style={{
                  color: '#888',
                  fontSize: '9px',
                  fontFamily: 'monospace',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}>
                  {WORLD_METADATA[world.path.split('/').pop()?.replace(/\.[^/.]+$/, '') || '']?.description || ''}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        @keyframes cosmicPulse {
          0%, 100% {
            transform: scale(1);
            text-shadow: 0 0 20px rgba(138, 43, 226, 0.8);
          }
          50% {
            transform: scale(1.2);
            text-shadow: 0 0 40px rgba(236, 72, 153, 1), 0 0 60px rgba(138, 43, 226, 0.8);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
