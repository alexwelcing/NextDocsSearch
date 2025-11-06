/**
 * FUTURE TECH HORROR NARRATIVE FRAMEWORK
 *
 * Stories from IT departments in 2045-2055 dealing with legacy systems
 * built during the "Primitive 3D Era" of 2025.
 *
 * Think: "Alien" meets "The Office" meets "IT Crowd" in the future
 */

export interface NarrativeTemplate {
  id: string;
  name: string;
  tone: 'horror' | 'thriller' | 'dark-comedy' | 'noir' | 'bureaucratic-nightmare';
  setting: string;
  protagonistRole: string;
  conflict: string;
  exampleOpening: string;
}

export const NARRATIVE_SETTINGS = [
  'Deep Space Station Omega-7 (2048)',
  'Subterranean Corporate Vault #443 (2052)',
  'The Last Terrestrial Data Center (2051)',
  'Neo-Tokyo Municipal Services Bureau (2049)',
  'Lunar Colony IT Department (2047)',
  'Arctic Preservation Facility (2053)',
  'Offshore Digital Preservation Rig (2050)',
  'Underground Legacy System Archive (2054)',
  'Mars Settlement Technical Services (2055)',
  'The Abandoned Cloud District (2046)',
] as const;

export const PROTAGONIST_ROLES = [
  'Legacy System Archaeologist',
  'Senior JavaScript Necromancer',
  'WebGL Forensics Specialist',
  'React Fiber Preservation Officer',
  'Three.js Historical Reconstructionist',
  'Frontend Framework Curator',
  '3D Rendering Compliance Auditor',
  'Technical Debt Recovery Agent',
  'Digital Artifact Restoration Technician',
  'Museum of Obsolete Patterns Curator',
] as const;

export const NARRATIVE_TEMPLATES: NarrativeTemplate[] = [
  {
    id: 'incident-report',
    name: 'Incident Report',
    tone: 'bureaucratic-nightmare',
    setting: 'Any corporate/government facility',
    protagonistRole: 'IT Compliance Officer',
    conflict: 'Discovering a critical flaw in legacy code that threatens operations',
    exampleOpening: `**INCIDENT REPORT #${Math.floor(Math.random() * 10000)}**
**Date:** [FUTURE_DATE]
**Location:** [SETTING]
**Filed By:** [PROTAGONIST_NAME], [ROLE]
**Classification:** Critical Legacy System Failure
**Subject:** Emergency documentation of 2025-era [TECHNOLOGY] implementation

I never thought I'd be writing one of these again. We all hoped the Great Migration of 2037 had purged the last of the "primitive 3D era" codebases from our systems. We were wrong.`,
  },
  {
    id: 'maintenance-log',
    name: 'Maintenance Log',
    tone: 'dark-comedy',
    setting: 'Data preservation facility',
    protagonistRole: 'Systems Maintenance Technician',
    conflict: 'Routine maintenance reveals disturbing implementation choices',
    exampleOpening: `**MAINTENANCE LOG - SECTOR [XX]**
**Technician:** [NAME], Employee ID: [ID]
**Shift:** Night Watch (2300-0700)
**System:** Legacy 3D Rendering Stack (Vintage 2025)

Hour 1: Standard checks. Everything nominal.
Hour 2: Coffee break. Heard something in the server room.
Hour 3: Found the React Three Fiber implementation. God help us all.`,
  },
  {
    id: 'field-notes',
    name: 'Field Notes',
    tone: 'noir',
    setting: 'Underground archive or remote location',
    protagonistRole: 'Code Archaeologist',
    conflict: 'Excavating ancient codebases to understand lost techniques',
    exampleOpening: `**FIELD NOTES**
**Expedition:** [NUMBER]
**Location:** [SETTING]
**Lead Researcher:** Dr. [NAME]
**Objective:** Document and preserve 2025-era [TECHNOLOGY]

They say the developers of 2025 were visionaries. Looking at this codebase, I'm starting to think they were something else entirely. The patterns here... they defy explanation. But we need to understand them. The future depends on it.`,
  },
  {
    id: 'training-material',
    name: 'Historical Training Document',
    tone: 'bureaucratic-nightmare',
    setting: 'Corporate training facility',
    protagonistRole: 'Legacy Systems Instructor',
    conflict: 'Teaching modern developers to maintain ancient code',
    exampleOpening: `**MANDATORY TRAINING MODULE**
**Course:** LEGACY-3D-101
**Topic:** Understanding 2025 [TECHNOLOGY] Patterns
**Instructor:** [NAME]
**Warning Level:** ⚠️ High Frustration Potential

Welcome to your nightmare, junior developers. Today we're going to learn why your ancestors decided that [TECHNICAL_DECISION] was a good idea. Spoiler: It wasn't. But it's our problem now.`,
  },
  {
    id: 'confession',
    name: 'Sealed Confession',
    tone: 'horror',
    setting: 'Personal log or sealed testimony',
    protagonistRole: 'Whistleblower or Survivor',
    conflict: 'Revealing the true horror of working with legacy systems',
    exampleOpening: `**SEALED TESTIMONY**
**Date:** [FUTURE_DATE]
**Witness:** [NAME] (Identity Protected)
**Status:** Psychological Evaluation Required
**Subject:** The [TECHNOLOGY] Incident

If you're reading this, I'm either dead or they've finally decided to declassify what really happened in Sector 7. The official report will tell you it was "unexpected legacy system behavior." That's a lie. What we found in that 2025 codebase... it was waiting for us.`,
  },
  {
    id: 'archaeological-paper',
    name: 'Academic Paper',
    tone: 'thriller',
    setting: 'Research institution',
    protagonistRole: 'Computer Science Historian',
    conflict: 'Academic analysis revealing dark truths about primitive practices',
    exampleOpening: `**JOURNAL OF LEGACY SYSTEMS ARCHAEOLOGY**
**Volume XX, Issue XX, [FUTURE_YEAR]**

**Title:** [TECHNOLOGY]: A Retrospective Analysis of 2025-Era 3D Rendering Patterns and Their Catastrophic Implications

**Abstract:** This paper examines the widespread adoption of [TECHNOLOGY] during the Primitive 3D Era (2024-2029) and documents the cascading failures that would plague systems for the next two decades. Content warning: Contains disturbing implementation patterns.`,
  },
  {
    id: 'emergency-transmission',
    name: 'Emergency Transmission',
    tone: 'horror',
    setting: 'Remote facility or space station',
    protagonistRole: 'Isolated Systems Administrator',
    conflict: 'Desperate call for help as systems fail catastrophically',
    exampleOpening: `**EMERGENCY TRANSMISSION**
**From:** [FACILITY_NAME]
**To:** Any receiving station
**Priority:** CRITICAL
**Date:** [FUTURE_DATE]

This is [NAME], [ROLE] at [FACILITY]. If anyone receives this, send help. We tried to update the legacy React Three Fiber implementation. The renderer... it's not responding the way the documentation said it would. The documentation was written in 2025. It's [CURRENT_YEAR]. We should have known better.`,
  },
];

export const HORROR_ELEMENTS = {
  technical: [
    'Memory leaks that grew sentient',
    'Infinite render loops that consumed entire server farms',
    'Shader code that compiled but shouldn\'t have',
    'Performance optimizations that made things slower',
    'Component hierarchies that violated the laws of React',
    'useFrame hooks that never stopped calling',
    'WebGL contexts that refused to die',
    'Three.js objects that persisted beyond disposal',
  ],
  atmospheric: [
    'Flickering fluorescent lights in server rooms',
    'The distant hum of cooling systems',
    'Coffee stains on critical documentation',
    'The smell of burning electronics',
    'Empty offices at 3 AM',
    'Error logs scrolling endlessly',
    'The sound of servers spinning up unexpectedly',
    'Darkness broken only by monitor glow',
  ],
  emotional: [
    'The dread of opening legacy code',
    'Impostor syndrome from not understanding ancient patterns',
    'Fear of touching working code',
    'Panic when tests start failing',
    'The isolation of being the only one who knows the system',
    'Anxiety from missing documentation',
    'Depression from reading old comments',
    'Existential crisis from seeing your own old code',
  ],
} as const;

export const TECH_HORROR_TROPES = [
  'The code that works but nobody knows why',
  'The comment that says DO NOT CHANGE THIS',
  'The function with 47 parameters',
  'The nested ternary that spans 200 lines',
  'The global state that everything depends on',
  'The performance optimization that broke everything',
  'The temporary fix from 2025 that is still running',
  'The dependency that has not been updated in 30 years',
  'The component that re-renders 1000 times per frame',
  'The shader that worked on one GPU in 2025',
] as const;

/**
 * Generate a random future date between 2045-2055
 */
export function generateFutureDate(): string {
  const year = 2045 + Math.floor(Math.random() * 10);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate a random protagonist name with role
 */
export function generateProtagonist(): { name: string; role: string } {
  const firstNames = ['Alex', 'Jordan', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Blake', 'Dakota', 'Sage'];
  const lastNames = ['Chen', 'Patel', 'Kim', 'Rodriguez', 'O\'Brien', 'Nakamura', 'Silva', 'Hansen', 'Okafor', 'Dubois'];

  const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  const role = PROTAGONIST_ROLES[Math.floor(Math.random() * PROTAGONIST_ROLES.length)];

  return { name, role };
}

/**
 * Select a random narrative template
 */
export function selectNarrativeTemplate(): NarrativeTemplate {
  return NARRATIVE_TEMPLATES[Math.floor(Math.random() * NARRATIVE_TEMPLATES.length)];
}

/**
 * Generate story metadata
 */
export interface StoryMetadata {
  date: string;
  setting: string;
  protagonist: { name: string; role: string };
  template: NarrativeTemplate;
  horrorElements: string[];
}

export function generateStoryMetadata(): StoryMetadata {
  return {
    date: generateFutureDate(),
    setting: NARRATIVE_SETTINGS[Math.floor(Math.random() * NARRATIVE_SETTINGS.length)],
    protagonist: generateProtagonist(),
    template: selectNarrativeTemplate(),
    horrorElements: [
      HORROR_ELEMENTS.technical[Math.floor(Math.random() * HORROR_ELEMENTS.technical.length)],
      HORROR_ELEMENTS.atmospheric[Math.floor(Math.random() * HORROR_ELEMENTS.atmospheric.length)],
      HORROR_ELEMENTS.emotional[Math.floor(Math.random() * HORROR_ELEMENTS.emotional.length)],
    ],
  };
}

/**
 * SEO-optimized title generator for tech horror stories
 */
export function generateSEOTitle(topic: string, year: number = 2025): string {
  const templates = [
    `Why ${topic} from ${year} Still Haunts Developers in 2050`,
    `The ${topic} Incident: A ${year} Legacy That Won't Die`,
    `I Inherited a ${year} ${topic} Codebase and It Changed Me Forever`,
    `${topic}: The ${year} Technology That Broke Production in 2048`,
    `Confessions of a ${topic} Archaeologist: Tales from the ${year} Era`,
    `The True Cost of ${year}-Era ${topic} Implementation`,
    `When ${topic} Goes Wrong: A ${year} Horror Story`,
    `${topic} Was Different in ${year} - And That's Terrifying`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}
