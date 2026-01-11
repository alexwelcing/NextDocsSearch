'use client';

import React, { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Maximize2, X, Copy, Check } from 'lucide-react';

const noteAppear = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px) rotate(-0.5deg);
  }
  to {
    opacity: 1;
    transform: translateY(0) rotate(0);
  }
`;

const paperRustle = keyframes`
  0%, 100% { transform: rotate(-0.3deg); }
  50% { transform: rotate(0.3deg); }
`;

const NoteWrapper = styled.div<{ $expanded: boolean }>`
  position: relative;
  margin: 2.5rem 0;
  animation: ${noteAppear} 0.5s ease-out;

  ${props => props.$expanded && css`
    position: fixed;
    inset: 0;
    z-index: 10000;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    padding: 20px;
  `}
`;

const NoteContainer = styled.div<{ $expanded: boolean }>`
  position: relative;
  background: linear-gradient(
    135deg,
    #fefae0 0%,
    #fffbeb 50%,
    #fef3c7 100%
  );
  border-radius: 4px;
  padding: ${props => props.$expanded ? '40px' : '28px 24px 24px 28px'};
  box-shadow:
    2px 4px 16px rgba(0, 0, 0, 0.15),
    inset 0 0 60px rgba(255, 250, 230, 0.3);
  transform: rotate(-0.3deg);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: ${props => props.$expanded ? 'default' : 'pointer'};
  max-width: ${props => props.$expanded ? '900px' : '100%'};
  width: ${props => props.$expanded ? '90vw' : 'auto'};
  max-height: ${props => props.$expanded ? '85vh' : 'none'};
  overflow-y: ${props => props.$expanded ? 'auto' : 'visible'};
  overflow-x: hidden;

  /* Paper texture */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      repeating-linear-gradient(
        transparent 0px,
        transparent 27px,
        rgba(99, 102, 241, 0.08) 28px
      );
    pointer-events: none;
    border-radius: 4px;
  }

  /* Red margin line */
  &::after {
    content: '';
    position: absolute;
    left: 40px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: rgba(239, 68, 68, 0.25);
  }

  /* Tape pieces */
  &:not([data-expanded="true"])::before {
    content: '';
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%) rotate(2deg);
    width: 60px;
    height: 24px;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    z-index: 1;
  }

  &:hover {
    transform: ${props => props.$expanded ? 'none' : 'rotate(0deg) scale(1.01)'};
    box-shadow:
      4px 8px 24px rgba(0, 0, 0, 0.2),
      inset 0 0 60px rgba(255, 250, 230, 0.3);
  }

  @media (max-width: 768px) {
    padding: ${props => props.$expanded ? '24px' : '20px 16px 16px 20px'};
    width: ${props => props.$expanded ? '95vw' : 'auto'};
  }
`;

const NoteContent = styled.pre<{ $expanded: boolean }>`
  font-family: 'Caveat', 'Patrick Hand', 'Segoe Script', 'Comic Sans MS', cursive;
  font-size: ${props => props.$expanded ? '1.3rem' : '1.1rem'};
  line-height: 1.8;
  color: #1e293b;
  margin: 0;
  padding-left: 30px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  overflow-x: visible;
  letter-spacing: 0.5px;
  position: relative;

  /* Remove default code styling */
  code {
    font-family: inherit;
    background: none;
    padding: 0;
    font-size: inherit;
  }

  @media (max-width: 768px) {
    font-size: ${props => props.$expanded ? '1.1rem' : '1rem'};
    padding-left: 20px;
  }
`;

const NoteHeader = styled.div<{ $expanded: boolean }>`
  position: absolute;
  top: ${props => props.$expanded ? '12px' : '8px'};
  right: ${props => props.$expanded ? '12px' : '8px'};
  display: flex;
  gap: 8px;
  z-index: 10;
`;

const IconButton = styled.button<{ $variant?: 'close' | 'action' }>`
  background: ${props => props.$variant === 'close'
    ? 'rgba(239, 68, 68, 0.1)'
    : 'rgba(99, 102, 241, 0.1)'};
  border: none;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  color: ${props => props.$variant === 'close' ? '#ef4444' : '#6366f1'};
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${props => props.$variant === 'close'
      ? 'rgba(239, 68, 68, 0.2)'
      : 'rgba(99, 102, 241, 0.2)'};
    transform: scale(1.1);
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const HintText = styled.span`
  position: absolute;
  bottom: 8px;
  right: 12px;
  font-size: 0.7rem;
  color: #94a3b8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-style: italic;
  opacity: 0;
  transition: opacity 0.2s;

  ${NoteContainer}:hover & {
    opacity: 1;
  }
`;

const CornerFold = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 24px;
  height: 24px;
  background: linear-gradient(
    135deg,
    transparent 50%,
    rgba(0, 0, 0, 0.05) 50%,
    rgba(0, 0, 0, 0.08) 100%
  );
  border-radius: 0 0 4px 0;
`;

interface HandwrittenNoteProps {
  children: React.ReactNode;
}

export default function HandwrittenNote({ children }: HandwrittenNoteProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
    document.body.style.overflow = 'hidden';
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(false);
    document.body.style.overflow = '';
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let text = '';

    if (typeof children === 'string') {
      text = children;
    } else if (React.isValidElement(children)) {
      const element = children as React.ReactElement<{ children?: React.ReactNode }>;
      text = String(element.props?.children || '');
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleWrapperClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      document.body.style.overflow = 'hidden';
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && isExpanded) {
      setIsExpanded(false);
      document.body.style.overflow = '';
    }
  };

  return (
    <NoteWrapper $expanded={isExpanded} onClick={handleBackdropClick}>
      <NoteContainer
        $expanded={isExpanded}
        onClick={isExpanded ? undefined : handleWrapperClick}
        data-expanded={isExpanded}
      >
        <NoteHeader $expanded={isExpanded}>
          <IconButton onClick={handleCopy} title="Copy content">
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </IconButton>
          {isExpanded ? (
            <IconButton $variant="close" onClick={handleClose} title="Close">
              <X size={18} />
            </IconButton>
          ) : (
            <IconButton onClick={handleExpand} title="Expand to examine">
              <Maximize2 size={18} />
            </IconButton>
          )}
        </NoteHeader>

        <NoteContent $expanded={isExpanded}>
          {children}
        </NoteContent>

        {!isExpanded && (
          <>
            <HintText>Click to examine closely</HintText>
            <CornerFold />
          </>
        )}
      </NoteContainer>
    </NoteWrapper>
  );
}
