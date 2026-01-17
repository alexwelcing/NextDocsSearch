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
import Generated3DObject from '../Generated3DObject';
import { generateFromPrompt } from '@/lib/generators/sceneComposer';
import { ParsedPrompt } from '@/lib/generators/types';
import { getRandomTemplate } from '@/lib/creation-templates';
import Terminal3D from './Terminal3D';

import { useCompletion } from 'ai/react';
import { useRouter } from 'next/router';
import { X, Loader, User, Frown, CornerDownLeft, Search, Wand, ArrowLeftCircle } from 'lucide-react';

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

          {content.type === 'creation' && (
            <CreationView
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
  
  const { complete, completion, isLoading, error } = useCompletion({
    api: '/api/vector-search',
  });

  // Update messages when completion arrives
  useEffect(() => {
    if (completion && !isLoading) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', text: completion }];
        }
        return [...prev, { role: 'assistant', text: completion }];
      });
    }
  }, [completion, isLoading]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input;
    setMessages((m) => [...m, { role: 'user', text: userMessage }]);
    setInput('');
    onAction?.('ask', userMessage);
    
    try {
      await complete(userMessage);
    } catch (err) {
      console.error('Chat error:', err);
    }
  }, [input, isLoading, complete, onAction]);

  // Derive display state for Terminal3D
  // We show the latest completion if loading, or the last assistant message
  // If loading and no completion yet, text is empty (Terminal handles this with status)
  
  const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user');
  
  // If we are loading, we might be streaming. 'completion' holds the stream.
  // If not loading, we use the last assistant message from history.
  let displayText = '';
  if (isLoading) {
    displayText = completion;
  } else {
    const lastAssistant = messages.slice().reverse().find(m => m.role === 'assistant');
    displayText = lastAssistant?.text || 'Greetings. I am the Oracle. Ask me anything about this world.';
  }

  return (
    <group>
        {/* 3D Terminal Output */}
        <Terminal3D 
            text={displayText} 
            isLoading={isLoading} 
            prompt={lastUserMessage?.text} 
        />

        {/* Floating Input Control */}
        <Html position={[0, -1.2, 0.1]} center transform distanceFactor={5}>
        <div
            style={{
            width: '400px',
            display: 'flex',
            gap: '8px',
            padding: '12px',
            background: 'rgba(0, 10, 20, 0.8)',
            border: `1px solid ${ORB_COLORS.chat}`,
            borderRadius: '12px',
            backdropFilter: 'blur(8px)',
            boxShadow: `0 0 20px ${ORB_COLORS.chat}40`,
            }}
        >
            <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Enter command / query..."
            disabled={isLoading}
            autoFocus
            style={{
                flex: 1,
                padding: '10px 14px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#aaffff',
                fontFamily: 'monospace',
                fontSize: '14px',
                outline: 'none',
                opacity: isLoading ? 0.5 : 1,
            }}
            />
            <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{
                padding: '10px 20px',
                background: ORB_COLORS.chat,
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                fontSize: '14px',
                opacity: (isLoading || !input.trim()) ? 0.5 : 1,
                textTransform: 'uppercase',
                letterSpacing: '1px',
            }}
            >
            {isLoading ? '...' : 'SEND'}
            </button>
        </div>
        {error && (
            <div style={{ 
                position: 'absolute', 
                bottom: '-24px', 
                left: '0', 
                width: '100%', 
                textAlign: 'center', 
                color: '#ff4444', 
                fontSize: '10px', 
                fontFamily: 'monospace' 
            }}>
            [ERROR: CONNECTION INTERRUPTED]
            </div>
        )}
        </Html>
    </group>
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
 * Creation content view
 */
function CreationView({
  content,
  onClose,
  onAction,
}: {
  content: OrbContent;
  onClose?: () => void;
  onAction?: (action: string, data?: unknown) => void;
}) {
  const router = useRouter();

  const handleEnterStudio = () => {
    onAction?.('enter_studio');
    router.push('/studio');
  };

  return (
    <Html position={[-1, 0, 0.2]} center transform distanceFactor={5}>
        <div
          style={{
            width: '220px',
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
            background: 'rgba(0,0,0,0.8)',
            padding: '20px',
            borderRadius: '12px',
            border: `1px solid ${ORB_COLORS.creation}`,
            textAlign: 'center',
          }}
        >
          <h3
            style={{
              color: ORB_COLORS.creation,
              margin: '0 0 12px 0',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            Creation Studio
          </h3>

          <p style={{ fontSize: '12px', color: '#ccc', marginBottom: '16px' }}>
            Enter the Super Studio to manifest your imagination into 2D and 3D realities.
          </p>

          <button
            onClick={handleEnterStudio}
            style={{
              width: '100%',
              padding: '10px',
              background: `linear-gradient(45deg, ${ORB_COLORS.creation}, #ff00ff)`,
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            Enter Studio
          </button>
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
