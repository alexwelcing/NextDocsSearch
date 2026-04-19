'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import styled, { keyframes, css } from 'styled-components'
import { MessageSquare, User, ArrowRight, X, Send, ExternalLink } from 'lucide-react'
import { SHIP_TRICKS } from '@/lib/ai/shipTricks'
import { SHIP_AI_IDLE_MESSAGE } from '@/lib/hooks/useChat'
import ShipAnswerPanel from '@/components/chat/ShipAnswerPanel'
import StoryCompanionPanel from '@/components/articles/StoryCompanionPanel'
import { buildStoryCompanion } from '@/lib/articles/storyCompanion'
import { useSupabaseData } from './contexts/SupabaseDataContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExpandedPanel = 'none' | 'chat' | 'about'

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0); }
  50% { box-shadow: 0 0 20px 2px rgba(0, 212, 255, 0.15); }
`

const typeFlicker = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const PanelsWrapper = styled.section`
  width: 100vw;
  margin-left: calc(-50vw + 50%);
  padding: 48px clamp(24px, 5vw, 80px) 56px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(
      90deg,
      rgba(0, 212, 255, 0.4),
      rgba(255, 215, 0, 0.3),
      rgba(0, 212, 255, 0.4)
    );
  }
`

const SectionLabel = styled.span`
  display: block;
  font-size: 0.65rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: rgba(0, 212, 255, 0.5);
  margin-bottom: 20px;
`

const PanelGrid = styled.div<{ $expanded: ExpandedPanel }>`
  display: grid;
  gap: 20px;
  transition: grid-template-columns 0.5s cubic-bezier(0.4, 0, 0.2, 1);

  ${(p) =>
    p.$expanded === 'none' &&
    css`
      grid-template-columns: 1fr 1fr;
    `}
  ${(p) =>
    p.$expanded === 'chat' &&
    css`
      grid-template-columns: 1fr 0fr;
    `}
  ${(p) =>
    p.$expanded === 'about' &&
    css`
      grid-template-columns: 0fr 1fr;
    `}

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

// ---------------------------------------------------------------------------
// Panel card (collapsed state)
// ---------------------------------------------------------------------------

const PanelCard = styled.div<{ $hidden?: boolean; $active?: boolean }>`
  position: relative;
  background: rgba(10, 10, 26, 0.6);
  border: 2px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  cursor: pointer;
  min-height: 220px;
  transition: border-color 0.3s, transform 0.3s, opacity 0.4s, min-width 0.5s;
  animation: ${fadeIn} 0.4s ease both;

  ${(p) =>
    p.$hidden &&
    css`
      opacity: 0;
      pointer-events: none;
      min-width: 0;
      min-height: 0;
      padding: 0;
      border-width: 0;
      overflow: hidden;
    `}

  ${(p) =>
    p.$active &&
    css`
      animation: ${pulseGlow} 2.5s ease-in-out infinite;
    `}

  &:hover {
    border-color: rgba(0, 212, 255, 0.35);
    transform: translateY(-2px);
  }

  @media (max-width: 768px) {
    min-height: unset;

    ${(p) =>
      p.$hidden &&
      css`
        display: none;
      `}
  }
`

const PanelPreview = styled.div`
  padding: 36px 32px;

  @media (max-width: 768px) {
    padding: 24px 16px;
  }
`

const PanelIcon = styled.div<{ $color: string }>`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border: 2px solid ${(p) => p.$color};
  background: ${(p) => p.$color}10;

  svg {
    width: 22px;
    height: 22px;
    color: ${(p) => p.$color};
  }
`

const PanelTitle = styled.h4`
  font-size: 1.1rem;
  font-weight: 800;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 0 0 8px;
`

const PanelDesc = styled.p`
  font-size: 0.85rem;
  color: #9ca3af;
  line-height: 1.5;
  margin: 0 0 16px;
`

const PanelCta = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${(p) => p.$color};

  svg {
    width: 14px;
    height: 14px;
    transition: transform 0.2s;
  }

  ${PanelCard}:hover & svg {
    transform: translateX(3px);
  }
`

// ---------------------------------------------------------------------------
// Expanded panel wrapper
// ---------------------------------------------------------------------------

const ExpandedContent = styled.div`
  padding: 36px 40px;
  animation: ${fadeIn} 0.35s ease both;

  @media (max-width: 768px) {
    padding: 24px 16px;
  }
`

const ExpandedHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`

const CollapseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    border-color: rgba(0, 212, 255, 0.3);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`

// ---------------------------------------------------------------------------
// Chat panel styles
// ---------------------------------------------------------------------------

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const ChatMessages = styled.div`
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 16px;
  min-height: 180px;
  max-height: 300px;
  overflow-y: auto;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  font-size: 0.85rem;
  line-height: 1.65;

  scrollbar-width: thin;
  scrollbar-color: rgba(0, 212, 255, 0.2) transparent;
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 212, 255, 0.2);
  }
`

const ChatBubble = styled.div<{ $role: 'user' | 'ai' }>`
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }

  ${(p) =>
    p.$role === 'user' &&
    css`
      color: rgba(0, 212, 255, 0.9);
    `}
  ${(p) =>
    p.$role === 'ai' &&
    css`
      color: #d4d4d4;
    `}
`

const BubbleLabel = styled.span<{ $role: 'user' | 'ai' }>`
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  display: block;
  margin-bottom: 4px;

  ${(p) =>
    p.$role === 'user' &&
    css`
      color: rgba(0, 212, 255, 0.5);
    `}
  ${(p) =>
    p.$role === 'ai' &&
    css`
      color: rgba(255, 215, 0, 0.5);
    `}
`

const Cursor = styled.span`
  display: inline-block;
  width: 7px;
  height: 14px;
  background: rgba(0, 212, 255, 0.7);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: ${typeFlicker} 0.8s step-end infinite;
`

const ChatInputRow = styled.div`
  display: flex;
  gap: 8px;
`

const ChatInput = styled.input`
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 212, 255, 0.15);
  padding: 12px 14px;
  color: #e0e0e0;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;

  &::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  &:focus {
    border-color: rgba(0, 212, 255, 0.4);
  }
`

const ChatSendBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 18px;
  background: rgba(0, 212, 255, 0.12);
  border: 1px solid rgba(0, 212, 255, 0.3);
  color: var(--color-cyan-accent, #00d4ff);
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(0, 212, 255, 0.2);
    border-color: rgba(0, 212, 255, 0.6);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`

const QuickPrompts = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

const QuickPrompt = styled.button`
  padding: 6px 12px;
  background: rgba(0, 212, 255, 0.04);
  border: 1px solid rgba(0, 212, 255, 0.12);
  color: rgba(0, 212, 255, 0.6);
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.3);
    color: rgba(0, 212, 255, 0.9);
  }
`

// ---------------------------------------------------------------------------
// About panel styles
// ---------------------------------------------------------------------------

const AboutGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`

const AboutCard = styled.div`
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 20px;
`

const AboutLabel = styled.span`
  display: block;
  font-size: 0.6rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: rgba(255, 215, 0, 0.5);
  margin-bottom: 10px;
`

const AboutName = styled.h3`
  font-size: 1.4rem;
  font-weight: 800;
  color: #ffffff;
  margin: 0 0 4px;
  text-transform: uppercase;
  letter-spacing: -0.01em;
`

const AboutRole = styled.p`
  font-size: 0.85rem;
  color: rgba(0, 212, 255, 0.7);
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  margin: 0 0 16px;
`

const AboutBio = styled.p`
  font-size: 0.88rem;
  color: #9ca3af;
  line-height: 1.7;
  margin: 0;
`

const SkillTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

const SkillTag = styled.span`
  padding: 4px 10px;
  font-size: 0.7rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  background: rgba(0, 212, 255, 0.06);
  border: 1px solid rgba(0, 212, 255, 0.12);
  color: rgba(0, 212, 255, 0.7);
  letter-spacing: 0.02em;
`

const AboutLinks = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 16px;
`

const AboutLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 0.75rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-decoration: none;
  color: rgba(255, 215, 0, 0.7);
  border: 1px solid rgba(255, 215, 0, 0.15);
  background: rgba(255, 215, 0, 0.04);
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 215, 0, 0.1);
    border-color: rgba(255, 215, 0, 0.3);
    color: var(--color-gold-highlight, #ffd700);
  }

  svg {
    width: 12px;
    height: 12px;
  }
`

const AboutPageLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 18px;
  font-size: 0.75rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-decoration: none;
  color: var(--color-cyan-accent, #00d4ff);
  border: 1px solid rgba(0, 212, 255, 0.2);
  background: rgba(0, 212, 255, 0.05);
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 212, 255, 0.12);
    border-color: rgba(0, 212, 255, 0.5);
  }

  svg {
    width: 14px;
    height: 14px;
    transition: transform 0.2s;
  }

  &:hover svg {
    transform: translateX(3px);
  }
`

// ---------------------------------------------------------------------------
// Quick prompt suggestions
// ---------------------------------------------------------------------------

const QUICK_PROMPTS = SHIP_TRICKS.slice(0, 4).map((trick) => trick.example)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ArticleFooterPanels({
  articleTitle,
  articleSlug,
  articleType,
  articleDescription,
  articleKeywords,
  articleContent,
}: {
  articleTitle?: string
  articleSlug?: string
  articleType?: 'fiction' | 'research'
  articleDescription?: string
  articleKeywords?: string[]
  articleContent?: string
}) {
  const [expanded, setExpanded] = useState<ExpandedPanel>('none')
  const [chatInput, setChatInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { chatData, sendMessage } = useSupabaseData()
  const storyCompanion = React.useMemo(() => {
    if (articleType !== 'fiction' || !articleTitle) {
      return null
    }

    return buildStoryCompanion({
      title: articleTitle,
      description: articleDescription,
      keywords: articleKeywords,
      content: articleContent,
    })
  }, [articleContent, articleDescription, articleKeywords, articleTitle, articleType])

  const hasConversation =
    chatData.status !== 'idle' ||
    chatData.instantResults.length > 0 ||
    (chatData.response && chatData.response !== SHIP_AI_IDLE_MESSAGE)

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [chatData.response, chatData.instantResults.length, chatData.structuredAnswer])

  // Focus input when chat expands
  useEffect(() => {
    if (expanded === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 350)
    }
  }, [expanded])

  const handleSend = useCallback(async () => {
    const msg = chatInput.trim()
    if (!msg || isStreaming) return
    setChatInput('')
    setIsStreaming(true)
    try {
      await sendMessage(msg, {
        articleContext: articleTitle
          ? {
              slug: articleSlug,
              title: articleTitle,
              articleType,
              description: articleDescription,
              keywords: articleKeywords,
              content: articleContent,
            }
          : undefined,
      })
    } finally {
      setIsStreaming(false)
    }
  }, [articleContent, articleDescription, articleKeywords, articleSlug, articleTitle, articleType, chatInput, isStreaming, sendMessage])

  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      setChatInput('')
      setIsStreaming(true)
      sendMessage(prompt, {
        articleContext: articleTitle
          ? {
              slug: articleSlug,
              title: articleTitle,
              articleType,
              description: articleDescription,
              keywords: articleKeywords,
              content: articleContent,
            }
          : undefined,
      }).finally(() => setIsStreaming(false))
    },
    [articleContent, articleDescription, articleKeywords, articleSlug, articleTitle, articleType, sendMessage],
  )

  const collapse = useCallback(() => setExpanded('none'), [])

  return (
    <PanelsWrapper>
      <SectionLabel>{'// Continue the conversation'}</SectionLabel>

      <PanelGrid $expanded={expanded}>
        {/* ---- CHAT PANEL ---- */}
        <PanelCard
          $hidden={expanded === 'about'}
          $active={expanded === 'chat'}
          onClick={expanded === 'none' ? () => setExpanded('chat') : undefined}
          style={expanded === 'chat' ? { cursor: 'default' } : undefined}
        >
          {expanded === 'chat' ? (
            <ExpandedContent onClick={(e) => e.stopPropagation()}>
              <ExpandedHeader>
                <PanelTitle style={{ margin: 0 }}>
                  <MessageSquare
                    size={18}
                    style={{ verticalAlign: '-3px', marginRight: 8, color: '#00d4ff' }}
                  />
                  Ask Ship AI
                </PanelTitle>
                <CollapseBtn onClick={collapse} aria-label="Collapse chat panel">
                  <X />
                </CollapseBtn>
              </ExpandedHeader>

              <ChatContainer>
                {storyCompanion && (
                  <StoryCompanionPanel
                    data={storyCompanion}
                    onPromptSelect={handleQuickPrompt}
                    disabled={isStreaming}
                  />
                )}

                <ChatMessages ref={messagesRef}>
                  {hasConversation ? (
                    <>
                      <ChatBubble $role="user">
                        <BubbleLabel $role="user">you</BubbleLabel>
                        {chatData.question}
                      </ChatBubble>
                      <ChatBubble $role="ai">
                        <BubbleLabel $role="ai">ship ai</BubbleLabel>
                        <ShipAnswerPanel chatData={chatData} density="compact" showQuestion={false} />
                        {isStreaming && <Cursor />}
                      </ChatBubble>
                    </>
                  ) : (
                    <ChatBubble $role="ai">
                      <BubbleLabel $role="ai">ship ai</BubbleLabel>
                      Ship AI online. Ask about Alex&apos;s work, this article
                      {articleTitle ? ` ("${articleTitle}")` : ''}, or use a trick like /story, /brief, /map, /roast, or /mission.
                    </ChatBubble>
                  )}
                </ChatMessages>

                <ChatInputRow>
                  <ChatInput
                    ref={inputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask anything..."
                    disabled={isStreaming}
                  />
                  <ChatSendBtn onClick={handleSend} disabled={isStreaming || !chatInput.trim()}>
                    <Send />
                    Send
                  </ChatSendBtn>
                </ChatInputRow>

                {!hasConversation && !storyCompanion && (
                  <QuickPrompts>
                    {QUICK_PROMPTS.map((prompt) => (
                      <QuickPrompt
                        key={prompt}
                        onClick={() => handleQuickPrompt(prompt)}
                        disabled={isStreaming}
                      >
                        {prompt}
                      </QuickPrompt>
                    ))}
                  </QuickPrompts>
                )}
              </ChatContainer>
            </ExpandedContent>
          ) : (
            <PanelPreview>
              <PanelIcon $color="rgba(0, 212, 255, 0.7)">
                <MessageSquare />
              </PanelIcon>
              <PanelTitle>Ask Ship AI</PanelTitle>
              <PanelDesc>
                {articleType === 'fiction'
                  ? 'Turn this story into a systems map, sequel hook, alternate path, or worldbuilding pressure test.'
                  : 'Chat with the AI that powers this site. Ask about this article, Alex\'s work, or anything that sparks your curiosity.'}
              </PanelDesc>
              <PanelCta $color="rgba(0, 212, 255, 0.8)">
                {articleType === 'fiction' ? 'Open story mode' : 'Start a conversation'} <ArrowRight />
              </PanelCta>
            </PanelPreview>
          )}
        </PanelCard>

        {/* ---- ABOUT PANEL ---- */}
        <PanelCard
          $hidden={expanded === 'chat'}
          $active={expanded === 'about'}
          onClick={expanded === 'none' ? () => setExpanded('about') : undefined}
          style={expanded === 'about' ? { cursor: 'default' } : undefined}
        >
          {expanded === 'about' ? (
            <ExpandedContent onClick={(e) => e.stopPropagation()}>
              <ExpandedHeader>
                <PanelTitle style={{ margin: 0 }}>
                  <User
                    size={18}
                    style={{ verticalAlign: '-3px', marginRight: 8, color: '#ffd700' }}
                  />
                  About Alex
                </PanelTitle>
                <CollapseBtn onClick={collapse} aria-label="Collapse about panel">
                  <X />
                </CollapseBtn>
              </ExpandedHeader>

              <AboutGrid>
                <AboutCard>
                  <AboutLabel>{'// Who'}</AboutLabel>
                  <AboutName>Alex Welcing</AboutName>
                  <AboutRole>AI Product Expert &middot; New York</AboutRole>
                  <AboutBio>
                    AI Product Expert with 10+ years building intelligent systems.
                    Specialized in LLMs, agent architectures, RAG pipelines, and platform
                    technologies across SaaS, legal, and healthcare.
                  </AboutBio>
                  <AboutLinks>
                    <AboutLink
                      href="https://linkedin.com/in/alexwelcing"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      LinkedIn <ExternalLink />
                    </AboutLink>
                    <AboutLink
                      href="https://github.com/alexwelcing"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      GitHub <ExternalLink />
                    </AboutLink>
                  </AboutLinks>
                </AboutCard>

                <AboutCard>
                  <AboutLabel>{'// Skills & tools'}</AboutLabel>
                  <SkillTags>
                    {[
                      'LLMs',
                      'Agent Systems',
                      'RAG Pipelines',
                      'React',
                      'TypeScript',
                      'Next.js',
                      'Three.js',
                      'Product Strategy',
                      'API Design',
                      'Vector Search',
                    ].map((skill) => (
                      <SkillTag key={skill}>{skill}</SkillTag>
                    ))}
                  </SkillTags>

                  <AboutPageLink href="/about">
                    Full resume &amp; experience <ArrowRight />
                  </AboutPageLink>
                </AboutCard>
              </AboutGrid>
            </ExpandedContent>
          ) : (
            <PanelPreview>
              <PanelIcon $color="rgba(255, 215, 0, 0.7)">
                <User />
              </PanelIcon>
              <PanelTitle>About Alex</PanelTitle>
              <PanelDesc>
                AI Product Expert building at the intersection of LLMs, agent architectures, and
                modern web technologies.
              </PanelDesc>
              <PanelCta $color="rgba(255, 215, 0, 0.8)">
                Learn more <ArrowRight />
              </PanelCta>
            </PanelPreview>
          )}
        </PanelCard>
      </PanelGrid>
    </PanelsWrapper>
  )
}
