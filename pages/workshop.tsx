/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODERN WORKSHOP PAGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Interactive 3D mind map visualization of AI Development resources.
 * Explore the landscape through an immersive cosmic interface.
 */

import React, { useState, useCallback, useMemo, Suspense } from 'react';
import Head from 'next/head';
import { Canvas } from '@react-three/fiber';
import styled from 'styled-components';

import { WorkshopProvider, useWorkshop } from '@/components/WorkshopProvider';
import MindMapUniverse from '@/components/3d/experiences/MindMapUniverse';
import type { WorkshopResource, MindMapCategory } from '@/types/workshop';

// ═══════════════════════════════════════════════════════════════════════════
// STYLED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const PageContainer = styled.div`
  width: 100vw;
  height: 100vh;
  background: #0a0a1a;
  position: relative;
  overflow: hidden;
`;

const CanvasContainer = styled.div`
  position: absolute;
  inset: 0;
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
`;

const Header = styled.header`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(to bottom, rgba(10, 10, 26, 0.95), transparent);
  pointer-events: auto;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: #e0e0ff;
  margin: 0;

  span {
    color: #ffd700;
  }
`;

const Subtitle = styled.p`
  font-size: 0.875rem;
  color: #8888aa;
  margin: 0.25rem 0 0;
`;

const ViewToggle = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ViewButton = styled.button<{ $active?: boolean }>`
  background: ${p => (p.$active ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)')};
  border: 1px solid ${p => (p.$active ? '#ffd700' : 'rgba(255, 255, 255, 0.1)')};
  color: ${p => (p.$active ? '#ffd700' : '#8888aa')};
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 215, 0, 0.1);
    border-color: #ffd700;
    color: #ffd700;
  }
`;

const SidePanel = styled.aside<{ $visible: boolean }>`
  position: absolute;
  top: 5rem;
  right: 1rem;
  bottom: 1rem;
  width: 380px;
  background: rgba(10, 10, 26, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
  overflow: hidden;
  pointer-events: auto;
  transform: translateX(${p => (p.$visible ? '0' : 'calc(100% + 2rem)')});
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;
`;

const PanelHeader = styled.div`
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PanelTitle = styled.h2`
  font-size: 1rem;
  font-weight: 600;
  color: #e0e0ff;
  margin: 0;
`;

const CloseButton = styled.button`
  background: transparent;
  border: none;
  color: #8888aa;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1.25rem;

  &:hover {
    color: #e0e0ff;
  }
`;

const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
`;

const CategoryPath = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const PathSegment = styled.span`
  color: #8888aa;
  font-size: 0.75rem;

  &::after {
    content: ' → ';
    color: rgba(255, 255, 255, 0.3);
  }

  &:last-child {
    color: #ffd700;
    &::after {
      content: '';
    }
  }
`;

const Description = styled.p`
  color: #aaaacc;
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0 0 1.5rem;
`;

const ResourceList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const ResourceCard = styled.a`
  display: block;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.75rem;
  padding: 1rem;
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 215, 0, 0.05);
    border-color: rgba(255, 215, 0, 0.3);
    transform: translateY(-2px);
  }
`;

const ResourceTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 500;
  color: #e0e0ff;
  margin: 0 0 0.5rem;
  line-height: 1.4;
`;

const ResourceMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ResourceSource = styled.span`
  font-size: 0.75rem;
  color: #6b7280;
`;

const ResourceType = styled.span<{ $type: string }>`
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  background: ${p => {
    switch (p.$type) {
      case 'video':
        return 'rgba(248, 113, 113, 0.2)';
      case 'pdf':
        return 'rgba(52, 211, 153, 0.2)';
      case 'report':
        return 'rgba(167, 139, 250, 0.2)';
      default:
        return 'rgba(96, 165, 250, 0.2)';
    }
  }};
  color: ${p => {
    switch (p.$type) {
      case 'video':
        return '#f87171';
      case 'pdf':
        return '#34d399';
      case 'report':
        return '#a78bfa';
      default:
        return '#60a5fa';
    }
  }};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: #8888aa;
`;

const Instructions = styled.div`
  position: absolute;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(10, 10, 26, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  padding: 0.75rem 1.5rem;
  pointer-events: auto;
  display: flex;
  gap: 2rem;
`;

const Instruction = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #8888aa;

  kbd {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.25rem;
    padding: 0.15rem 0.4rem;
    font-family: inherit;
    color: #e0e0ff;
  }
`;

const Stats = styled.div`
  position: absolute;
  bottom: 1.5rem;
  left: 1.5rem;
  background: rgba(10, 10, 26, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  pointer-events: auto;
`;

const StatItem = styled.div`
  font-size: 0.75rem;
  color: #8888aa;

  strong {
    color: #ffd700;
    font-weight: 600;
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 26, 0.95);
  z-index: 100;
`;

const LoadingText = styled.div`
  color: #e0e0ff;
  font-size: 1.25rem;
  animation: pulse 2s ease-in-out infinite;

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// WORKSHOP CONTENT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function WorkshopContent() {
  const {
    state,
    selectCategory,
    toggleCategoryExpand,
    selectResource,
    setHoveredCategory,
    setHoveredResource,
    resourcesInCategory,
    getCategoryPath,
  } = useWorkshop();

  const [showPanel, setShowPanel] = useState(true);

  // Get selected category info
  const selectedCategory = state.selectedCategoryId
    ? state.mindMap.categories[state.selectedCategoryId]
    : null;

  // Get resources for selected category
  const categoryResources = useMemo(() => {
    if (!state.selectedCategoryId) return [];
    return resourcesInCategory(state.selectedCategoryId, true);
  }, [state.selectedCategoryId, resourcesInCategory]);

  // Category path for breadcrumb
  const categoryPath = useMemo(() => {
    if (!state.selectedCategoryId) return [];
    return getCategoryPath(state.selectedCategoryId);
  }, [state.selectedCategoryId, getCategoryPath]);

  // Total stats
  const totalResources = Object.keys(state.resources).length;
  const totalCategories = Object.keys(state.mindMap.categories).length;

  const handleCategorySelect = useCallback(
    (categoryId: string) => {
      selectCategory(categoryId);
      setShowPanel(true);
    },
    [selectCategory]
  );

  const handleCategoryExpand = useCallback(
    (categoryId: string) => {
      toggleCategoryExpand(categoryId);
    },
    [toggleCategoryExpand]
  );

  return (
    <>
      {/* 3D Canvas */}
      <CanvasContainer>
        <Canvas
          camera={{ position: [0, 15, 30], fov: 60 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <MindMapUniverse
              categories={state.mindMap.categories}
              resources={Object.values(state.resources)}
              expandedCategories={state.expandedCategories}
              selectedCategoryId={state.selectedCategoryId}
              selectedResourceId={state.selectedResourceId}
              hoveredCategoryId={state.hoveredCategoryId}
              resourceCounts={state.resourceCounts}
              quality="high"
              onCategorySelect={handleCategorySelect}
              onCategoryExpand={handleCategoryExpand}
              onCategoryHover={setHoveredCategory}
              onResourceSelect={selectResource}
              onResourceHover={setHoveredResource}
            />
          </Suspense>
        </Canvas>
      </CanvasContainer>

      {/* UI Overlay */}
      <Overlay>
        <Header>
          <div>
            <Title>
              Modern <span>Workshop</span>
            </Title>
            <Subtitle>AI Development Landscape 2025-2026</Subtitle>
          </div>
          <ViewToggle>
            <ViewButton $active={showPanel} onClick={() => setShowPanel(!showPanel)}>
              {showPanel ? 'Hide Panel' : 'Show Panel'}
            </ViewButton>
          </ViewToggle>
        </Header>

        {/* Side Panel */}
        <SidePanel $visible={showPanel && !!selectedCategory}>
          {selectedCategory && (
            <>
              <PanelHeader>
                <PanelTitle>{selectedCategory.name}</PanelTitle>
                <CloseButton onClick={() => selectCategory(null)}>×</CloseButton>
              </PanelHeader>
              <PanelContent>
                {/* Breadcrumb */}
                <CategoryPath>
                  {categoryPath.map(cat => (
                    <PathSegment key={cat.id}>{cat.name}</PathSegment>
                  ))}
                </CategoryPath>

                {/* Description */}
                <Description>{selectedCategory.description}</Description>

                {/* Resources */}
                {categoryResources.length > 0 ? (
                  <ResourceList>
                    {categoryResources.map(resource => (
                      <ResourceCard
                        key={resource.id}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ResourceTitle>{resource.title}</ResourceTitle>
                        <ResourceMeta>
                          <ResourceType $type={resource.type}>{resource.type}</ResourceType>
                          <ResourceSource>{resource.source}</ResourceSource>
                        </ResourceMeta>
                      </ResourceCard>
                    ))}
                  </ResourceList>
                ) : (
                  <EmptyState>
                    No resources in this category yet.
                    <br />
                    Expand subcategories to explore deeper.
                  </EmptyState>
                )}
              </PanelContent>
            </>
          )}
        </SidePanel>

        {/* Instructions */}
        <Instructions>
          <Instruction>
            <kbd>Click</kbd> Select category
          </Instruction>
          <Instruction>
            <kbd>Double-click</kbd> Expand/collapse
          </Instruction>
          <Instruction>
            <kbd>Drag</kbd> Rotate view
          </Instruction>
          <Instruction>
            <kbd>Scroll</kbd> Zoom
          </Instruction>
        </Instructions>

        {/* Stats */}
        <Stats>
          <StatItem>
            <strong>{totalResources}</strong> resources across{' '}
            <strong>{totalCategories}</strong> categories
          </StatItem>
        </Stats>
      </Overlay>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function WorkshopPage() {
  return (
    <>
      <Head>
        <title>Modern Workshop | AI Development Landscape</title>
        <meta
          name="description"
          content="Explore the AI Development Landscape 2025-2026 through an immersive 3D mind map. Discover tools, frameworks, and resources organized into an explorable knowledge universe."
        />
        <meta property="og:title" content="Modern Workshop | AI Development Landscape" />
        <meta
          property="og:description"
          content="Interactive 3D visualization of AI coding assistants, infrastructure, hardware, and development frameworks."
        />
      </Head>

      <PageContainer>
        <WorkshopProvider>
          <WorkshopContent />
        </WorkshopProvider>
      </PageContainer>
    </>
  );
}
