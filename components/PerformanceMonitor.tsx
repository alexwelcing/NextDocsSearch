import React, { useEffect, useRef, useState } from 'react';
import { perfLogger } from '@/lib/performance-logger';

interface PerformanceStats {
  fps: number;
  ms: number;
}

/**
 * Enhanced performance monitor for 3D scenes
 * Shows FPS and frame time - positioned outside Canvas
 */
const PerformanceMonitor: React.FC = () => {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 0,
    ms: 0,
  });
  const [showDetails, setShowDetails] = useState(false);

  const frameTimeRef = useRef<number[]>([]);
  const lastTimeRef = useRef(performance.now());
  const rafIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const updateStats = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Track frame times (last 60 frames)
      frameTimeRef.current.push(delta);
      if (frameTimeRef.current.length > 60) {
        frameTimeRef.current.shift();
      }

      // Calculate average FPS
      const avgFrameTime = frameTimeRef.current.reduce((a, b) => a + b, 0) / frameTimeRef.current.length;
      const fps = Math.round(1000 / avgFrameTime);

      // Log to performance logger
      perfLogger.log(fps, avgFrameTime);

      setStats({
        fps,
        ms: Math.round(avgFrameTime * 10) / 10,
      });

      rafIdRef.current = requestAnimationFrame(updateStats);
    };

    rafIdRef.current = requestAnimationFrame(updateStats);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Get FPS color indicator
  const getFpsColor = (fps: number) => {
    if (fps >= 55) return '#0f0'; // Green - excellent
    if (fps >= 45) return '#9f0'; // Yellow-green - good
    if (fps >= 30) return '#ff0'; // Yellow - acceptable
    if (fps >= 20) return '#f90'; // Orange - poor
    return '#f00'; // Red - terrible
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        left: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        color: '#fff',
        padding: '4px 6px',
        borderRadius: '3px',
        fontFamily: 'monospace',
        fontSize: '9px',
        zIndex: 10000,
        minWidth: '80px',
        userSelect: 'none',
        cursor: 'pointer',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
      onClick={() => setShowDetails(!showDetails)}
    >
      <div style={{ marginBottom: '3px', borderBottom: '1px solid rgba(68, 68, 68, 0.3)', paddingBottom: '2px' }}>
        <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '2px' }}>
          Perf
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ fontWeight: 'bold', color: getFpsColor(stats.fps), fontSize: '8px' }}>FPS:</span>
        <span style={{ color: getFpsColor(stats.fps), fontSize: '10px', fontWeight: 'bold' }}>
          {stats.fps}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
        <span style={{ fontSize: '8px' }}>MS:</span>
        <span style={{ color: stats.ms > 33 ? '#f90' : stats.ms > 16 ? '#ff0' : '#0f0', fontSize: '8px' }}>
          {stats.ms}
        </span>
      </div>

      {showDetails && (
        <>
          <div style={{ borderTop: '1px solid #444', marginTop: '8px', paddingTop: '8px' }}>
            <div style={{ fontSize: '10px', color: '#888', lineHeight: '1.4' }}>
              <strong>Console Commands:</strong><br />
              perfLogger.enable()<br />
              perfLogger.getStats()<br />
              perfLogger.exportCSV()<br />
              <br />
              <strong>FPS Guide:</strong><br />
              <span style={{ color: '#0f0' }}>●</span> 55+ Excellent<br />
              <span style={{ color: '#ff0' }}>●</span> 30-45 OK<br />
              <span style={{ color: '#f00' }}>●</span> &lt;30 Poor
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PerformanceMonitor;
