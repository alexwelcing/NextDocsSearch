/**
 * LTX-2.3 Prompt Templates for Article-to-Video Pipeline
 *
 * Templates follow LTX-2.3 prompting guidance:
 * - Single cohesive paragraph per prompt
 * - Present tense, sequential action
 * - Camera language and audio cues included
 * - No readable text/logos in-frame
 *
 * @see https://huggingface.co/Lightricks/LTX-Video
 */

import type { ClipRole, LtxMode } from './types'

// ═══════════════════════════════════════════════════════════════
// TEMPLATE VARIABLES
// ═══════════════════════════════════════════════════════════════

export interface PromptVariables {
  HOOK_IDEA?: string
  SETTING?: string
  LIGHT?: string
  SIMPLE_ACTION_SEQUENCE?: string
  CAMERA_MOVE?: string
  TONE?: string
  SECTION_CONCEPT?: string
  METAPHOR_SCENE?: string
  SUBJECT_MOTION?: string
  ENVIRONMENT_MOTION?: string
  RISK_METAPHOR?: string
  TENSION_ACTION?: string
  TAKEAWAY?: string
  MICRO_MOTION_LIST?: string
  ACTION_SEQUENCE?: string
}

// ═══════════════════════════════════════════════════════════════
// BASE TEMPLATES
// ═══════════════════════════════════════════════════════════════

export interface PromptTemplate {
  role: ClipRole
  mode: LtxMode
  description: string
  template: string
  defaultVariables: Partial<PromptVariables>
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  // === HOOK TEMPLATES ===
  {
    role: 'hook',
    mode: 'T2V',
    description: 'Opening hook concept scene (text-to-video)',
    template:
      'Cinematic opening shot that visually represents: {HOOK_IDEA}. Environment: {SETTING}. Lighting: {LIGHT}. Action: {SIMPLE_ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Mood: {TONE}. No readable text. Clean composition.',
    defaultVariables: {
      SETTING: 'a sleek modern tech environment with cool blue ambient light',
      LIGHT: 'dramatic low-key lighting with volumetric haze',
      SIMPLE_ACTION_SEQUENCE: 'slow reveal of the central subject emerging from shadow',
      CAMERA_MOVE: 'slow push-in with slight upward tilt',
      TONE: 'intriguing and urgent',
    },
  },
  {
    role: 'hook',
    mode: 'I2V',
    description: 'Opening hook animate hero still (image-to-video)',
    template:
      'Make this image come alive with subtle cinematic motion. {MICRO_MOTION_LIST}. Camera: slow push-in. Keep subject identity consistent. No added text or logos.',
    defaultVariables: {
      MICRO_MOTION_LIST:
        'Gentle ambient particles drifting, soft light flicker from background elements, subtle depth-of-field shift',
    },
  },

  // === EXPLANATION TEMPLATES ===
  {
    role: 'why_it_matters',
    mode: 'T2V',
    description: 'Section explanation metaphor B-roll',
    template:
      'A clear visual metaphor for {SECTION_CONCEPT}: {METAPHOR_SCENE}. {ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Add ambient audio only, no speech. No readable text or logos.',
    defaultVariables: {
      METAPHOR_SCENE: 'an intricate mechanism being assembled in a workshop',
      ACTION_SEQUENCE: 'pieces click into place one by one, revealing the larger structure',
      CAMERA_MOVE: 'slow orbit around the central subject',
    },
  },
  {
    role: 'key_concept',
    mode: 'I2V',
    description: 'Section explanation anchored concept art',
    template:
      'Animate the provided concept image: {SECTION_CONCEPT}. Motion: {SUBJECT_MOTION}. Secondary motion: {ENVIRONMENT_MOTION}. Camera: {CAMERA_MOVE}. Keep details stable; avoid chaotic motion. No readable text.',
    defaultVariables: {
      SUBJECT_MOTION: 'gentle pulsing glow on the central element',
      ENVIRONMENT_MOTION: 'slow particle drift in the background',
      CAMERA_MOVE: 'slow overhead drift',
    },
  },
  {
    role: 'key_concept',
    mode: 'T2V',
    description: 'Key concept B-roll (no anchor image)',
    template:
      'A clear visual metaphor for {SECTION_CONCEPT}: {METAPHOR_SCENE}. {ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Ambient electronic hum, no speech. No readable text or logos.',
    defaultVariables: {
      METAPHOR_SCENE: 'a network of glowing nodes on a dark surface',
      ACTION_SEQUENCE: 'nodes light up in sequence, forming a pattern that reveals the concept',
      CAMERA_MOVE: 'slow dolly forward',
    },
  },

  // === MECHANISM / EXAMPLE ===
  {
    role: 'mechanism',
    mode: 'T2V',
    description: 'Technical mechanism visualization',
    template:
      'A clear technical visualization: {SECTION_CONCEPT}. Scene: {METAPHOR_SCENE}. The mechanism activates step by step: {ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Clean, technical atmosphere. No readable text.',
    defaultVariables: {
      METAPHOR_SCENE: 'a cross-section view of a complex system in a controlled lab',
      ACTION_SEQUENCE: 'components activate sequentially, energy flows through connectors',
      CAMERA_MOVE: 'steady tracking shot following the process flow',
    },
  },
  {
    role: 'example',
    mode: 'T2V',
    description: 'Concrete example scene',
    template:
      'A specific scenario showing {SECTION_CONCEPT} in practice: {METAPHOR_SCENE}. {ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Grounded, realistic setting. No readable text.',
    defaultVariables: {
      METAPHOR_SCENE: 'a real-world application of the concept in a professional setting',
      ACTION_SEQUENCE: 'the system responds to input and produces a visible result',
      CAMERA_MOVE: 'medium shot with shallow depth of field',
    },
  },

  // === WARNING / RISK ===
  {
    role: 'warning',
    mode: 'T2V',
    description: 'Warning/risk segment',
    template:
      'High-stakes tone: {RISK_METAPHOR}. Scene: {SETTING}. Action: {TENSION_ACTION}. Camera: handheld micro-shake or slow orbit. Lighting: high contrast. No gore, no logos, no readable text.',
    defaultVariables: {
      RISK_METAPHOR: 'a critical system approaching failure threshold',
      SETTING: 'a dim control room with emergency indicators',
      TENSION_ACTION: 'warning lights begin flashing, subtle alarm tone rises',
    },
  },
  {
    role: 'risk_metaphor',
    mode: 'T2V',
    description: 'Risk metaphor visualization',
    template:
      'High-stakes tone: {RISK_METAPHOR}. Scene: {SETTING}. Action: {TENSION_ACTION}. Camera: slow orbit with increasing tension. Lighting: dramatic high contrast, cold blue with warm warning amber. No readable text or logos.',
    defaultVariables: {
      RISK_METAPHOR: 'a fracture spreading through a protective barrier',
      SETTING: 'a secure facility with layers of defense',
      TENSION_ACTION: 'cracks appear and propagate, containment systems activate',
    },
  },

  // === STRATEGY / TRADEOFF ===
  {
    role: 'tradeoff',
    mode: 'T2V',
    description: 'Tradeoff comparison scene',
    template:
      'A visual comparison showing two alternatives for {SECTION_CONCEPT}: {METAPHOR_SCENE}. The scene reveals the tension between both paths. Camera: {CAMERA_MOVE}. Balanced, analytical mood. No readable text.',
    defaultVariables: {
      METAPHOR_SCENE: 'two diverging pathways lit with contrasting colors',
      CAMERA_MOVE: 'slow pan from one option to the other',
    },
  },
  {
    role: 'framework',
    mode: 'T2V',
    description: 'Framework/structure visualization',
    template:
      'A structured visualization of {SECTION_CONCEPT}: {METAPHOR_SCENE}. {ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Clean, organized composition. No readable text or logos.',
    defaultVariables: {
      METAPHOR_SCENE: 'an architectural blueprint coming to life as a 3D model',
      ACTION_SEQUENCE: 'layers build up systematically, each component finding its place',
      CAMERA_MOVE: 'slow pull-back revealing the complete structure',
    },
  },

  // === NARRATIVE ===
  {
    role: 'escalation',
    mode: 'T2V',
    description: 'Narrative escalation',
    template:
      'An escalating scene: {SECTION_CONCEPT}. {METAPHOR_SCENE}. The intensity builds: {ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Tension increasing. No readable text.',
    defaultVariables: {
      ACTION_SEQUENCE: 'speed increases, elements multiply, complexity grows visibly',
      CAMERA_MOVE: 'accelerating push-in toward the focal point',
    },
  },
  {
    role: 'twist',
    mode: 'T2V',
    description: 'Plot twist / revelation',
    template:
      'A revealing moment: {SECTION_CONCEPT}. {METAPHOR_SCENE}. Sudden shift: {ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Dramatic lighting change. No readable text.',
    defaultVariables: {
      ACTION_SEQUENCE: 'the scene transforms as the hidden truth becomes visible',
      CAMERA_MOVE: 'quick rack focus to reveal the key detail',
    },
  },
  {
    role: 'consequence',
    mode: 'T2V',
    description: 'Consequence / aftermath',
    template:
      'The aftermath of {SECTION_CONCEPT}: {METAPHOR_SCENE}. {ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Reflective, weighty mood. No readable text.',
    defaultVariables: {
      ACTION_SEQUENCE: 'the environment settles into its new state, dust particles drift',
      CAMERA_MOVE: 'slow crane up revealing the full scope',
    },
  },

  // === RESOLUTION ===
  {
    role: 'limits',
    mode: 'T2V',
    description: 'Limitations / boundaries',
    template:
      'A scene showing the boundaries of {SECTION_CONCEPT}: {METAPHOR_SCENE}. {ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Honest, measured tone. No readable text.',
    defaultVariables: {
      METAPHOR_SCENE: 'a system reaching its operational ceiling',
      ACTION_SEQUENCE: 'performance indicators plateau, the system stabilizes at capacity',
      CAMERA_MOVE: 'static wide shot emphasizing scale',
    },
  },
  {
    role: 'mitigation',
    mode: 'T2V',
    description: 'Mitigation / solution',
    template:
      'A calming resolution: {SECTION_CONCEPT}. {METAPHOR_SCENE}. {ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Relieved, forward-looking mood. No readable text or logos.',
    defaultVariables: {
      METAPHOR_SCENE: 'protective measures activating and containing the threat',
      ACTION_SEQUENCE: 'barriers form, systems stabilize, the environment calms',
      CAMERA_MOVE: 'slow pull-back showing containment working',
    },
  },
  {
    role: 'recommendation',
    mode: 'T2V',
    description: 'Recommendation / action item',
    template:
      'A decisive moment: {SECTION_CONCEPT}. {METAPHOR_SCENE}. {ACTION_SEQUENCE}. Camera: {CAMERA_MOVE}. Confident, forward-looking. No readable text.',
    defaultVariables: {
      METAPHOR_SCENE: 'a clear path forward illuminated among alternatives',
      ACTION_SEQUENCE: 'the chosen path lights up, progress begins along it',
      CAMERA_MOVE: 'tracking shot following the forward path',
    },
  },

  // === CLOSING ===
  {
    role: 'closing_thought',
    mode: 'I2V',
    description: 'Closing thought (anchored)',
    template:
      'Resolve into a calm, hopeful closing shot illustrating: {TAKEAWAY}. Minimal motion. Camera: slow pull-back. Soft ambient sound. Leave clean space for captions. No readable text.',
    defaultVariables: {
      TAKEAWAY: 'a sense of accomplishment and clarity',
    },
  },
  {
    role: 'cta',
    mode: 'I2V',
    description: 'CTA closing (calm, image-anchored)',
    template:
      'Resolve into a calm, hopeful closing shot illustrating: {TAKEAWAY}. Minimal motion. Camera: slow pull-back. Soft ambient sound. Leave clean space for captions. No readable text or logos.',
    defaultVariables: {
      TAKEAWAY: 'an invitation to explore further',
    },
  },
  {
    role: 'cta',
    mode: 'T2V',
    description: 'CTA closing (text-to-video)',
    template:
      'A serene closing scene: calm environment, soft ambient light, minimal motion. Camera: slow pull-back. Soft ambient sound. Clean composition with open space for overlay captions. No readable text or logos.',
    defaultVariables: {},
  },
]

// ═══════════════════════════════════════════════════════════════
// TEMPLATE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get all available templates for a clip role
 */
export function getTemplatesForRole(role: ClipRole, mode?: LtxMode): PromptTemplate[] {
  return PROMPT_TEMPLATES.filter(
    (t) => t.role === role && (mode === undefined || t.mode === mode)
  )
}

/**
 * Fill a prompt template with variables
 */
export function fillTemplate(
  template: string,
  variables: Partial<PromptVariables>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
    }
  }
  return result
}

/**
 * Build an LTX prompt for a specific clip role with variables
 */
export function buildPrompt(
  role: ClipRole,
  mode: LtxMode,
  variables: Partial<PromptVariables>
): string {
  const templates = getTemplatesForRole(role, mode)
  if (templates.length === 0) {
    // Fall back to T2V general template
    const fallback = getTemplatesForRole(role)
    if (fallback.length === 0) {
      return `Cinematic scene related to: ${variables.SECTION_CONCEPT || variables.HOOK_IDEA || 'the topic'}. Camera: slow cinematic movement. No readable text or logos.`
    }
    const t = fallback[0]
    const merged = { ...t.defaultVariables, ...variables }
    return fillTemplate(t.template, merged)
  }

  const t = templates[0]
  const merged = { ...t.defaultVariables, ...variables }
  return fillTemplate(t.template, merged)
}

/**
 * Build prompt variables from a scene plan clip and article context
 */
export function buildVariablesFromClip(
  clip: { role: ClipRole; captionText: string; sourceSection?: string },
  hookIdea?: string,
  takeaway?: string
): Partial<PromptVariables> {
  const vars: Partial<PromptVariables> = {}

  if (clip.role === 'hook') {
    vars.HOOK_IDEA = hookIdea || clip.captionText
  }

  if (clip.role === 'cta' || clip.role === 'closing_thought') {
    vars.TAKEAWAY = takeaway || clip.captionText
  }

  // For all other roles, use section concept
  vars.SECTION_CONCEPT = clip.sourceSection || clip.captionText

  return vars
}

/**
 * Get all available prompt templates (for documentation/UI)
 */
export function getAllTemplates(): PromptTemplate[] {
  return [...PROMPT_TEMPLATES]
}
