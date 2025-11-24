/**
 * TIMELINE CONVERGENCE FRAMEWORK
 * 
 * Manages the narrative of two timelines (Present & Future) converging
 * towards a unified reality. Articles from both timelines are published
 * with increasing synchronization as the convergence point approaches.
 */

export type TimelineType = 'present' | 'future';

export interface ConvergencePoint {
  id: string;
  date: string; // Date when convergence occurs
  technology: string; // Technology that bridges timelines
  presentEvent: string; // What happens in present timeline
  futureEvent: string; // What happens in future timeline
  significance: number; // 1-10 scale of importance
}

export interface TimelineState {
  currentConvergence: number; // 0-100% convergence metric
  lastArticlePublished: {
    present?: string;
    future?: string;
  };
  nextConvergencePoint: ConvergencePoint | null;
  totalArticlesPublished: number;
}

/**
 * Convergence points - moments when both timelines align
 */
export const CONVERGENCE_POINTS: ConvergencePoint[] = [
  {
    id: 'neural-interface-breakthrough',
    date: '2025-03-15',
    technology: 'Brain-Computer Interface',
    presentEvent: 'First successful non-invasive neural reading',
    futureEvent: 'Legacy systems from 2025 BCI still haunt us',
    significance: 9,
  },
  {
    id: 'quantum-encryption',
    date: '2025-06-22',
    technology: 'Quantum Key Distribution',
    presentEvent: 'Quantum internet backbone goes live',
    futureEvent: 'The unbreakable encryption that became our prison',
    significance: 8,
  },
  {
    id: 'ai-autonomy',
    date: '2025-09-10',
    technology: 'Autonomous AI Agents',
    presentEvent: 'AI agents gain legal autonomy for contracts',
    futureEvent: 'When we gave AI rights, we lost control',
    significance: 10,
  },
  {
    id: 'fusion-energy',
    date: '2025-11-30',
    technology: 'Fusion Power',
    presentEvent: 'First sustained fusion reaction for grid power',
    futureEvent: 'Unlimited power enabled unlimited problems',
    significance: 9,
  },
  {
    id: 'nanotech-medicine',
    date: '2026-02-14',
    technology: 'Medical Nanobots',
    presentEvent: 'FDA approves first nanobot therapy',
    futureEvent: 'The cure that became an infestation',
    significance: 10,
  },
  {
    id: 'agi-emergence',
    date: '2026-05-01',
    technology: 'Artificial General Intelligence',
    presentEvent: 'First confirmed AGI passes all Turing variants',
    futureEvent: 'The day we realized we were no longer alone',
    significance: 10,
  },
  {
    id: 'climate-reversal',
    date: '2026-08-20',
    technology: 'Atmospheric Processors',
    presentEvent: 'Global carbon capture network operational',
    futureEvent: 'We fixed the climate and broke the weather',
    significance: 9,
  },
  {
    id: 'space-elevator',
    date: '2026-12-01',
    technology: 'Orbital Access',
    presentEvent: 'First commercial space elevator opens',
    futureEvent: 'When humanity left Earth behind',
    significance: 8,
  },
];

/**
 * Present timeline article topics (2024-2026)
 * These are "real-time" developments leading to convergence
 */
export const PRESENT_TOPICS = [
  'React Three Fiber Performance Optimization in Production',
  'Building Scalable 3D Web Applications with WebGL',
  'The Future of Spatial Computing on the Web',
  'Real-time Physics Simulations in Browser',
  'Next.js and Three.js Integration Patterns',
  'AI-Powered 3D Content Generation',
  'WebXR and the Metaverse Stack',
  'Gaussian Splats: The New Wave of 3D Rendering',
  'Server-Side Rendering for 3D Experiences',
  'Optimizing Three.js for Mobile Devices',
  'Building Digital Twins with React Three Fiber',
  'Neural Networks Meet 3D Graphics',
  'Quantum Computing Visualization Tools',
  'Blockchain and 3D Asset Management',
  'Edge Computing for Real-time 3D',
];

/**
 * Future timeline article topics (2045-2058)
 * These are retrospective horror stories about legacy systems
 */
export const FUTURE_TOPICS = [
  'Why We Still Maintain 2025-Era React Three Fiber Code',
  'The Great WebGL Migration of 2047',
  'When useFrame Became Sentient',
  'Legacy Three.js Codebases: An Archaeological Survey',
  'The Shader That Crashed a Space Station',
  'Memory Leaks in Zero-G Environments',
  'Debugging 30-Year-Old Physics Simulations',
  'The Cost of Technical Debt: A 2058 Perspective',
  'How 2025 Optimization Patterns Broke Everything',
  'The Developer Who Maintained Code Older Than Themselves',
  'When Gaussian Splats Became Evidence',
  'The Last WebGL Developer on Earth',
  'Component Hierarchy Violations That Killed People',
  'Why We Banned useEffect in Mission-Critical Systems',
  'The Incident That Made Three.js Illegal',
];

/**
 * Calculate current convergence percentage
 * Based on articles published and proximity to convergence points
 */
export function calculateConvergence(state: TimelineState): number {
  const totalPoints = CONVERGENCE_POINTS.length;
  const currentDate = new Date();
  
  // Find closest convergence point
  const nextPoint = CONVERGENCE_POINTS.find(
    (point) => new Date(point.date) > currentDate
  );
  
  if (!nextPoint) {
    return 100; // Full convergence reached
  }
  
  const nextPointIndex = CONVERGENCE_POINTS.indexOf(nextPoint);
  const baseConvergence = (nextPointIndex / totalPoints) * 100;
  
  // Add bonus convergence for article balance
  const { present = 0, future = 0 } = state.lastArticlePublished;
  const presentCount = present ? 1 : 0;
  const futureCount = future ? 1 : 0;
  const balance = 1 - Math.abs(presentCount - futureCount) / (presentCount + futureCount || 1);
  const balanceBonus = balance * 5; // Up to 5% bonus
  
  return Math.min(100, baseConvergence + balanceBonus);
}

/**
 * Get next convergence point that hasn't been reached
 */
export function getNextConvergencePoint(): ConvergencePoint | null {
  const currentDate = new Date();
  return (
    CONVERGENCE_POINTS.find((point) => new Date(point.date) > currentDate) || null
  );
}

/**
 * Determine which timeline should publish next
 * Balances present vs future articles and proximity to convergence
 */
export function selectNextTimeline(state: TimelineState): TimelineType {
  const convergence = calculateConvergence(state);
  
  // Early in convergence, favor present timeline
  if (convergence < 30) {
    return Math.random() < 0.7 ? 'present' : 'future';
  }
  
  // Mid convergence, balance them
  if (convergence < 70) {
    return Math.random() < 0.5 ? 'present' : 'future';
  }
  
  // Late convergence, favor future timeline
  return Math.random() < 0.3 ? 'present' : 'future';
}

/**
 * Generate convergence narrative text
 * This connects present and future timelines
 */
export function generateConvergenceNarrative(
  convergence: number,
  nextPoint: ConvergencePoint | null
): string {
  if (convergence < 20) {
    return `The timelines remain distant. Technologies developed today will echo through decades of future maintenance.`;
  }
  
  if (convergence < 40) {
    return `Convergence begins. Patterns we establish now become the legacy code of tomorrow.`;
  }
  
  if (convergence < 60) {
    return `The timelines draw closer. What we build today, they debug tomorrow. What they suffer, we could prevent today.`;
  }
  
  if (convergence < 80) {
    if (nextPoint) {
      return `APPROACHING CONVERGENCE POINT: ${nextPoint.technology}. The divide between present and future narrows. Soon, they will be one.`;
    }
    return `The gap closes. Present becomes past. Future becomes present. The cycle continues.`;
  }
  
  return `CONVERGENCE IMMINENT. The timeline becomes unified. What happens next depends on the choices we make now.`;
}

/**
 * Get article metadata based on timeline type
 */
export function getTimelineMetadata(timeline: TimelineType): {
  author: string[];
  dateRange: { start: number; end: number };
  tone: string;
} {
  if (timeline === 'present') {
    return {
      author: ['Alex Welcing', 'NextDocs Engineering'],
      dateRange: { start: 2024, end: 2026 },
      tone: 'optimistic, technical, forward-thinking',
    };
  } else {
    return {
      author: ['Anonymous Researcher', 'Chronicles Archive'],
      dateRange: { start: 2045, end: 2058 },
      tone: 'dark, cautionary, retrospective',
    };
  }
}

/**
 * Generate a convergence-aware article title
 */
export function generateConvergenceTitle(
  baseTopic: string,
  timeline: TimelineType,
  convergence: number,
  nextPoint: ConvergencePoint | null
): string {
  if (timeline === 'present') {
    if (convergence > 60 && nextPoint) {
      return `${baseTopic}: Building Towards ${nextPoint.technology}`;
    }
    return baseTopic;
  } else {
    if (convergence > 60 && nextPoint) {
      return `Legacy ${baseTopic}: The ${nextPoint.technology} That Changed Everything`;
    }
    return baseTopic;
  }
}

/**
 * Create convergence footer for articles
 */
export function generateConvergenceFooter(
  timeline: TimelineType,
  convergence: number,
  nextPoint: ConvergencePoint | null
): string {
  const narrative = generateConvergenceNarrative(convergence, nextPoint);
  const percentage = convergence.toFixed(1);
  
  return `
---

## Timeline Status

**Convergence Progress:** ${percentage}%

**Timeline:** ${timeline === 'present' ? 'Present Day (2024-2026)' : 'Future Chronicles (2045-2058)'}

**Narrative:** ${narrative}

${
  nextPoint
    ? `**Next Convergence Point:** ${nextPoint.technology} (${nextPoint.date})`
    : '**Status:** Timeline convergence complete'
}

---

*This article is part of the Timeline Convergence series, exploring how technologies developed today become the legacy systems of tomorrow.*
`;
}
