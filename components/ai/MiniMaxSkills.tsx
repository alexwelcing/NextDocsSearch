/**
 * MiniMax AI Skills Integration
 * Content generation and media creation using MiniMax AI
 */

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Wand2, Image, Video, Music, FileText, Loader2 } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type SkillType = 'image' | 'video' | 'audio' | 'text' | 'shader';

interface GeneratedContent {
  id: string;
  type: SkillType;
  prompt: string;
  url?: string;
  content?: string;
  timestamp: Date;
}

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const Container = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
`;

const Title = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SkillGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
`;

const SkillButton = styled.button<{ $active?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: ${(props) => props.$active ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'};
  border: 1px solid ${(props) => props.$active ? 'rgba(0, 212, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
  border-radius: 8px;
  color: ${(props) => props.$active ? '#00d4ff' : 'rgba(255, 255, 255, 0.7)'};
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.3);
  }
`;

const PromptInput = styled.textarea`
  width: 100%;
  min-height: 100px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  color: white;
  font-size: 0.875rem;
  resize: vertical;
  margin-bottom: 16px;
  
  &:focus {
    outline: none;
    border-color: rgba(0, 212, 255, 0.5);
  }
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
`;

const GenerateButton = styled.button<{ $loading?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: ${(props) => props.$loading ? 'rgba(255, 255, 255, 0.1)' : 'linear-gradient(135deg, #00d4ff, #0099cc)'};
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  cursor: ${(props) => props.$loading ? 'not-allowed' : 'pointer'};
  opacity: ${(props) => props.$loading ? 0.7 : 1};
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }
`;

const ResultsContainer = styled.div`
  margin-top: 24px;
  display: grid;
  gap: 16px;
`;

const ResultCard = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
`;

const ResultHeader = styled.div`
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ResultType = styled.span`
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #00d4ff;
`;

const ResultTime = styled.span`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
`;

const ResultContent = styled.div`
  padding: 16px;
`;

const ResultPrompt = styled.p`
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 12px;
  font-style: italic;
`;

const GeneratedImage = styled.img`
  width: 100%;
  border-radius: 4px;
`;

const GeneratedText = styled.pre`
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.8);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
`;

// =============================================================================
// MOCK GENERATION (placeholder for actual API integration)
// =============================================================================

const mockGenerate = async (type: SkillType, prompt: string): Promise<string> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1500));
  
  switch (type) {
    case 'image':
      return `https://picsum.photos/seed/${Date.now()}/512/512`;
    case 'text':
      return `Generated content for: "${prompt}"\n\nThis is a placeholder for AI-generated content. In production, this would connect to the MiniMax API to generate text based on your prompt.`;
    case 'shader':
      return `// GLSL Shader
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 color = vec3(uv, 0.5);
  gl_FragColor = vec4(color, 1.0);
}`;
    default:
      return 'Generated content placeholder';
  }
};

// =============================================================================
// COMPONENT
// =============================================================================

export const MiniMaxSkills: React.FC = () => {
  const [activeSkill, setActiveSkill] = useState<SkillType>('image');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedContent[]>([]);
  
  const skills: { type: SkillType; label: string; icon: React.ReactNode }[] = [
    { type: 'image', label: 'Image', icon: <Image size={24} /> },
    { type: 'video', label: 'Video', icon: <Video size={24} /> },
    { type: 'audio', label: 'Audio', icon: <Music size={24} /> },
    { type: 'text', label: 'Text', icon: <FileText size={24} /> },
    { type: 'shader', label: 'Shader', icon: <Wand2 size={24} /> },
  ];
  
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    
    setIsGenerating(true);
    
    try {
      const result = await mockGenerate(activeSkill, prompt);
      
      const newContent: GeneratedContent = {
        id: Date.now().toString(),
        type: activeSkill,
        prompt: prompt,
        url: activeSkill === 'image' ? result : undefined,
        content: activeSkill !== 'image' ? result : undefined,
        timestamp: new Date(),
      };
      
      setResults((prev) => [newContent, ...prev]);
      setPrompt('');
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [activeSkill, prompt, isGenerating]);
  
  const getPlaceholder = (type: SkillType) => {
    switch (type) {
      case 'image':
        return 'Describe the image you want to generate...';
      case 'video':
        return 'Describe the video scene...';
      case 'audio':
        return 'Describe the sound or music...';
      case 'text':
        return 'Enter your writing prompt...';
      case 'shader':
        return 'Describe the visual effect...';
      default:
        return 'Enter your prompt...';
    }
  };
  
  return (
    <Container>
      <Title>
        <Wand2 size={20} />
        MiniMax AI Skills
      </Title>
      
      <SkillGrid>
        {skills.map((skill) => (
          <SkillButton
            key={skill.type}
            $active={activeSkill === skill.type}
            onClick={() => setActiveSkill(skill.type)}
          >
            {skill.icon}
            <span style={{ fontSize: '0.75rem' }}>{skill.label}</span>
          </SkillButton>
        ))}
      </SkillGrid>
      
      <PromptInput
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={getPlaceholder(activeSkill)}
      />
      
      <GenerateButton 
        onClick={handleGenerate} 
        disabled={!prompt.trim() || isGenerating}
        $loading={isGenerating}
      >
        {isGenerating ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 size={18} />
            Generate {activeSkill.charAt(0).toUpperCase() + activeSkill.slice(1)}
          </>
        )}
      </GenerateButton>
      
      {results.length > 0 && (
        <ResultsContainer>
          {results.map((result) => (
            <ResultCard key={result.id}>
              <ResultHeader>
                <ResultType>{result.type}</ResultType>
                <ResultTime>
                  {result.timestamp.toLocaleTimeString()}
                </ResultTime>
              </ResultHeader>
              <ResultContent>
                <ResultPrompt>&ldquo;{result.prompt}&rdquo;</ResultPrompt>
                {result.type === 'image' && result.url && (
                  <GeneratedImage src={result.url} alt={result.prompt || 'Generated image'} />
                )}
                {result.content && (
                  <GeneratedText>{result.content}</GeneratedText>
                )}
              </ResultContent>
            </ResultCard>
          ))}
        </ResultsContainer>
      )}
    </Container>
  );
};

export default MiniMaxSkills;
