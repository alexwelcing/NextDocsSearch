import React from 'react';
import { useNarrative } from './NarrativeContext';

interface StoryObjectivePanelProps {
  isHidden?: boolean;
}

export default function StoryObjectivePanel({ isHidden }: StoryObjectivePanelProps) {
  const { currentChapter } = useNarrative();

  if (isHidden) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 1200,
        maxWidth: '320px',
        padding: '14px 16px',
        background: 'rgba(8, 12, 8, 0.9)',
        border: '1px solid rgba(0, 255, 0, 0.3)',
        borderRadius: '10px',
        color: '#d6f7d6',
        fontFamily: 'monospace',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div style={{ fontSize: '10px', color: '#6aa96a', letterSpacing: '0.12em' }}>
        CURRENT MISSION
      </div>
      <div style={{ fontSize: '15px', fontWeight: 600, margin: '6px 0 8px' }}>
        {currentChapter.title}
      </div>
      <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#b9d9b9' }}>
        {currentChapter.brief}
      </div>
      <div style={{ marginTop: '10px', fontSize: '11px', color: '#7ff77f' }}>
        Reward: {currentChapter.reward}
      </div>
    </div>
  );
}
