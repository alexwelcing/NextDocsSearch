/**
 * KNOWLEDGE BASE UI
 *
 * Interface for browsing R3F tech horror knowledge articles
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  R3F_KNOWLEDGE_INDEX,
  R3F_CATEGORIES,
  getTopicsByCategory,
  getTopicsByDifficulty,
  searchTopics,
  type R3FTopic,
} from '../lib/knowledge/r3f-taxonomy';

interface KnowledgeBaseUIProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KnowledgeBaseUI({ isOpen, onClose }: KnowledgeBaseUIProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<R3FTopic['difficulty'] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTopics, setFilteredTopics] = useState<R3FTopic[]>(R3F_KNOWLEDGE_INDEX);
  const [selectedTopic, setSelectedTopic] = useState<R3FTopic | null>(null);

  // Filter topics based on selections
  useEffect(() => {
    let topics = R3F_KNOWLEDGE_INDEX;

    if (searchQuery) {
      topics = searchTopics(searchQuery);
    } else {
      if (selectedCategory) {
        topics = getTopicsByCategory(selectedCategory);
      }
      if (selectedDifficulty) {
        topics = topics.filter(t => t.difficulty === selectedDifficulty);
      }
    }

    setFilteredTopics(topics);
  }, [selectedCategory, selectedDifficulty, searchQuery]);

  if (!isOpen) return null;

  return (
    <Overlay onClick={onClose}>
      <Container onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>
            <Glitch>R3F KNOWLEDGE ARCHIVE</Glitch>
          </Title>
          <Subtitle>Tech Horror Stories from 2045-2055</Subtitle>
          <CloseButton onClick={onClose}>✕</CloseButton>
        </Header>

        {selectedTopic ? (
          <ArticleView topic={selectedTopic} onBack={() => setSelectedTopic(null)} />
        ) : (
          <>
            <Controls>
              <SearchBar
                type="text"
                placeholder="🔍 Search topics, keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <FilterSection>
                <FilterGroup>
                  <FilterLabel>Category:</FilterLabel>
                  <Select
                    value={selectedCategory || ''}
                    onChange={(e) => setSelectedCategory(e.target.value || null)}
                  >
                    <option value="">All Categories</option>
                    {Object.entries(R3F_CATEGORIES).map(([key, value]) => (
                      <option key={key} value={value}>{value}</option>
                    ))}
                  </Select>
                </FilterGroup>

                <FilterGroup>
                  <FilterLabel>Difficulty:</FilterLabel>
                  <Select
                    value={selectedDifficulty || ''}
                    onChange={(e) => setSelectedDifficulty((e.target.value as R3FTopic['difficulty']) || null)}
                  >
                    <option value="">All Levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </Select>
                </FilterGroup>
              </FilterSection>
            </Controls>

            <Stats>
              Showing {filteredTopics.length} of {R3F_KNOWLEDGE_INDEX.length} topics
              {searchQuery && ` matching &ldquo;${searchQuery}&rdquo;`}
            </Stats>

            <TopicGrid>
              {filteredTopics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onClick={() => setSelectedTopic(topic)}
                />
              ))}

              {filteredTopics.length === 0 && (
                <EmptyState>
                  <EmptyIcon>📭</EmptyIcon>
                  <EmptyText>No topics found</EmptyText>
                  <EmptyHint>Try adjusting your filters or search query</EmptyHint>
                </EmptyState>
              )}
            </TopicGrid>

            <Footer>
              <FooterText>
                These stories are works of speculative fiction about legacy systems from 2025.
                <br />
                All technical information is accurate. The horror is real.
              </FooterText>
            </Footer>
          </>
        )}
      </Container>
    </Overlay>
  );
}

/**
 * Topic Card Component
 */
function TopicCard({ topic, onClick }: { topic: R3FTopic; onClick: () => void }) {
  const difficultyColor = {
    beginner: '#4ade80',
    intermediate: '#fbbf24',
    advanced: '#f97316',
    expert: '#ef4444',
  }[topic.difficulty];

  return (
    <Card onClick={onClick}>
      <CardHeader>
        <Category>{topic.category}</Category>
        <SEOBadge>SEO: {topic.seoValue}/10</SEOBadge>
      </CardHeader>

      <CardTitle>{topic.title}</CardTitle>

      <CardSubtitle>{topic.subcategory}</CardSubtitle>

      <CardTags>
        {topic.keywords.slice(0, 3).map((keyword) => (
          <Tag key={keyword}>#{keyword}</Tag>
        ))}
      </CardTags>

      <CardFooter>
        <Difficulty style={{ color: difficultyColor }}>
          {topic.difficulty.toUpperCase()}
        </Difficulty>
        <ViewButton>View Story →</ViewButton>
      </CardFooter>
    </Card>
  );
}

/**
 * Article View Component
 */
function ArticleView({ topic, onBack }: { topic: R3FTopic; onBack: () => void }) {
  return (
    <Article>
      <BackButton onClick={onBack}>← Back to Archive</BackButton>

      <ArticleHeader>
        <ArticleCategory>{topic.category}</ArticleCategory>
        <ArticleTitle>{topic.title}</ArticleTitle>
        <ArticleSubtitle>{topic.subcategory}</ArticleSubtitle>
      </ArticleHeader>

      <ArticleMeta>
        <MetaItem>
          <MetaLabel>Difficulty:</MetaLabel>
          <MetaValue>{topic.difficulty}</MetaValue>
        </MetaItem>
        <MetaItem>
          <MetaLabel>SEO Value:</MetaLabel>
          <MetaValue>{topic.seoValue}/10</MetaValue>
        </MetaItem>
        <MetaItem>
          <MetaLabel>Keywords:</MetaLabel>
          <MetaValue>{topic.keywords.join(', ')}</MetaValue>
        </MetaItem>
      </ArticleMeta>

      <ArticleContent>
        <Notice>
          🎭 <strong>Narrative Mode:</strong> Tech Horror from the Future
        </Notice>

        <p>
          This article will be written as an incident report, maintenance log, or field notes
          from IT professionals in 2045-2055 dealing with legacy {topic.title.toLowerCase()} implementations
          from the &ldquo;Primitive 3D Era&rdquo; of 2025.
        </p>

        <GenerateSection>
          <GenerateTitle>Generate this article:</GenerateTitle>
          <CodeBlock>
            <code>npm run generate:knowledge -- --count 1</code>
          </CodeBlock>
          <GenerateHint>
            Articles are generated as MDX files with full frontmatter, SEO optimization,
            and technical accuracy combined with engaging storytelling.
          </GenerateHint>
        </GenerateSection>

        <TopicDetails>
          <DetailsTitle>Topic Overview:</DetailsTitle>
          <DetailsList>
            <li>
              <strong>Category:</strong> {topic.category}
            </li>
            <li>
              <strong>Subcategory:</strong> {topic.subcategory}
            </li>
            <li>
              <strong>Difficulty Level:</strong> {topic.difficulty}
            </li>
            <li>
              <strong>SEO Value:</strong> {topic.seoValue}/10 - {topic.seoValue >= 8 ? 'High priority for generation' : 'Standard priority'}
            </li>
            <li>
              <strong>Target Keywords:</strong> {topic.keywords.join(', ')}
            </li>
          </DetailsList>
        </TopicDetails>

        <ExampleSection>
          <ExampleTitle>Example Story Elements:</ExampleTitle>
          <ExampleList>
            <li>Setting: Deep Space Station Omega-7 (2048), Lunar Colony IT Department (2047), etc.</li>
            <li>Protagonist: Legacy System Archaeologist, React Fiber Preservation Officer, etc.</li>
            <li>Conflict: Discovering critical flaws in legacy 2025 {topic.title.toLowerCase()} implementations</li>
            <li>Tone: Horror, thriller, dark comedy, or bureaucratic nightmare</li>
            <li>Resolution: Modern best practices and lessons learned for current developers</li>
          </ExampleList>
        </ExampleSection>
      </ArticleContent>
    </Article>
  );
}

// Styled Components

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(10px);
  animation: fadeIn 0.3s ease-out;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

const Container = styled.div`
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
  border: 2px solid #00ffff;
  border-radius: 20px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 0 50px rgba(0, 255, 255, 0.3);
  position: relative;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 12px;
  }

  &::-webkit-scrollbar-track {
    background: #0a0a0a;
  }

  &::-webkit-scrollbar-thumb {
    background: #00ffff;
    border-radius: 6px;
  }
`;

const Header = styled.div`
  padding: 30px;
  border-bottom: 2px solid #00ffff;
  background: linear-gradient(90deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 136, 255, 0.1) 100%);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: bold;
  color: #00ffff;
  margin: 0 0 10px 0;
  text-align: center;
  font-family: 'Courier New', monospace;
  text-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
`;

const Glitch = styled.span`
  @keyframes glitch {
    0%, 100% {
      text-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
    }
    50% {
      text-shadow: -2px 0 20px rgba(255, 0, 255, 0.5), 2px 0 20px rgba(0, 255, 0, 0.5);
    }
  }
  animation: glitch 3s infinite;
`;

const Subtitle = styled.p`
  font-size: 1rem;
  color: #aaa;
  margin: 0;
  text-align: center;
  font-style: italic;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  background: transparent;
  border: 2px solid #ff0055;
  color: #ff0055;
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #ff0055;
    color: white;
    transform: rotate(90deg);
  }
`;

const Controls = styled.div`
  padding: 20px 30px;
  border-bottom: 1px solid #333;
`;

const SearchBar = styled.input`
  width: 100%;
  padding: 15px 20px;
  background: #1a1a2e;
  border: 2px solid #00ffff;
  border-radius: 10px;
  color: white;
  font-size: 1rem;
  margin-bottom: 20px;
  font-family: 'Courier New', monospace;

  &:focus {
    outline: none;
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
  }

  &::placeholder {
    color: #666;
  }
`;

const FilterSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const FilterLabel = styled.label`
  color: #00ffff;
  font-size: 0.9rem;
  margin-bottom: 5px;
  font-weight: bold;
`;

const Select = styled.select`
  padding: 10px 15px;
  background: #1a1a2e;
  border: 2px solid #0088ff;
  border-radius: 8px;
  color: white;
  font-size: 1rem;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #00ffff;
  }

  option {
    background: #1a1a2e;
    color: white;
  }
`;

const Stats = styled.div`
  padding: 15px 30px;
  background: rgba(0, 255, 255, 0.05);
  border-bottom: 1px solid #333;
  color: #00ffff;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
`;

const TopicGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  padding: 30px;
`;

const Card = styled.div`
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 2px solid #0088ff;
  border-radius: 15px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: #00ffff;
    box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
    transform: translateY(-5px);
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
`;

const Category = styled.span`
  font-size: 0.75rem;
  color: #00ffff;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const SEOBadge = styled.span`
  background: linear-gradient(90deg, #ff0055, #ff8800);
  color: white;
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 0.7rem;
  font-weight: bold;
`;

const CardTitle = styled.h3`
  font-size: 1.1rem;
  color: white;
  margin: 0 0 10px 0;
  line-height: 1.4;
`;

const CardSubtitle = styled.p`
  font-size: 0.9rem;
  color: #aaa;
  margin: 0 0 15px 0;
  font-style: italic;
`;

const CardTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 15px;
`;

const Tag = styled.span`
  background: rgba(0, 136, 255, 0.2);
  color: #0088ff;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 0.75rem;
  border: 1px solid #0088ff;
`;

const CardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 15px;
  border-top: 1px solid #333;
`;

const Difficulty = styled.span`
  font-size: 0.8rem;
  font-weight: bold;
`;

const ViewButton = styled.span`
  color: #00ffff;
  font-size: 0.9rem;
  font-weight: bold;
`;

const EmptyState = styled.div`
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
`;

const EmptyIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 20px;
`;

const EmptyText = styled.h3`
  font-size: 1.5rem;
  color: white;
  margin: 0 0 10px 0;
`;

const EmptyHint = styled.p`
  font-size: 1rem;
  color: #aaa;
  margin: 0;
`;

const Footer = styled.div`
  padding: 20px 30px;
  border-top: 2px solid #00ffff;
  background: rgba(0, 255, 255, 0.05);
`;

const FooterText = styled.p`
  font-size: 0.85rem;
  color: #aaa;
  text-align: center;
  margin: 0;
  font-style: italic;
`;

// Article View Styles

const Article = styled.div`
  padding: 30px;
`;

const BackButton = styled.button`
  background: transparent;
  border: 2px solid #00ffff;
  color: #00ffff;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  margin-bottom: 30px;
  transition: all 0.3s ease;

  &:hover {
    background: #00ffff;
    color: black;
  }
`;

const ArticleHeader = styled.div`
  margin-bottom: 30px;
`;

const ArticleCategory = styled.div`
  color: #00ffff;
  font-size: 0.9rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 10px;
`;

const ArticleTitle = styled.h2`
  font-size: 2rem;
  color: white;
  margin: 0 0 10px 0;
  line-height: 1.3;
`;

const ArticleSubtitle = styled.h3`
  font-size: 1.2rem;
  color: #aaa;
  font-weight: normal;
  font-style: italic;
  margin: 0;
`;

const ArticleMeta = styled.div`
  background: rgba(0, 136, 255, 0.1);
  border-left: 4px solid #0088ff;
  padding: 20px;
  margin-bottom: 30px;
  border-radius: 8px;
`;

const MetaItem = styled.div`
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const MetaLabel = styled.span`
  color: #00ffff;
  font-weight: bold;
  margin-right: 10px;
`;

const MetaValue = styled.span`
  color: #aaa;
`;

const ArticleContent = styled.div`
  color: #ddd;
  line-height: 1.8;
  font-size: 1rem;

  p {
    margin-bottom: 20px;
  }
`;

const Notice = styled.div`
  background: rgba(255, 136, 0, 0.1);
  border: 2px solid #ff8800;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  color: #ff8800;
`;

const GenerateSection = styled.div`
  background: rgba(0, 255, 136, 0.05);
  border: 2px solid #00ff88;
  border-radius: 8px;
  padding: 20px;
  margin: 30px 0;
`;

const GenerateTitle = styled.h4`
  color: #00ff88;
  margin: 0 0 15px 0;
  font-size: 1.2rem;
`;

const CodeBlock = styled.pre`
  background: #0a0a0a;
  border: 1px solid #00ff88;
  border-radius: 5px;
  padding: 15px;
  overflow-x: auto;
  margin-bottom: 15px;

  code {
    color: #00ff88;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
  }
`;

const GenerateHint = styled.p`
  color: #aaa;
  font-size: 0.9rem;
  margin: 0;
  font-style: italic;
`;

const TopicDetails = styled.div`
  margin: 30px 0;
`;

const DetailsTitle = styled.h4`
  color: #00ffff;
  margin: 0 0 15px 0;
  font-size: 1.2rem;
`;

const DetailsList = styled.ul`
  list-style: none;
  padding: 0;

  li {
    padding: 10px 0;
    border-bottom: 1px solid #333;

    &:last-child {
      border-bottom: none;
    }

    strong {
      color: #00ffff;
    }
  }
`;

const ExampleSection = styled.div`
  background: rgba(138, 43, 226, 0.1);
  border-left: 4px solid #8a2be2;
  padding: 20px;
  margin: 30px 0;
  border-radius: 8px;
`;

const ExampleTitle = styled.h4`
  color: #8a2be2;
  margin: 0 0 15px 0;
  font-size: 1.2rem;
`;

const ExampleList = styled.ul`
  color: #ddd;
  padding-left: 20px;

  li {
    margin-bottom: 10px;

    &:last-child {
      margin-bottom: 0;
    }
  }
`;
