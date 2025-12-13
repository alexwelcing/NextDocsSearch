/**
 * IdeaContent - Spatial content display
 *
 * Renders engaged content in 3D space:
 * - Article reader (curved surface)
 * - Chat interface (floating dialogue)
 * - Quiz cards (floating cards)
 * - Creation interface (sculpting space)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbContent, OrbContentType } from './types';
import { ORB_COLORS } from './types';

interface IdeaContentProps {
  content: OrbContent | null;
  position?: [number, number, number];
  onClose?: () => void;
  onAction?: (action: string, data?: unknown) => void;
}

export default function IdeaContent({
  content,
  position = [0, 2, 3],
  onClose,
  onAction,
}: IdeaContentProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [isVisible, setIsVisible] = useState(false);
  const scaleRef = useRef(0);

  // Animate in/out
  useEffect(() => {
    if (content) {
      setIsVisible(true);
    } else {
      const timeout = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [content]);

  // Animation
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const targetScale = content ? 1 : 0;
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, 0.15);
    groupRef.current.scale.setScalar(scaleRef.current);
  });

  if (!isVisible) return null;

  const color = content ? ORB_COLORS[content.type] || ORB_COLORS.active : '#ffffff';

  return (
    <group ref={groupRef} position={position}>
      {/* Backdrop panel */}
      <RoundedBox args={[4, 3, 0.1]} radius={0.1}>
        <meshStandardMaterial
          color="#0a0a1a"
          metalness={0.9}
          roughness={0.2}
          transparent
          opacity={0.95}
        />
      </RoundedBox>

      {/* Border glow */}
      <RoundedBox args={[4.1, 3.1, 0.05]} radius={0.1} position={[0, 0, -0.05]}>
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </RoundedBox>

      {/* Content based on type */}
      {content && (
        <group position={[0, 0, 0.1]}>
          {content.type === 'article' && (
            <ArticleView
              content={content}
              onClose={onClose}
              onAction={onAction}
            />
          )}

          {content.type === 'chat' && (
            <ChatView
              content={content}
              onClose={onClose}
              onAction={onAction}
            />
          )}

          {content.type === 'quiz' && (
            <QuizView
              content={content}
              onClose={onClose}
              onAction={onAction}
            />
          )}

          {content.type === 'mystery' && (
            <MysteryView
              content={content}
              onClose={onClose}
            />
          )}
        </group>
      )}

      {/* Close button */}
      <Html position={[1.8, 1.3, 0.1]}>
        <button
          onClick={onClose}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: `1px solid ${color}`,
            background: 'rgba(0,0,0,0.8)',
            color: color,
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'monospace',
          }}
        >
          x
        </button>
      </Html>
    </group>
  );
}

/**
 * Article content view
 */
function ArticleView({
  content,
  onClose,
  onAction,
}: {
  content: OrbContent;
  onClose?: () => void;
  onAction?: (action: string, data?: unknown) => void;
}) {
  return (
    <Html center transform distanceFactor={5}>
      <div
        style={{
          width: '320px',
          maxHeight: '240px',
          overflow: 'auto',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h3
          style={{
            color: ORB_COLORS.article,
            margin: '0 0 12px 0',
            fontSize: '16px',
          }}
        >
          {content.title || 'Untitled'}
        </h3>
        <p
          style={{
            fontSize: '13px',
            lineHeight: '1.6',
            opacity: 0.9,
            margin: 0,
          }}
        >
          {content.preview || 'Explore this idea to learn more...'}
        </p>
        <button
          onClick={() => onAction?.('read', content.data)}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            background: `linear-gradient(135deg, ${ORB_COLORS.article}, #44ffaa)`,
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          Read Full Article
        </button>
      </div>
    </Html>
  );
}

/**
 * Chat content view
 */
function ChatView({
  content,
  onClose,
  onAction,
}: {
  content: OrbContent;
  onClose?: () => void;
  onAction?: (action: string, data?: unknown) => void;
}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: 'user', text: input }]);
    onAction?.('ask', input);
    setInput('');
    // Simulate response
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: 'I am thinking about your question...' },
      ]);
    }, 500);
  }, [input, onAction]);

  return (
    <Html center transform distanceFactor={5}>
      <div
        style={{
          width: '320px',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h3
          style={{
            color: ORB_COLORS.chat,
            margin: '0 0 12px 0',
            fontSize: '14px',
          }}
        >
          Ask the Oracle
        </h3>

        {/* Messages */}
        <div
          style={{
            maxHeight: '120px',
            overflow: 'auto',
            marginBottom: '12px',
            fontSize: '12px',
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                marginBottom: '8px',
                padding: '6px 10px',
                background: m.role === 'user' ? 'rgba(68,136,255,0.2)' : 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
              }}
            >
              {m.text}
            </div>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="What do you seek?"
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.1)',
              border: `1px solid ${ORB_COLORS.chat}`,
              borderRadius: '6px',
              color: 'white',
              fontSize: '12px',
              outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            style={{
              padding: '8px 16px',
              background: ORB_COLORS.chat,
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '12px',
            }}
          >
            Ask
          </button>
        </div>
      </div>
    </Html>
  );
}

/**
 * Quiz content view
 */
function QuizView({
  content,
  onClose,
  onAction,
}: {
  content: OrbContent;
  onClose?: () => void;
  onAction?: (action: string, data?: unknown) => void;
}) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // Mock quiz question
  const question = {
    text: 'What is the primary benefit of using React Three Fiber?',
    options: [
      'Faster than vanilla Three.js',
      'Declarative 3D with React patterns',
      'Automatic optimization',
      'Built-in physics',
    ],
    correct: 1,
  };

  const handleAnswer = (index: number) => {
    setSelectedAnswer(index);
    onAction?.('answer', { index, correct: index === question.correct });
  };

  return (
    <Html center transform distanceFactor={5}>
      <div
        style={{
          width: '320px',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h3
          style={{
            color: ORB_COLORS.quiz,
            margin: '0 0 16px 0',
            fontSize: '14px',
          }}
        >
          Knowledge Challenge
        </h3>

        <p style={{ fontSize: '13px', marginBottom: '16px' }}>{question.text}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {question.options.map((option, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={selectedAnswer !== null}
              style={{
                padding: '10px 14px',
                background:
                  selectedAnswer === i
                    ? i === question.correct
                      ? 'rgba(68,255,136,0.3)'
                      : 'rgba(255,68,68,0.3)'
                    : 'rgba(255,255,255,0.1)',
                border: `1px solid ${
                  selectedAnswer === i
                    ? i === question.correct
                      ? '#44ff88'
                      : '#ff4444'
                    : 'rgba(255,255,255,0.2)'
                }`,
                borderRadius: '6px',
                color: 'white',
                cursor: selectedAnswer === null ? 'pointer' : 'default',
                fontSize: '12px',
                textAlign: 'left',
              }}
            >
              {option}
            </button>
          ))}
        </div>

        {selectedAnswer !== null && (
          <button
            onClick={() => onAction?.('nextQuestion')}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: ORB_COLORS.quiz,
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '12px',
            }}
          >
            Next Question
          </button>
        )}
      </div>
    </Html>
  );
}

/**
 * Mystery/rare content view
 */
function MysteryView({
  content,
  onClose,
}: {
  content: OrbContent;
  onClose?: () => void;
}) {
  return (
    <Html center transform distanceFactor={5}>
      <div
        style={{
          width: '280px',
          textAlign: 'center',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: '48px',
            marginBottom: '16px',
          }}
        >
          ✨
        </div>
        <h3
          style={{
            color: ORB_COLORS.mystery,
            margin: '0 0 12px 0',
            fontSize: '18px',
          }}
        >
          Rare Discovery!
        </h3>
        <p
          style={{
            fontSize: '13px',
            opacity: 0.9,
            lineHeight: '1.6',
          }}
        >
          You&apos;ve uncovered something special. This idea holds deeper meaning...
        </p>
      </div>
    </Html>
  );
}
