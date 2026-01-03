/**
 * Art Style Configuration for NextDocsSearch Blog
 *
 * New direction (from scratch): grounded gritty hard-sci‑fi cinematic stills.
 * Goal: images feel like frames from a technical sci‑fi thriller with real production design,
 * not abstract wallpaper or generic "AI art".
 */

const CINEMATIC_BIBLE = {
  styleName: 'Grounded Gritty Techno‑Sci‑Fi',
  coreDirectives: [
    'cinematic still frame from a gritty hard‑sci‑fi movie',
    'grounded realism, practical set dressing, industrial textures',
    'technical plot energy: systems, constraints, failure modes, tradeoffs',
    'strong focal subject and clear story moment (not decorative wallpaper)',
    'physically plausible lighting and materials',
    'imperfect practical realism: slight lens imperfections, minor haze, not glossy or hyper-clean',
  ],
  lighting: [
    'low‑key lighting with motivated practical sources',
    'cold fluorescents + warm tungsten accents',
    'volumetric haze, subtle smoke, dust in beams',
  ],
  camera: [
    '35mm film look, high dynamic range',
    'shallow depth of field, cinematic contrast',
    'wide establishing shot OR tight hero close‑up with bokeh',
    'subtle handheld energy, tiny motion imperfection (not blurry)',
  ],
  palette: [
    'gunmetal',
    'oil‑stained steel',
    'concrete gray',
    'muted cyan instrumentation glow',
    'warning amber highlights',
  ],
  setDressing: [
    'cables, conduit, server racks, cooling pipes, scratched metal',
    'hazard stripes, bolts, rivets, labels (but keep them unreadable)',
    'condensation, fingerprints, worn edges',
  ],
  hardNo: [
    'NO abstract wallpaper, NO vector illustration, NO gradient mesh art',
    'NO humanoid robots, NO generic sci‑fi HUD overlays, NO floating brain iconography',
    'NO logos, NO watermarks, NO readable text',
    'NOT a UI screenshot, NOT an infographic',
    'Avoid overly smooth plastic surfaces, avoid perfectly clean symmetry, avoid ultra-polished stock-photo lighting',
  ],
}

function compact(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function clampChars(text: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars).trim()
}

function joinWithinLimit(parts: Array<{ label: string; text: string; max?: number }>, maxChars: number): string {
  const normalized = parts
    .map((p) => {
      const t = compact(p.text)
      return { ...p, text: p.max ? clampChars(t, p.max) : t }
    })
    .filter((p) => p.text.length > 0)

  // First pass: join with blank lines.
  let combined = normalized.map((p) => p.text).join('\n\n')

  // If still too long, progressively tighten lowest-priority sections.
  if (combined.length > maxChars) {
    const priorityOrder = ['story', 'fallbackScene', 'base', 'concept']
    const mutable = [...normalized]

    for (const label of priorityOrder) {
      if (combined.length <= maxChars) break
      const idx = mutable.findIndex((p) => p.label === label)
      if (idx === -1) continue

      // Shrink that section further.
      const current = mutable[idx]
      const shrinkTo = Math.max(200, Math.floor((current.text.length * 0.6)))
      mutable[idx] = { ...current, text: clampChars(current.text, shrinkTo) }
      combined = mutable.map((p) => p.text).join('\n\n')
    }

    // Absolute enforcement: hard cut (last resort, not a different prompt).
    if (combined.length > maxChars) {
      combined = clampChars(combined, maxChars)
    }
  }

  return combined
}

function stripMdxArtifacts(text: string): string {
  return compact(
    text
      .replace(/`[^`]*`/g, '')
      .replace(/\[[^\]]+\]\([^\)]+\)/g, '')
      .replace(/<[^>]+>/g, '')
  )
}

function hashStringToIndex(value: string, modulo: number): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return modulo === 0 ? 0 : hash % modulo
}

type Shot = {
  name: string
  framing: string
  lens: string
}

const SHOTS: Shot[] = [
  {
    name: 'Control Room Tension',
    framing: 'wide shot of a cramped control room, protagonist off‑center, machinery looming',
    lens: 'anamorphic, 40mm equivalent, subtle lens distortion, cinematic bokeh',
  },
  {
    name: 'Forensic Close‑Up',
    framing: 'tight close‑up of a critical component showing failure clues (burn marks, missing switch, frayed wire)',
    lens: 'macro‑ish 85mm equivalent, shallow depth of field, tactile realism',
  },
  {
    name: 'Industrial Establishing',
    framing: 'moody establishing shot of an industrial facility (server hall / factory / lab) with a single narrative focal point',
    lens: 'wide 28–35mm equivalent, strong leading lines, haze',
  },
  {
    name: 'Decision Moment',
    framing: 'two diverging pathways or systems presented physically in‑scene (split corridor, bifurcating pipes, branching cable harness)',
    lens: '35mm equivalent, high contrast, centered focal object',
  },
]

function pickShot(slugOrTitle: string | undefined, title: string): Shot {
  const seed = (slugOrTitle || title).trim() || title
  return SHOTS[hashStringToIndex(seed, SHOTS.length)]
}

function buildSceneConcept(
  title: string,
  keywords: string[],
  headings?: string[]
): string {
  const corpus = `${title} ${keywords.join(' ')} ${(headings || []).join(' ')}`.toLowerCase()

  if (corpus.includes('fork') || corpus.includes('branch')) {
    return 'a literal forked infrastructure: one corridor leads to a bright communal commons, the other into gated steel towers; a branching cable harness shaped like a fork as the hero prop'
  }
  if (corpus.includes('cartel') || corpus.includes('collude')) {
    return 'a network of identical sealed servers arranged like a cartel around a central “agreement” artifact (physical lock mechanism), implying collusion without showing people'
  }
  if (corpus.includes('kill switch')) {
    return 'a control panel with an unmistakable empty socket where an emergency kill switch should be; scorched edges and hurried field repairs'
  }
  if (corpus.includes('supply chain')) {
    return 'a chain of rugged shipping crates and connectors in a dim warehouse; one connector subtly corrupted, spreading to others like a stain'
  }
  if (corpus.includes('alignment') || corpus.includes('optimiz')) {
    return 'a target/optimization rig in a lab that has become a trap: calibration marks, clamps, constraints; the “goal” physically cages the system'
  }
  if (corpus.includes('agency') || corpus.includes('agents')) {
    return 'one operator workstation projecting many remote “agent” terminals across a room (as physical terminals), implying multiplication of agency'
  }

  return 'a grounded hard‑sci‑fi technical thriller moment: a fragile system under stress, one critical component as the story focal point'
}

/**
 * Generate the base style prompt that will be consistent across all images
 */
export function getBaseStylePrompt(): string {
  return compact(`
    ${CINEMATIC_BIBLE.coreDirectives.join(', ')}.
    Lighting: ${CINEMATIC_BIBLE.lighting.join(', ')}.
    Camera: ${CINEMATIC_BIBLE.camera.join(', ')}.
    Palette: ${CINEMATIC_BIBLE.palette.join(', ')}.
    Set dressing: ${CINEMATIC_BIBLE.setDressing.join(', ')}.
    Constraints: ${CINEMATIC_BIBLE.hardNo.join(' ')}.
  `)
}

/**
 * Generate a topic-specific prompt for an article
 */
export function generateArticlePrompt(
  title: string,
  description: string,
  keywords: string[],
  context?: {
    slug?: string
    headings?: string[]
    excerpt?: string
    concept?: string
  }
): string {
  const baseStyle = getBaseStylePrompt()

  const cleanedExcerpt = context?.excerpt ? stripMdxArtifacts(context.excerpt).slice(0, 260) : ''
  const cleanedHeadings = (context?.headings || []).map(stripMdxArtifacts).slice(0, 6)
  const themes = keywords.slice(0, 8).join(', ')

  const shot = pickShot(context?.slug, title)
  const scene = buildSceneConcept(title, keywords, cleanedHeadings)

  const storyBrief = compact(
    [
      `Title concept: ${title}.`,
      description ? `Description: ${stripMdxArtifacts(description).slice(0, 220)}.` : '',
      themes ? `Technical themes: ${themes}.` : '',
      cleanedHeadings.length ? `Key sections: ${cleanedHeadings.slice(0, 4).join(' | ')}.` : '',
      cleanedExcerpt ? `Excerpt: ${cleanedExcerpt}.` : '',
    ].filter(Boolean).join(' ')
  )

  // Strong steering away from "pretty abstract" outputs.
  const antiWallpaper = compact(
    `Do NOT make it abstract or decorative. This must feel like a real scene with tangible objects and narrative tension. Avoid symmetrical wallpaper patterns, floating shapes, and generic gradients.`
  )

  // Allow diegetic technical vibes without readable text.
  const textConstraint = compact(
    `If there are labels/screens, they must be blurred/illegible/no readable characters. No typography, no words, no logos.`
  )

  // If we have an LLM-generated concept, lead with it to maximize variety and relevance.
  const conceptLead = context?.concept
    ? compact(
        `Unique cinematic concept (lead with this): ${stripMdxArtifacts(context.concept).slice(0, 2000)}`
      )
    : ''

  const maxChars = Number(process.env.DALLE_PROMPT_MAX_CHARS || 3200)
  return joinWithinLimit(
    [
      {
        label: 'concept',
        text: conceptLead,
        // Keep it strong but bounded; this is the main diversity driver.
        max: 1400,
      },
      {
        label: 'shot',
        text: `Shot: ${shot.name}. Framing: ${shot.framing}. Lens: ${shot.lens}.`,
        max: 420,
      },
      {
        label: 'fallbackScene',
        text: `Scene anchor (fallback): ${scene}.`,
        max: 320,
      },
      {
        label: 'base',
        text: baseStyle,
        max: 950,
      },
      {
        label: 'story',
        text: `Story brief: ${storyBrief}`,
        max: 750,
      },
      {
        label: 'constraints',
        text: `${antiWallpaper} ${textConstraint}`,
        max: 520,
      },
    ],
    maxChars
  )
}

/**
 * Generate prompts for different image sizes/purposes
 */
export function generateImagePrompts(
  title: string,
  description: string,
  keywords: string[],
  context?: {
    slug?: string
    headings?: string[]
    excerpt?: string
  }
) {
  const basePrompt = generateArticlePrompt(title, description, keywords, context)

  return {
    // Hero image - wider format, more breathing room
    hero: `${basePrompt} Wide cinematic frame. Clear foreground subject, deep background environment.`,

    // Open Graph image - must work at small sizes
    og: `${basePrompt} Centered, iconic key object. Strong contrast and readability at small sizes.`,

    // Thumbnail - simplified version
    thumbnail: `${basePrompt} Tight hero close‑up on the key prop; simple background; extremely legible silhouette.`,
  }
}

/**
 * Get image generation parameters for DALL-E 3
 */
export function getImageGenerationParams(type: 'hero' | 'og' | 'thumbnail') {
  const sizeMap = {
    hero: '1792x1024' as const,  // Wide landscape
    og: '1792x1024' as const,    // Will be cropped to 1200x630
    thumbnail: '1024x1024' as const,  // Square
  }

  return {
    model: 'dall-e-3',
    size: sizeMap[type],
    quality: 'hd' as const,
    n: 1,
    style: 'vivid' as const,  // More hyper-real and dramatic
  }
}
