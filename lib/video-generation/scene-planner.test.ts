import { describe, it, expect } from 'vitest'
import {
  scoreHook,
  scoreClose,
  selectHook,
  selectClose,
  detectArticleType,
  generateScenePlan,
} from './scene-planner'
import { parseArticle } from './article-parser'
import type { ArticleIntermediate } from './types'

// ═══════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════

const SAMPLE_ARTICLE_BODY = `## Why Error Correction Matters

Physical qubits are fragile. Current error rates of 0.1% per gate operation mean that circuits requiring 10,000+ gates will almost certainly fail without correction.

⚠️ Without error correction, quantum computers cannot solve any commercially relevant problems.

## Surface Code Basics

Surface codes use many fragile qubits acting as one reliable "logical" qubit. The lattice structure detects and corrects errors in real-time.

## Scaling to Fault-Tolerant Computation

Fault-tolerant quantum computing requires breakthroughs in hardware and broken encryption is a real risk.

⚠️ Critical Warning: Organizations must migrate to post-quantum cryptography immediately.

## Conclusion

Start implementing quantum-safe cryptography today. The timeline for fault-tolerant quantum is shorter than most people think, and the consequences of being unprepared are severe.
`

function makeSampleArticle(): ArticleIntermediate {
  return parseArticle(
    {
      title: 'Quantum Error Correction in Qiskit: Surface Codes',
      author: 'Alex Welcing',
      date: '2026-01-15',
      image: '/images/articles/quantum-error.jpg',
    },
    SAMPLE_ARTICLE_BODY,
    'quantum-error-correction-qiskit'
  )
}

// ═══════════════════════════════════════════════════════════════
// HOOK SCORING
// ═══════════════════════════════════════════════════════════════

describe('scoreHook', () => {
  it('gives points for numbers/dates', () => {
    const { score } = scoreHook('Error rates of 0.1% per gate operation cause failures.')
    expect(score).toBeGreaterThanOrEqual(3)
  })

  it('gives points for risk/warning language', () => {
    const { score } = scoreHook('The system will catastrophically fail under these conditions.')
    expect(score).toBeGreaterThanOrEqual(3)
  })

  it('gives points for contrast', () => {
    const { score } = scoreHook('Today vs. future: the landscape will shift dramatically.')
    expect(score).toBeGreaterThanOrEqual(2)
  })

  it('gives points for concrete systems', () => {
    const { score } = scoreHook('The protocol enables fault-tolerant computation.')
    expect(score).toBeGreaterThanOrEqual(1)
  })

  it('gives zero for bland sentences', () => {
    const { score } = scoreHook('This is an interesting topic to explore.')
    expect(score).toBe(0)
  })

  it('accumulates points from multiple signals', () => {
    const { score } = scoreHook(
      'The algorithm fails catastrophically when error rates exceed 1% per gate.'
    )
    // numbers (+3) + risk (+3) + concrete (+1) = 7
    expect(score).toBeGreaterThanOrEqual(6)
  })
})

// ═══════════════════════════════════════════════════════════════
// CLOSE SCORING
// ═══════════════════════════════════════════════════════════════

describe('scoreClose', () => {
  it('gives points for conclusion section', () => {
    const { score } = scoreClose(
      'Organizations should plan ahead.',
      'Conclusion'
    )
    expect(score).toBeGreaterThanOrEqual(3)
  })

  it('gives points for imperative language', () => {
    const { score } = scoreClose(
      'Start implementing quantum-safe cryptography today.',
      'Next Steps'
    )
    expect(score).toBeGreaterThanOrEqual(2)
  })

  it('gives points for "so what" framing', () => {
    const { score } = scoreClose(
      'This matters because it determines the future of computing.',
      'Discussion'
    )
    expect(score).toBeGreaterThanOrEqual(1)
  })

  it('accumulates conclusion + imperative', () => {
    const { score } = scoreClose(
      'Start preparing now before it is too late.',
      'Conclusion'
    )
    // conclusion (+3) + imperative (+2) = 5
    expect(score).toBeGreaterThanOrEqual(5)
  })
})

// ═══════════════════════════════════════════════════════════════
// ARTICLE TYPE DETECTION
// ═══════════════════════════════════════════════════════════════

describe('detectArticleType', () => {
  it('detects warning-risk-memo', () => {
    const article = makeSampleArticle()
    const type = detectArticleType(article)
    expect(type).toBe('warning-risk-memo')
  })

  it('detects general for minimal articles', () => {
    const article = parseArticle(
      { title: 'Simple Post' },
      '## Introduction\n\nSome content here.\n\n## Details\n\nMore content.',
      'simple-post'
    )
    expect(detectArticleType(article)).toBe('general')
  })
})

// ═══════════════════════════════════════════════════════════════
// HOOK/CLOSE SELECTION
// ═══════════════════════════════════════════════════════════════

describe('selectHook', () => {
  it('selects a high-scoring hook from the article', () => {
    const article = makeSampleArticle()
    const hook = selectHook(article)
    expect(hook.score).toBeGreaterThan(0)
    expect(hook.text.length).toBeGreaterThan(10)
  })
})

describe('selectClose', () => {
  it('selects a closing line from the article', () => {
    const article = makeSampleArticle()
    const close = selectClose(article)
    expect(close.score).toBeGreaterThan(0)
    expect(close.text.length).toBeGreaterThan(10)
  })
})

// ═══════════════════════════════════════════════════════════════
// SCENE PLAN GENERATION
// ═══════════════════════════════════════════════════════════════

describe('generateScenePlan', () => {
  it('generates a complete scene plan', () => {
    const article = makeSampleArticle()
    const plan = generateScenePlan(article)

    expect(plan.articleSlug).toBe('quantum-error-correction-qiskit')
    expect(plan.totalClips).toBeGreaterThanOrEqual(5)
    expect(plan.estimatedDurationS).toBeGreaterThan(0)
    expect(plan.clips.length).toBe(plan.totalClips)
  })

  it('first clip is a hook', () => {
    const article = makeSampleArticle()
    const plan = generateScenePlan(article)
    expect(plan.clips[0].role).toBe('hook')
  })

  it('last clip is a CTA', () => {
    const article = makeSampleArticle()
    const plan = generateScenePlan(article)
    expect(plan.clips[plan.clips.length - 1].role).toBe('cta')
  })

  it('all clips have required fields', () => {
    const article = makeSampleArticle()
    const plan = generateScenePlan(article)

    for (const clip of plan.clips) {
      expect(clip.sceneId).toBeTruthy()
      expect(clip.durationS).toBeGreaterThan(0)
      expect(clip.durationS).toBeLessThanOrEqual(10)
      expect(clip.ltxMode).toMatch(/^(T2V|I2V)$/)
      expect(clip.captionText).toBeTruthy()
    }
  })

  it('generates voiceover script', () => {
    const article = makeSampleArticle()
    const plan = generateScenePlan(article)
    expect(plan.voiceoverScript.length).toBe(plan.totalClips)
  })
})
