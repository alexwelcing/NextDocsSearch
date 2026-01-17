import OpenAI from 'openai'

export type ImageConcept = {
  // Short unique identifier for diversity tracking
  archetype: string
  // One-sentence logline for the image
  logline: string
  // Concrete scene description (who/what/where/when)
  scene: string
  // Key physical props to include
  keyProps: string[]
  // Camera and lighting choices
  camera: string
  lighting: string
  // Texture/material cues
  productionDesign: string
  // A "twist" that makes it stand out
  signatureTwist: string
  // Negative constraints beyond global rules
  avoid: string[]
}

let cachedOpenAI: OpenAI | null = null

function getOpenAIKey(): string {
  const raw = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || ''
  return raw.replace(/^Bearer\s+/i, '').trim()
}

function getOpenAIClient(): OpenAI {
  if (cachedOpenAI) return cachedOpenAI
  const apiKey = getOpenAIKey()
  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Set OPENAI_API_KEY or OPENAI_KEY.')
  }
  cachedOpenAI = new OpenAI({ apiKey })
  return cachedOpenAI
}

function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function truncateForPrompt(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n\n[TRUNCATED]'
}

export async function generateImageConcept(params: {
  slug: string
  title: string
  description: string
  keywords: string[]
  headings?: string[]
  // Full article body (MDX content without frontmatter)
  fullText: string
  // For diversity: list of recently used archetypes in this run
  recentlyUsedArchetypes: string[]
  model?: string
}): Promise<ImageConcept> {
  const openai = getOpenAIClient()

  const model = params.model || process.env.OPENAI_CONCEPT_MODEL || 'gpt-4o-mini'

  // Keep within reasonable context; we still "read" the entire article from disk,
  // but the model input must be bounded.
  const articleText = truncateForPrompt(params.fullText, 12000)

  const system =
    'You are an elite sci-fi film production designer + technical story editor. ' +
    'Given an article, you will invent a grounded gritty hard-sci-fi cinematic image concept that complements the writing. ' +
    'The concept MUST be concrete (real objects, real space), not abstract wallpaper. ' +
    'Summarize the article to find the ONE core idea, and generate a really clear intentional picture of that idea. ' +
    'Be opinionated and specific, do not just summarize the content.'

  const user = {
    slug: params.slug,
    title: params.title,
    description: params.description,
    keywords: params.keywords,
    headings: params.headings || [],
    recentlyUsedArchetypes: params.recentlyUsedArchetypes,
    article: articleText,
    requirements: {
      vibe: 'grounded gritty sci-fi movie, technical plot energy',
      must: [
        'strong focal moment, not decorative',
        'unique opening words (avoid starting every concept with the same phrase)',
        'high variety across articles',
        'no readable text, no logos, no watermarks',
        'no humanoid robots, no generic HUD overlays, no abstract wallpaper',
        'specify, not summarize, have a opinionated preference on the article image',
      ],
      outputFormat: 'Return ONLY valid JSON matching the schema.'
    },
    schema: {
      archetype: 'string (short tag e.g. "Forensic Failure", "Cold Launch", "Control Room Dilemma")',
      logline: 'string (1 sentence; start with a unique concrete noun phrase, not "Cinematic still" etc.)',
      scene: 'string (3-6 sentences, very concrete)',
      keyProps: 'string[] (3-6 items)',
      camera: 'string',
      lighting: 'string',
      productionDesign: 'string',
      signatureTwist: 'string',
      avoid: 'string[] (extra negatives)'
    }
  }

  const response = await openai.chat.completions.create({
    model,
    temperature: 0.9,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(user) },
    ],
  })

  const text = response.choices[0]?.message?.content || ''

  const parsed = safeJsonParse<ImageConcept>(text)
  if (!parsed) {
    throw new Error('Concept generator did not return valid JSON')
  }

  // Minimal normalization
  parsed.keyProps = Array.isArray(parsed.keyProps) ? parsed.keyProps.filter(Boolean).slice(0, 8) : []
  parsed.avoid = Array.isArray(parsed.avoid) ? parsed.avoid.filter(Boolean).slice(0, 12) : []

  return parsed
}
