import React, { useCallback, useState } from 'react';
import { trackEvent } from '@/lib/analytics/trackEvent';

interface FeedbackPanelProps {
  isMobile?: boolean;
}

export default function FeedbackPanel({ isMobile = false }: FeedbackPanelProps) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sent'>('idle');

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;

    trackEvent('feedback_submit', {
      messageLength: trimmed.length,
      source: 'terminal',
    });
    setMessage('');
    setStatus('sent');
    setTimeout(() => setStatus('idle'), 2000);
  }, [message]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      trackEvent('share', { method: 'copy_link', location: url });
    } catch (error) {
      console.error('Failed to copy link:', error);
      trackEvent('share', { method: 'copy_failed', location: url });
    }
  }, []);

  return (
    <div
      style={{
        background: '#111',
        borderRadius: '8px',
        padding: isMobile ? '16px' : '20px',
      }}
    >
      <div style={{ color: '#0f0', fontSize: '12px', marginBottom: '12px', fontFamily: 'monospace' }}>
        FEEDBACK
      </div>
      <div style={{ color: '#666', fontSize: '12px', marginBottom: '12px', fontFamily: 'monospace' }}>
        Tell us what you want to see next.
      </div>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Share feedback, bugs, or ideas..."
        rows={isMobile ? 4 : 3}
        style={{
          width: '100%',
          background: '#0a0a0a',
          border: '1px solid #222',
          borderRadius: '6px',
          padding: '10px',
          color: '#fff',
          fontSize: '12px',
          fontFamily: 'monospace',
          resize: 'vertical',
          marginBottom: '12px',
        }}
      />
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={handleSubmit}
          disabled={!message.trim()}
          style={{
            background: message.trim() ? '#0f0' : '#1a1a1a',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            color: message.trim() ? '#000' : '#555',
            fontWeight: 'bold',
            fontSize: '12px',
            cursor: message.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'monospace',
          }}
        >
          {status === 'sent' ? 'SENT' : 'SEND FEEDBACK'}
        </button>
        <button
          onClick={handleShare}
          style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '6px',
            padding: '8px 14px',
            color: '#999',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          COPY SHARE LINK
        </button>
      </div>
    </div>
  );
}
