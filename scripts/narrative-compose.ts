#!/usr/bin/env node

/**
 * Narrative Compose — CLI for the Narrative Authoring Engine
 *
 * Composes fiction series into unified narrative works.
 * Generates prompts, context, interstitials, and narrative metadata.
 *
 * Usage:
 *   pnpm tsx scripts/narrative-compose.ts graph                    # Print the full narrative graph
 *   pnpm tsx scripts/narrative-compose.ts series threshold         # Print series composition
 *   pnpm tsx scripts/narrative-compose.ts context <slug> "<brief>" # Build generation context for an article
 *   pnpm tsx scripts/narrative-compose.ts interstitial <from> <to> # Build interstitial prompt between two articles
 *   pnpm tsx scripts/narrative-compose.ts frontmatter              # Emit updated frontmatter for all articles
 *   pnpm tsx scripts/narrative-compose.ts arc                      # Print the three-era narrative arc
 */

import {
  buildNarrativeGraph,
  buildSeriesComposition,
  buildArticleGenerationContext,
  buildInterstitialPrompt,
  type NarrativeGraph,
  type SeriesComposition,
} from '../lib/narrative-engine'
import {
  TEMPORAL_ERAS,
  THEMATIC_BRIDGES,
  RECURRING_MOTIFS,
  READING_PATHS,
} from '../lib/narrative-arc'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const [command, ...rest] = process.argv.slice(2)

if (!command) {
  console.log(`
Narrative Compose — Authoring engine for fiction series

Commands:
  graph                      Full narrative graph (all series, bridges, reading paths)
  series <name>              Single series composition (threshold | residue | cartography)
  context <slug> "<brief>"   Build AI generation context for an article
  interstitial <from> <to>   Build interstitial prompt between two articles
  frontmatter                Emit narrative-aware frontmatter for all articles
  arc                        Print the three-era arc with visual identities
  bridges                    List all thematic bridges between articles
  motifs                     List recurring motifs and their transformations
  paths                      List all reading paths
  prompts <slug>             Output the full system + user prompts for article generation
`)
  process.exit(0)
}

// ═══════════════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════════════

function parseArticle(slug: string) {
  const filePath = path.join(ARTICLES_DIR, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data: frontmatter, content } = matter(raw)
  const paragraphs = content
    .split(/\n\n+/)
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0 && !p.startsWith('#') && !p.startsWith('---') && !p.startsWith('import'))
  return {
    slug,
    title: frontmatter.title || slug,
    date: frontmatter.date || '',
    series: frontmatter.series || '',
    seriesOrder: frontmatter.seriesOrder || 0,
    description: frontmatter.description || '',
    relatedArticles: frontmatter.relatedArticles || [],
    openingLine: paragraphs[0]?.replace(/\*\*/g, '').slice(0, 200) || '',
    closingLine: paragraphs[paragraphs.length - 1]?.replace(/\*\*/g, '').slice(0, 200) || '',
    sectionHeaders: [] as string[],
    wordCount: content.split(/\s+/).length,
  }
}

function getSeriesArticles(seriesKey: string) {
  const slugPattern = new RegExp(`^${seriesKey}-\\d{2}-`)
  return fs.readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => f.replace('.mdx', ''))
    .filter((s) => slugPattern.test(s))
    .map(parseArticle)
    .filter((a): a is NonNullable<ReturnType<typeof parseArticle>> => a !== null)
    .sort((a, b) => a.seriesOrder - b.seriesOrder)
}

switch (command) {
  case 'graph': {
    const graph = buildNarrativeGraph()
    console.log('\n' + '='.repeat(70))
    console.log('  THE TEMPORAL CORRIDOR — Full Narrative Graph')
    console.log('='.repeat(70))
    console.log(`  Total articles: ${graph.canonicalOrder.length}`)
    console.log(`  Total words:    ~${graph.totalWords.toLocaleString()}`)
    console.log(`  Reading time:   ~${graph.totalReadingMinutes} minutes`)
    console.log(`  Bridges:        ${graph.bridges.length} cross-series connections`)

    for (const series of graph.series) {
      console.log(`\n${'─'.repeat(70)}`)
      console.log(`  ${series.era.title.toUpperCase()} (${series.era.yearRange.join('–')})`)
      console.log(`  Voice: ${series.voice.name} (${series.voice.heritage.primary} × ${series.voice.heritage.secondary})`)
      console.log(`  ${series.preface}`)
      console.log(`  Arc: ${series.arcSummary}`)

      for (const article of series.articles) {
        const p = article.position
        const dep = p.narrativeDependencies.length
        const opens = p.opensQuestions.length
        const resolves = p.resolves.length
        console.log(
          `    [${p.position}] ${article.slug} (${p.phase}) ` +
          `— opens ${opens}Q, resolves ${resolves}Q, depends on ${dep}`
        )

        if (article.continuity.echo) {
          console.log(`        echo → ${article.continuity.echo.slug}`)
        }
      }
    }

    console.log(`\n${'─'.repeat(70)}`)
    console.log('  READING PATHS')
    for (const rp of READING_PATHS) {
      console.log(`    ${rp.name}: ${rp.articles.length} articles — ${rp.description.slice(0, 60)}...`)
    }
    console.log()
    break
  }

  case 'series': {
    const seriesKey = rest[0]
    if (!seriesKey) {
      console.error('Usage: narrative-compose series <threshold|residue|cartography>')
      process.exit(1)
    }
    const comp = buildSeriesComposition(seriesKey)
    console.log(JSON.stringify(comp, null, 2))
    break
  }

  case 'context': {
    const slug = rest[0]
    const brief = rest[1]
    if (!slug || !brief) {
      console.error('Usage: narrative-compose context <slug> "<story brief>"')
      process.exit(1)
    }

    // Determine which series
    const seriesKey = slug.split('-')[0]
    const seriesArticles = getSeriesArticles(seriesKey)

    const ctx = buildArticleGenerationContext(slug, brief, seriesArticles)

    console.log('\n' + '='.repeat(70))
    console.log(`  GENERATION CONTEXT: ${slug}`)
    console.log('='.repeat(70))
    console.log(`\n  Era: ${ctx.position.era} | Phase: ${ctx.position.phase} | Year: ${ctx.position.storyYear}`)
    console.log(`  Voice: ${ctx.voice.name}`)
    console.log(`  Opens: ${ctx.position.opensQuestions.join('; ') || 'none'}`)
    console.log(`  Resolves: ${ctx.position.resolves.join('; ') || 'none'}`)

    if (ctx.continuity.previouslyOn) {
      console.log(`\n  PREVIOUSLY ON: ${ctx.continuity.previouslyOn}`)
    }
    if (ctx.continuity.echo) {
      console.log(`  ECHO: → ${ctx.continuity.echo.slug}`)
    }

    console.log(`\n${'─'.repeat(70)}`)
    console.log('  SYSTEM PROMPT:')
    console.log('─'.repeat(70))
    console.log(ctx.systemPrompt)

    console.log(`\n${'─'.repeat(70)}`)
    console.log('  USER PROMPT:')
    console.log('─'.repeat(70))
    console.log(ctx.userPrompt)

    console.log(`\n${'─'.repeat(70)}`)
    console.log('  SUGGESTED FRONTMATTER:')
    console.log('─'.repeat(70))
    console.log(JSON.stringify(ctx.frontmatter, null, 2))
    console.log()
    break
  }

  case 'prompts': {
    const slug = rest[0]
    if (!slug) {
      console.error('Usage: narrative-compose prompts <slug>')
      process.exit(1)
    }
    const seriesKey = slug.split('-')[0]
    const seriesArticles = getSeriesArticles(seriesKey)
    const parsed = parseArticle(slug)
    const brief = parsed?.description || 'A story in the series.'
    const ctx = buildArticleGenerationContext(slug, brief, seriesArticles)

    // Output as copy-pasteable blocks
    console.log('=== SYSTEM PROMPT ===')
    console.log(ctx.systemPrompt)
    console.log('\n=== USER PROMPT ===')
    console.log(ctx.userPrompt)
    break
  }

  case 'interstitial': {
    const fromSlug = rest[0]
    const toSlug = rest[1]
    if (!fromSlug || !toSlug) {
      console.error('Usage: narrative-compose interstitial <from-slug> <to-slug>')
      process.exit(1)
    }
    const result = buildInterstitialPrompt(fromSlug, toSlug)
    if (!result) {
      console.error(`Could not build interstitial between ${fromSlug} and ${toSlug}`)
      process.exit(1)
    }
    console.log('=== SYSTEM PROMPT ===')
    console.log(result.systemPrompt)
    console.log('\n=== USER PROMPT ===')
    console.log(result.userPrompt)
    break
  }

  case 'frontmatter': {
    console.log('\n  Narrative-aware frontmatter updates:\n')
    for (const seriesKey of ['threshold', 'residue', 'cartography']) {
      const comp = buildSeriesComposition(seriesKey)
      for (const article of comp.articles) {
        const p = article.position
        console.log(`  ${article.slug}:`)
        console.log(`    narrativePhase: ${p.phase}`)
        console.log(`    storyYear: ${p.storyYear}`)
        console.log(`    opensQuestions: [${p.opensQuestions.length}]`)
        console.log(`    resolves: [${p.resolves.length}]`)
        if (article.continuity.echo) {
          console.log(`    echo: ${article.continuity.echo.slug}`)
        }
        console.log()
      }
    }
    break
  }

  case 'arc': {
    console.log('\n' + '='.repeat(70))
    console.log('  THE TEMPORAL CORRIDOR')
    console.log('='.repeat(70))

    for (const era of TEMPORAL_ERAS) {
      const vi = era.visualIdentity
      console.log(`\n${'─'.repeat(70)}`)
      console.log(`  ${era.title.toUpperCase()} (${era.yearRange.join('–')})`)
      console.log(`  "${era.subtitle}"`)
      console.log()
      console.log(`  Thesis:    ${era.thesis}`)
      console.log(`  Question:  ${era.question}`)
      console.log()
      console.log(`  Visual Identity:`)
      console.log(`    Palette:     ${vi.palette.primary} / ${vi.palette.secondary} / ${vi.palette.accent}`)
      console.log(`    Temperature: ${vi.colorTemperature} (0=cold, 1=warm)`)
      console.log(`    Lighting:    ${vi.lighting}`)
      console.log(`    Camera:      ${vi.camera}`)
      console.log(`    Texture:     ${vi.texture}`)
      console.log(`    Scale:       ${vi.scale}`)
      console.log()
      console.log(`  Emotional Arc:`)
      console.log(`    Opening:  ${era.emotionalArc.opening}`)
      console.log(`    Midpoint: ${era.emotionalArc.midpoint}`)
      console.log(`    Closing:  ${era.emotionalArc.closing}`)
    }
    console.log()
    break
  }

  case 'bridges': {
    console.log('\n  Thematic Bridges:\n')
    for (const b of THEMATIC_BRIDGES) {
      console.log(`  [${b.strength}] ${b.from.slug} → ${b.to.slug}`)
      console.log(`    Theme: ${b.theme}`)
      console.log(`    ${b.connection}`)
      console.log()
    }
    break
  }

  case 'motifs': {
    console.log('\n  Recurring Motifs:\n')
    for (const m of RECURRING_MOTIFS) {
      console.log(`  ${m.name} (${m.key})`)
      for (const [era, expression] of Object.entries(m.manifestations)) {
        console.log(`    ${era}: ${expression}`)
      }
      console.log()
    }
    break
  }

  case 'paths': {
    console.log('\n  Reading Paths:\n')
    for (const rp of READING_PATHS) {
      console.log(`  ${rp.name}`)
      console.log(`  ${rp.description}`)
      for (let i = 0; i < rp.articles.length; i++) {
        console.log(`    ${i + 1}. ${rp.articles[i]}`)
      }
      console.log()
    }
    break
  }

  default:
    console.error(`Unknown command: ${command}`)
    process.exit(1)
}
