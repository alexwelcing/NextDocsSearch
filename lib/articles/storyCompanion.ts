export interface StoryCompanionBeat {
  id: string
  title: string
  detail: string
  prompt: string
}

export interface StoryCompanionPrompt {
  id: string
  label: string
  prompt: string
}

export interface StoryCompanionData {
  title: string
  premise: string
  worldHook: string
  motifs: string[]
  beats: StoryCompanionBeat[]
  prompts: StoryCompanionPrompt[]
}

interface BuildStoryCompanionOptions {
  title: string
  description?: string
  keywords?: string[]
  content?: string
}

function cleanText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function createId(prefix: string, value: string, index: number): string {
  const slug = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug ? `${prefix}-${slug}` : `${prefix}-${index + 1}`
}

function extractPremise(description: string | undefined, content: string | undefined): string {
  if (description?.trim()) {
    return cleanText(description)
  }

  const firstParagraph = (content || '')
    .split(/\n\s*\n/)
    .map((block) => cleanText(block))
    .find(Boolean)

  return firstParagraph || 'A speculative story with enough pressure in it to turn into a map, fork, or sequel.'
}

function extractWorldHook(keywords: string[] | undefined, premise: string): string {
  if (keywords && keywords.length > 0) {
    return `World signals: ${keywords.slice(0, 4).join(' • ')}`
  }

  const fragment = premise.split(/[.!?]/)[0]
  return fragment || premise
}

function extractBeatSources(content: string | undefined): Array<{ title: string; detail: string }> {
  const source = content || ''
  const headingMatches = Array.from(source.matchAll(/^##\s+(.+)$/gm)).map((match) => cleanText(match[1]))

  if (headingMatches.length > 0) {
    const blocks = source.split(/(?=^##\s+)/gm).filter((block) => block.trim())
    return blocks.slice(0, 4).map((block, index) => {
      const lines = block.split('\n').filter((line) => line.trim())
      const rawTitle = lines[0]?.replace(/^##\s+/, '') || `Beat ${index + 1}`
      const detail = cleanText(lines.slice(1).join(' ')).slice(0, 180)
      return {
        title: cleanText(rawTitle),
        detail: detail || cleanText(block).slice(0, 180),
      }
    })
  }

  return source
    .split(/\n\s*\n/)
    .map((block) => cleanText(block))
    .filter(Boolean)
    .slice(0, 4)
    .map((detail, index) => ({
      title: `Beat ${index + 1}`,
      detail: detail.slice(0, 180),
    }))
}

export function buildStoryCompanion({
  title,
  description,
  keywords = [],
  content,
}: BuildStoryCompanionOptions): StoryCompanionData {
  const premise = extractPremise(description, content)
  const worldHook = extractWorldHook(keywords, premise)
  const motifs = keywords.slice(0, 5)
  const beats = extractBeatSources(content).map((beat, index) => ({
    id: createId('beat', beat.title, index),
    title: beat.title,
    detail: beat.detail,
    prompt:
      index === 0
        ? `/story Explain how the opening pressure in "${title}" sets the story in motion.`
        : `/story Break down the turning point "${beat.title}" in "${title}" and show how it changes the story.`,
  }))

  return {
    title,
    premise,
    worldHook,
    motifs,
    beats,
    prompts: [
      {
        id: 'story-map',
        label: 'Map the pressure',
        prompt: `/story Map the characters, pressures, and turning points in "${title}" using the story details in this article.`,
      },
      {
        id: 'story-sequel',
        label: 'Continue the story',
        prompt: `/story Continue "${title}" with the most plausible next scene while keeping the same tone and world logic.`,
      },
      {
        id: 'story-fork',
        label: 'Fork the choice',
        prompt: `/story Compare the path taken in "${title}" with the strongest alternate choice the protagonist could have made.`,
      },
      {
        id: 'story-stress-test',
        label: 'Stress test the world',
        prompt: `/story Pressure test the internal logic of "${title}" and identify the weakest assumption without flattening the story.`,
      },
    ],
  }
}