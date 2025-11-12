import React, { useState, useEffect, useRef } from 'react';
import { useCompletion } from 'ai/react';

interface NavalInterfaceProps {
  onResponse?: (question: string, response: string) => void;
}

export default function NavalInterface({ onResponse }: NavalInterfaceProps) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Array<{ type: 'command' | 'response', text: string, timestamp: string }>>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  const { complete, completion, isLoading } = useCompletion({
    api: '/api/vector-search',
  });

  useEffect(() => {
    if (completion && !isLoading) {
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
      setHistory(prev => [
        ...prev,
        { type: 'response', text: completion, timestamp }
      ]);
      onResponse?.(question, completion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completion, isLoading]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setHistory(prev => [
      ...prev,
      { type: 'command', text: question, timestamp }
    ]);

    await complete(question);
    setQuestion('');
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, #0a1a0a 0%, #0a0f0a 100%)',
      border: '3px solid #00ff88',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Courier New", monospace',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Scanline effect overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'repeating-linear-gradient(0deg, rgba(0, 255, 136, 0.03) 0px, transparent 2px)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* Header */}
      <div style={{
        padding: '12px 20px',
        background: '#001100',
        borderBottom: '2px solid #00ff88',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#00ff88',
            boxShadow: '0 0 10px #00ff88',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ color: '#00ff88', fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px' }}>
            NAVAL TERMINAL • MK-IV
          </span>
        </div>
        <div style={{
          color: '#00aa66',
          fontSize: '12px',
          fontFamily: 'monospace',
        }}>
          {new Date().toLocaleTimeString('en-US', { hour12: false })}
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          overflowX: 'hidden',
          color: '#00ff88',
          fontSize: '13px',
          lineHeight: '1.6',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Boot message */}
        {history.length === 0 && (
          <div style={{ color: '#00aa66', marginBottom: '20px' }}>
            <div>╔═══════════════════════════════════════╗</div>
            <div>║   NAVAL INTELLIGENCE SYSTEM v4.2.1   ║</div>
            <div>║   READY FOR INPUT                     ║</div>
            <div>╚═══════════════════════════════════════╝</div>
            <div style={{ marginTop: '10px', fontSize: '11px' }}>
              &gt; System initialized<br />
              &gt; Encryption: AES-256<br />
              &gt; Status: OPERATIONAL<br />
              <br />
              Enter query to begin...
            </div>
          </div>
        )}

        {/* History */}
        {history.map((entry, i) => (
          <div key={i} style={{ marginBottom: '16px' }}>
            {entry.type === 'command' ? (
              <div>
                <div style={{ color: '#00ff88', marginBottom: '4px' }}>
                  <span style={{ color: '#00aa66' }}>[{entry.timestamp}]</span> CMD&gt; {entry.text}
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(0, 255, 136, 0.05)',
                border: '1px solid rgba(0, 255, 136, 0.3)',
                borderLeft: '3px solid #00ff88',
                padding: '12px',
                borderRadius: '4px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                <div style={{ color: '#00aa66', fontSize: '11px', marginBottom: '8px' }}>
                  [{entry.timestamp}] RESPONSE:
                </div>
                <div style={{ color: '#00ff88' }}>
                  {entry.text}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#00aa66',
            fontSize: '12px',
          }}>
            <div className="loading-dots" style={{ display: 'flex', gap: '4px' }}>
              <span style={{ animation: 'blink 1.4s infinite both', animationDelay: '0s' }}>●</span>
              <span style={{ animation: 'blink 1.4s infinite both', animationDelay: '0.2s' }}>●</span>
              <span style={{ animation: 'blink 1.4s infinite both', animationDelay: '0.4s' }}>●</span>
            </div>
            PROCESSING QUERY
          </div>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} style={{
        padding: '16px 20px',
        background: '#001100',
        borderTop: '2px solid #00ff88',
        display: 'flex',
        gap: '12px',
      }}>
        <div style={{
          color: '#00ff88',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
        }}>
          &gt;
        </div>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isLoading}
          placeholder="Enter query..."
          autoFocus
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#00ff88',
            fontSize: '14px',
            fontFamily: '"Courier New", monospace',
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !question.trim()}
          style={{
            background: isLoading ? '#003300' : '#00ff88',
            color: isLoading ? '#00aa66' : '#000000',
            border: 'none',
            padding: '6px 20px',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            letterSpacing: '1px',
            fontFamily: '"Courier New", monospace',
            transition: 'all 0.2s',
          }}
        >
          {isLoading ? 'PROCESSING' : 'SEND'}
        </button>
      </form>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @keyframes blink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }

        /* Custom scrollbar */
        div::-webkit-scrollbar {
          width: 8px;
        }

        div::-webkit-scrollbar-track {
          background: #001100;
        }

        div::-webkit-scrollbar-thumb {
          background: #00ff88;
          border-radius: 4px;
        }

        div::-webkit-scrollbar-thumb:hover {
          background: #00aa66;
        }
      `}</style>
    </div>
  );
}
