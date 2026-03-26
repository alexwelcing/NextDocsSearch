/**
 * ProGen Admin Panel
 * 
 * UI for managing character generation batches,
 * viewing statistics, and controlling the ProGen system.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ProGen, getProGen } from '@/lib/progen/ProGen';
import { CharacterGenerator } from '@/lib/progen/generators/CharacterGenerator';
import {
  CharacterArchetype, StyleTheme, GenerationBatch, ProGenCharacter,
  CharacterSummary, GenerationMetrics
} from '@/lib/progen/types';

const ARCHETYPES: CharacterArchetype[] = [
  'explorer', 'scholar', 'warrior', 'mystic',
  'artisan', 'diplomat', 'rogue', 'guardian',
  'nomad', 'pioneer', 'observer', 'catalyst'
];

const THEMES: StyleTheme[] = [
  'cyberpunk', 'solarpunk', 'retrofuturism', 'biopunk',
  'minimalist', 'baroque', 'industrial', 'organic',
  'neon', 'monochrome', 'pastel', 'vibrant'
];

interface ProGenAdminProps {
  onCharacterSelect?: (character: ProGenCharacter) => void;
}

export const ProGenAdmin: React.FC<ProGenAdminProps> = ({ onCharacterSelect }) => {
  const [progen] = useState(() => getProGen());
  const [batches, setBatches] = useState<GenerationBatch[]>([]);
  const [metrics, setMetrics] = useState<GenerationMetrics | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewCharacter, setPreviewCharacter] = useState<ProGenCharacter | null>(null);
  
  // Generation form state
  const [batchName, setBatchName] = useState('');
  const [batchCount, setBatchCount] = useState(10);
  const [selectedArchetypes, setSelectedArchetypes] = useState<CharacterArchetype[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<StyleTheme[]>(['cyberpunk']);
  const [qualityThreshold, setQualityThreshold] = useState(75);
  
  // Progress tracking
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    stage: string;
  } | null>(null);
  
  const refreshData = useCallback(() => {
    setBatches(progen.getAllBatches());
    setMetrics(progen.getMetrics());
    setCharacters(progen.getStoreStats().mostUsed);
  }, [progen]);
  
  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000);
    return () => clearInterval(interval);
  }, [refreshData]);
  
  const handleGenerateBatch = async () => {
    if (!batchName || batchCount < 1) return;
    
    setIsGenerating(true);
    setProgress({ current: 0, total: batchCount, stage: 'starting' });
    
    try {
      await progen.createBatch(
        batchName,
        {
          count: batchCount,
          archetypes: selectedArchetypes.length > 0 ? selectedArchetypes : undefined,
          styleThemes: selectedThemes.length > 0 ? selectedThemes : undefined,
          qualityThreshold,
          variationStrategy: 'clustered',
          allowDuplicates: false,
          maxAttempts: 5
        },
        (prog) => {
          setProgress({
            current: prog.approved,
            total: prog.total,
            stage: prog.currentStage
          });
        }
      );
      
      refreshData();
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };
  
  const handleQuickGenerate = () => {
    const generator = new CharacterGenerator();
    const archetype = selectedArchetypes[0] || ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
    const theme = selectedThemes[0] || THEMES[Math.floor(Math.random() * THEMES.length)];
    
    const character = generator.generate({
      archetype,
      theme,
      seed: Date.now()
    });
    
    setPreviewCharacter(character);
    if (onCharacterSelect) {
      onCharacterSelect(character);
    }
  };
  
  const toggleArchetype = (archetype: CharacterArchetype) => {
    setSelectedArchetypes(prev =>
      prev.includes(archetype)
        ? prev.filter(a => a !== archetype)
        : [...prev, archetype]
    );
  };
  
  const toggleTheme = (theme: StyleTheme) => {
    setSelectedThemes(prev =>
      prev.includes(theme)
        ? prev.filter(t => t !== theme)
        : [...prev, theme]
    );
  };
  
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>ProGen Character System</h1>
      
      {/* Stats Panel */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Statistics</h2>
        {metrics && (
          <div style={styles.statsGrid}>
            <StatCard label="Total Generated" value={metrics.totalGenerated} />
            <StatCard label="Approved" value={metrics.totalApproved} />
            <StatCard label="Avg Quality" value={`${metrics.averageQuality.toFixed(1)}%`} />
            <StatCard label="Cache Hit Rate" value={`${(metrics.cacheHitRate * 100).toFixed(1)}%`} />
          </div>
        )}
      </div>
      
      {/* Quick Generate */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Quick Preview</h2>
        <button
          onClick={handleQuickGenerate}
          disabled={isGenerating}
          style={styles.button}
        >
          Generate Preview
        </button>
        
        {previewCharacter && (
          <div style={styles.previewCard}>
            <h3>{previewCharacter.identity.displayName}</h3>
            <p>Archetype: {previewCharacter.identity.archetype}</p>
            <p>Quality: {previewCharacter.generation.quality.overall}/100</p>
            <p>Build: {previewCharacter.body.build}</p>
            <div style={styles.colorSwatches}>
              <ColorSwatch color={previewCharacter.colors.primary} label="Primary" />
              <ColorSwatch color={previewCharacter.colors.secondary} label="Secondary" />
              <ColorSwatch color={previewCharacter.colors.skinTone} label="Skin" />
            </div>
          </div>
        )}
      </div>
      
      {/* Batch Generation */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Batch Generation</h2>
        
        <div style={styles.formGroup}>
          <label>Batch Name</label>
          <input
            type="text"
            value={batchName}
            onChange={e => setBatchName(e.target.value)}
            placeholder="e.g., Cyberpunk Warriors"
            style={styles.input}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label>Count: {batchCount}</label>
          <input
            type="range"
            min={1}
            max={100}
            value={batchCount}
            onChange={e => setBatchCount(Number(e.target.value))}
            style={styles.slider}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label>Quality Threshold: {qualityThreshold}%</label>
          <input
            type="range"
            min={50}
            max={95}
            value={qualityThreshold}
            onChange={e => setQualityThreshold(Number(e.target.value))}
            style={styles.slider}
          />
        </div>
        
        <div style={styles.formGroup}>
          <label>Archetypes (optional)</label>
          <div style={styles.chipGrid}>
            {ARCHETYPES.map(archetype => (
              <button
                key={archetype}
                onClick={() => toggleArchetype(archetype)}
                style={{
                  ...styles.chip,
                  ...(selectedArchetypes.includes(archetype) ? styles.chipActive : {})
                }}
              >
                {archetype}
              </button>
            ))}
          </div>
        </div>
        
        <div style={styles.formGroup}>
          <label>Themes</label>
          <div style={styles.chipGrid}>
            {THEMES.map(theme => (
              <button
                key={theme}
                onClick={() => toggleTheme(theme)}
                style={{
                  ...styles.chip,
                  ...(selectedThemes.includes(theme) ? styles.chipActive : {})
                }}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
        
        <button
          onClick={handleGenerateBatch}
          disabled={isGenerating || !batchName}
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            ...(isGenerating ? styles.buttonDisabled : {})
          }}
        >
          {isGenerating ? 'Generating...' : 'Start Batch'}
        </button>
        
        {progress && (
          <div style={styles.progressBar}>
            <div style={{
              ...styles.progressFill,
              width: `${(progress.current / progress.total) * 100}%`
            }} />
            <span style={styles.progressText}>
              {progress.current} / {progress.total} ({progress.stage})
            </span>
          </div>
        )}
      </div>
      
      {/* Active Batches */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Active Batches</h2>
        <div style={styles.batchList}>
          {batches.map(batch => (
            <div key={batch.id} style={styles.batchCard}>
              <h4>{batch.name}</h4>
              <p>Status: <StatusBadge status={batch.status} /></p>
              <p>Progress: {batch.progress.approved}/{batch.progress.total}</p>
              <p>Created: {batch.createdAt.toLocaleString()}</p>
            </div>
          ))}
          {batches.length === 0 && <p>No active batches</p>}
        </div>
      </div>
      
      {/* Character Library */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Character Library</h2>
        <div style={styles.characterGrid}>
          {characters.map(char => (
            <div
              key={char.id}
              style={styles.characterCard}
              onClick={() => {
                const full = progen.getCharacter(char.id);
                if (full && onCharacterSelect) {
                  onCharacterSelect(full.character);
                }
              }}
            >
              <div style={styles.characterThumbnail}>
                {char.thumbnailUrl ? (
                  <img src={char.thumbnailUrl} alt={char.name} style={styles.thumbnail} />
                ) : (
                  <div style={styles.thumbnailPlaceholder}>{char.name[0]}</div>
                )}
              </div>
              <div style={styles.characterInfo}>
                <h4>{char.name}</h4>
                <p>{char.archetype}</p>
                <p style={styles.qualityBadge}>Q: {char.quality.overall}</p>
              </div>
            </div>
          ))}
          {characters.length === 0 && <p>No characters generated yet</p>}
        </div>
      </div>
    </div>
  );
};

// === Subcomponents ===

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div style={styles.statCard}>
    <div style={styles.statValue}>{value}</div>
    <div style={styles.statLabel}>{label}</div>
  </div>
);

const ColorSwatch: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div style={styles.swatch}>
    <div style={{ ...styles.swatchColor, backgroundColor: color }} />
    <span style={styles.swatchLabel}>{label}</span>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    pending: '#FFA500',
    generating: '#4169E1',
    validating: '#9370DB',
    complete: '#32CD32',
    failed: '#DC143C'
  };
  
  return (
    <span style={{ ...styles.statusBadge, backgroundColor: colors[status] || '#808080' }}>
      {status}
    </span>
  );
};

// === Styles ===

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#e0e0e0',
    backgroundColor: '#0a0a0f',
    minHeight: '100vh'
  },
  title: {
    fontSize: '28px',
    marginBottom: '24px',
    color: '#fff',
    borderBottom: '2px solid #4ECDC4',
    paddingBottom: '12px'
  },
  section: {
    backgroundColor: '#141420',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid #2a2a40'
  },
  sectionTitle: {
    fontSize: '18px',
    marginBottom: '16px',
    color: '#4ECDC4'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px'
  },
  statCard: {
    backgroundColor: '#1e1e30',
    padding: '16px',
    borderRadius: '8px',
    textAlign: 'center'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#4ECDC4'
  },
  statLabel: {
    fontSize: '12px',
    color: '#888',
    marginTop: '4px'
  },
  formGroup: {
    marginBottom: '16px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #3a3a50',
    backgroundColor: '#1e1e30',
    color: '#e0e0e0',
    fontSize: '14px',
    marginTop: '6px',
    boxSizing: 'border-box'
  },
  slider: {
    width: '100%',
    marginTop: '8px'
  },
  chipGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px'
  },
  chip: {
    padding: '6px 12px',
    borderRadius: '16px',
    border: '1px solid #3a3a50',
    backgroundColor: '#1e1e30',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s'
  },
  chipActive: {
    backgroundColor: '#4ECDC4',
    color: '#0a0a0f',
    borderColor: '#4ECDC4'
  },
  button: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#2a2a40',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  buttonPrimary: {
    backgroundColor: '#4ECDC4',
    color: '#0a0a0f',
    fontWeight: 'bold'
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  progressBar: {
    marginTop: '16px',
    height: '24px',
    backgroundColor: '#1e1e30',
    borderRadius: '12px',
    overflow: 'hidden',
    position: 'relative'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ECDC4',
    transition: 'width 0.3s ease'
  },
  progressText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#fff',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
  },
  previewCard: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#1e1e30',
    borderRadius: '8px'
  },
  colorSwatches: {
    display: 'flex',
    gap: '12px',
    marginTop: '12px'
  },
  swatch: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  swatchColor: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '2px solid #3a3a50'
  },
  swatchLabel: {
    fontSize: '10px',
    color: '#888',
    marginTop: '4px'
  },
  batchList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  batchCard: {
    padding: '12px 16px',
    backgroundColor: '#1e1e30',
    borderRadius: '8px',
    borderLeft: '3px solid #4ECDC4'
  },
  statusBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    textTransform: 'uppercase',
    fontWeight: 'bold'
  },
  characterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px'
  },
  characterCard: {
    backgroundColor: '#1e1e30',
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    border: '1px solid #2a2a40'
  },
  characterThumbnail: {
    aspectRatio: '1',
    backgroundColor: '#2a2a40',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  thumbnailPlaceholder: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#4ECDC4'
  },
  characterInfo: {
    padding: '12px'
  },
  qualityBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#4ECDC4',
    color: '#0a0a0f',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    marginTop: '8px'
  }
};

export default ProGenAdmin;
