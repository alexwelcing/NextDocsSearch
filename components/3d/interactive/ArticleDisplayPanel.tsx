import React, { useState, useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ArticleDisplay } from '@/pages/api/article-display';

/**
 * Self-contained 3D floating panel that displays article details.
 * Fetches its own data from /api/article-display.
 * Uses only inline styles — no styled-components, no next/image.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ArticleDisplayPanel({ isOpen, onClose }: Props) {
  const [articles, setArticles] = useState<ArticleDisplay[]>([]);
  const [idx, setIdx] = useState(0);
  const [imgOk, setImgOk] = useState(false);
  const [status, setStatus] = useState('INITIALIZING...');
  const groupRef = useRef<THREE.Group>(null);

  // Fetch article data when panel opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setStatus('FETCHING DATA...');

    fetch('/api/article-display')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(body => {
        if (cancelled) return;
        const list = body?.articles;
        if (Array.isArray(list) && list.length > 0) {
          setArticles(list);
          setStatus(`${list.length} RECORDS LOADED`);
        } else {
          setStatus(`NO DATA — API returned count=${body?.count ?? '?'}`);
        }
      })
      .catch(err => {
        if (!cancelled) setStatus(`ERROR: ${err.message}`);
      });

    return () => { cancelled = true; };
  }, [isOpen]);

  // Reset image state on article change
  useEffect(() => { setImgOk(false); }, [idx]);

  // Gentle floating animation
  useFrame(({ clock }) => {
    if (!groupRef.current || !isOpen) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.set(
      Math.sin(t * 0.4) * 0.3,
      4 + Math.sin(t * 0.6) * 0.15,
      -6
    );
    groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.02;
  });

  if (!isOpen) return null;

  const article = articles[idx];
  const total = articles.length;

  const prev = () => setIdx(i => (i - 1 + total) % total);
  const next = () => setIdx(i => (i + 1) % total);

  // ─── All styles are inline objects ───

  const panel: React.CSSProperties = {
    width: 800, height: 600,
    background: 'rgba(10,10,16,0.95)',
    border: '1px solid rgba(100,200,255,0.3)',
    borderRadius: 12, padding: 24,
    display: 'flex', flexDirection: 'column',
    color: '#e0e0ff',
    fontFamily: "'Courier New', monospace",
    boxShadow: '0 0 30px rgba(0,100,255,0.2)',
    overflow: 'hidden', pointerEvents: 'auto',
  };

  const header: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, paddingBottom: 10,
    borderBottom: '1px solid rgba(100,200,255,0.2)',
  };

  const heading: React.CSSProperties = {
    margin: 0, fontSize: 20, color: '#00ffff',
    textShadow: '0 0 10px rgba(0,255,255,0.5)',
  };

  const closeBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: '#ff4444',
    cursor: 'pointer', fontSize: 22, fontWeight: 'bold',
  };

  const content: React.CSSProperties = {
    flex: 1, display: 'flex', gap: 20, overflow: 'hidden',
  };

  const imgBox: React.CSSProperties = {
    flex: 1, position: 'relative',
    background: '#111', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  const imgStyle: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0,
    width: '100%', height: '100%', objectFit: 'cover',
  };

  const info: React.CSSProperties = {
    flex: 1, display: 'flex', flexDirection: 'column', gap: 8,
    overflowY: 'auto',
  };

  const meta: React.CSSProperties = { fontSize: 12, color: '#8888aa', lineHeight: 1.6 };

  const linkBtn: React.CSSProperties = {
    display: 'inline-block', marginTop: 'auto', padding: '10px 20px',
    background: 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,100,200,0.4))',
    border: '1px solid rgba(0,200,255,0.6)', borderRadius: 6,
    color: '#00ffff', fontFamily: "'Courier New', monospace",
    fontSize: 13, fontWeight: 600, textDecoration: 'none',
    textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
  };

  const nav: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, paddingTop: 10,
    borderTop: '1px solid rgba(100,200,255,0.2)',
  };

  const navBtn: React.CSSProperties = {
    background: 'rgba(0,50,100,0.5)', border: '1px solid rgba(0,200,255,0.5)',
    color: '#00ffff', padding: '8px 16px', borderRadius: 4,
    cursor: 'pointer', fontSize: 13,
  };

  const pageTxt: React.CSSProperties = { fontSize: 14, color: '#8888aa' };

  const statusBox: React.CSSProperties = {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#666', fontFamily: 'monospace', fontSize: 14,
  };

  return (
    <group ref={groupRef} position={[0, 4, -6]}>
      <Html transform occlude style={{ width: 800, height: 600 }}>
        <div style={panel}>
          {/* Header */}
          <div style={header}>
            <h2 style={heading}>ARCHIVE_DISPLAY</h2>
            <button style={closeBtn} onClick={onClose}>X</button>
          </div>

          {article ? (
            <>
              <div style={content}>
                {/* Image */}
                <div style={imgBox}>
                  {article.image ? (
                    <img
                      key={article.slug}
                      src={article.image}
                      alt={article.title}
                      style={imgStyle}
                      onLoad={() => setImgOk(true)}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ color: '#555' }}>NO VISUAL DATA</span>
                  )}
                </div>

                {/* Info */}
                <div style={info}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: 18 }}>{article.title}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.5, color: '#ccc', margin: 0 }}>
                    {article.description}
                  </p>
                  <div style={meta}>
                    <div>DATE: {article.date}</div>
                    <div>TYPE: {article.articleType.toUpperCase()}</div>
                    {article.horizon && <div>HORIZON: {article.horizon}</div>}
                    {article.polarity && <div>POLARITY: {article.polarity}</div>}
                    <div>READ TIME: {article.readingTime} min</div>
                  </div>
                  <a href={`/articles/${article.slug}`} style={linkBtn}>
                    Read Article &rarr;
                  </a>
                </div>
              </div>

              {/* Navigation */}
              <div style={nav}>
                <button style={navBtn} onClick={prev}>&larr; PREV</button>
                <span style={pageTxt}>{idx + 1} / {total}</span>
                <button style={navBtn} onClick={next}>NEXT &rarr;</button>
              </div>
            </>
          ) : (
            <div style={statusBox}>{status}</div>
          )}
        </div>
      </Html>
    </group>
  );
}
