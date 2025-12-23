import React from 'react';
import Link from 'next/link';
import styled from 'styled-components';

// Time Horizon buckets
export type TimeHorizon = 'NQ' | 'NY' | 'N5' | 'N20' | 'N50' | 'N100';

// Outcome Polarity scale
export type OutcomePolarity = 'C3' | 'C2' | 'C1' | 'N0' | 'P1' | 'P2' | 'P3';

// System Mechanics (recurring themes)
export type SystemMechanic =
  | 'labor-substitution'
  | 'discovery-compression'
  | 'control-governance'
  | 'epistemic-drift'
  | 'scarcity-inversion'
  | 'security-adversarial'
  | 'biological-convergence'
  | 'market-restructuring'
  | 'agency-multiplication'
  | 'alignment-incentives';

interface ArticleClassificationProps {
  horizon?: TimeHorizon;
  polarityRange?: { from: OutcomePolarity; to: OutcomePolarity } | OutcomePolarity;
  mechanics?: SystemMechanic[];
  domains?: string[];
}

const ClassificationContainer = styled.div`
  background: rgba(222, 126, 162, 0.05);
  border: 1px solid rgba(222, 126, 162, 0.2);
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 32px;
  font-size: 0.9rem;
`;

const ClassificationRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const ClassificationLabel = styled.span`
  color: #9ca3af;
  min-width: 100px;
`;

const ClassificationValue = styled.span`
  color: #de7ea2;
  font-weight: 500;
`;

const Tag = styled.span`
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
`;

const HubLink = styled(Link)`
  color: #a5b4fc;
  text-decoration: none;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.1);
  transition: all 0.2s;

  &:hover {
    background: rgba(99, 102, 241, 0.2);
  }
`;

// Helper functions for display
const getHorizonLabel = (horizon: TimeHorizon): string => {
  const labels: Record<TimeHorizon, string> = {
    NQ: 'Next Quarter (0-3 months)',
    NY: 'Next Year (3-12 months)',
    N5: 'Next 5 Years',
    N20: 'Next 20 Years',
    N50: 'Next 50 Years',
    N100: 'Up to 100 Years',
  };
  return labels[horizon];
};

const getPolarityLabel = (polarity: OutcomePolarity): string => {
  const labels: Record<OutcomePolarity, string> = {
    C3: 'Calamity',
    C2: 'Severe',
    C1: 'Negative',
    N0: 'Mixed/Knife-edge',
    P1: 'Positive',
    P2: 'Transformative',
    P3: 'Utopian',
  };
  return labels[polarity];
};

const getMechanicLabel = (mechanic: SystemMechanic): string => {
  const labels: Record<SystemMechanic, string> = {
    'labor-substitution': 'Labor Substitution',
    'discovery-compression': 'Discovery Compression',
    'control-governance': 'Control & Governance',
    'epistemic-drift': 'Epistemic Drift',
    'scarcity-inversion': 'Scarcity Inversion',
    'security-adversarial': 'Security & Adversarial',
    'biological-convergence': 'Biological Convergence',
    'market-restructuring': 'Market Restructuring',
    'agency-multiplication': 'Agency Multiplication',
    'alignment-incentives': 'Alignment by Incentives',
  };
  return labels[mechanic];
};

const getMechanicHub = (mechanic: SystemMechanic): string => {
  const hubs: Record<SystemMechanic, string> = {
    'labor-substitution': '/speculative-ai',
    'discovery-compression': '/emergent-intelligence',
    'control-governance': '/speculative-ai',
    'epistemic-drift': '/speculative-ai',
    'scarcity-inversion': '/speculative-ai',
    'security-adversarial': '/agent-futures',
    'biological-convergence': '/emergent-intelligence',
    'market-restructuring': '/agent-futures',
    'agency-multiplication': '/agent-futures',
    'alignment-incentives': '/speculative-ai',
  };
  return hubs[mechanic];
};

const ArticleClassification: React.FC<ArticleClassificationProps> = ({
  horizon,
  polarityRange,
  mechanics,
  domains,
}) => {
  // Don't render if no classification data
  if (!horizon && !polarityRange && !mechanics?.length && !domains?.length) {
    return null;
  }

  const renderPolarity = () => {
    if (!polarityRange) return null;

    if (typeof polarityRange === 'string') {
      return getPolarityLabel(polarityRange);
    }

    return `${getPolarityLabel(polarityRange.from)} → ${getPolarityLabel(polarityRange.to)}`;
  };

  return (
    <ClassificationContainer>
      {horizon && (
        <ClassificationRow>
          <ClassificationLabel>Horizon:</ClassificationLabel>
          <ClassificationValue>{getHorizonLabel(horizon)}</ClassificationValue>
        </ClassificationRow>
      )}

      {polarityRange && (
        <ClassificationRow>
          <ClassificationLabel>Polarity:</ClassificationLabel>
          <ClassificationValue>{renderPolarity()}</ClassificationValue>
        </ClassificationRow>
      )}

      {mechanics && mechanics.length > 0 && (
        <ClassificationRow>
          <ClassificationLabel>Mechanics:</ClassificationLabel>
          {mechanics.map((mechanic) => (
            <HubLink key={mechanic} href={getMechanicHub(mechanic)}>
              {getMechanicLabel(mechanic)}
            </HubLink>
          ))}
        </ClassificationRow>
      )}

      {domains && domains.length > 0 && (
        <ClassificationRow>
          <ClassificationLabel>Domains:</ClassificationLabel>
          {domains.map((domain) => (
            <Tag key={domain}>{domain}</Tag>
          ))}
        </ClassificationRow>
      )}
    </ClassificationContainer>
  );
};

export default ArticleClassification;

// Helper to extract classification from article slug/title
export const inferClassificationFromSlug = (slug: string): Partial<ArticleClassificationProps> => {
  const classification: Partial<ArticleClassificationProps> = {};

  // Infer time horizon from year in slug
  const yearMatch = slug.match(/20(\d{2})/);
  if (yearMatch) {
    const year = parseInt('20' + yearMatch[1]);
    const yearsFromNow = year - new Date().getFullYear();

    if (yearsFromNow <= 1) classification.horizon = 'NY';
    else if (yearsFromNow <= 5) classification.horizon = 'N5';
    else if (yearsFromNow <= 20) classification.horizon = 'N20';
    else if (yearsFromNow <= 50) classification.horizon = 'N50';
    else classification.horizon = 'N100';
  }

  // Infer polarity from keywords
  const calamityKeywords = ['failure', 'collapse', 'catastrophe', 'crisis', 'malfunction', 'outbreak', 'plague', 'breach'];
  const positiveKeywords = ['breakthrough', 'success', 'harmony', 'utopia', 'solution'];

  const slugLower = slug.toLowerCase();
  if (calamityKeywords.some(kw => slugLower.includes(kw))) {
    classification.polarityRange = 'C1';
  } else if (positiveKeywords.some(kw => slugLower.includes(kw))) {
    classification.polarityRange = 'P1';
  } else {
    classification.polarityRange = 'N0';
  }

  // Infer mechanics from keywords
  const mechanics: SystemMechanic[] = [];
  if (slugLower.includes('autonomous') || slugLower.includes('robot') || slugLower.includes('factory')) {
    mechanics.push('labor-substitution');
  }
  if (slugLower.includes('discovery') || slugLower.includes('quantum') || slugLower.includes('fusion')) {
    mechanics.push('discovery-compression');
  }
  if (slugLower.includes('governance') || slugLower.includes('surveillance') || slugLower.includes('control')) {
    mechanics.push('control-governance');
  }
  if (slugLower.includes('consciousness') || slugLower.includes('neural') || slugLower.includes('brain')) {
    mechanics.push('biological-convergence');
  }
  if (slugLower.includes('agent') || slugLower.includes('swarm') || slugLower.includes('cartel')) {
    mechanics.push('agency-multiplication');
  }
  if (slugLower.includes('alignment') || slugLower.includes('agi')) {
    mechanics.push('alignment-incentives');
  }

  if (mechanics.length > 0) {
    classification.mechanics = mechanics;
  }

  return classification;
};
