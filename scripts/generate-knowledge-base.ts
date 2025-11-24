#!/usr/bin/env ts-node

/**
 * KNOWLEDGE BASE CONTENT GENERATOR
 *
 * Generates tech horror stories about R3F topics for SEO optimization
 *
 * Usage:
 *   npm run generate:knowledge -- --count 50
 *   npm run generate:knowledge -- --category "Performance & Optimization"
 *   npm run generate:knowledge -- --difficulty advanced --count 20
 *   npm run generate:knowledge -- --all
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  R3F_KNOWLEDGE_INDEX,
  getTopicsByCategory,
  getTopicsByDifficulty,
  getHighSEOTopics,
  type R3FTopic,
} from '../lib/knowledge/r3f-taxonomy';
import { generateArticle, generateMDX } from '../lib/knowledge/content-generator';

// Configuration
const OUTPUT_DIR = path.join(process.cwd(), 'pages', 'docs', 'r3f-knowledge');
const STATS_FILE = path.join(OUTPUT_DIR, '_generation-stats.json');

interface GenerationStats {
  totalGenerated: number;
  generationDate: string;
  topics: {
    [key: string]: {
      count: number;
      difficulty: string;
      category: string;
      seoScore: number;
    };
  };
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    count?: number;
    category?: string;
    difficulty?: R3FTopic['difficulty'];
    all?: boolean;
    highSEO?: boolean;
    minSEO?: number;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--count':
        options.count = parseInt(args[++i], 10);
        break;
      case '--category':
        options.category = args[++i];
        break;
      case '--difficulty':
        options.difficulty = args[++i] as R3FTopic['difficulty'];
        break;
      case '--all':
        options.all = true;
        break;
      case '--high-seo':
        options.highSEO = true;
        break;
      case '--min-seo':
        options.minSEO = parseInt(args[++i], 10);
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
🎭 R3F Knowledge Base Generator - Tech Horror Edition

Generate SEO-optimized tech horror stories about React Three Fiber topics.

USAGE:
  npm run generate:knowledge -- [OPTIONS]

OPTIONS:
  --all                    Generate articles for ALL topics in the index
  --count <number>         Generate specified number of random articles
  --category <name>        Generate articles for specific category
  --difficulty <level>     Generate articles for specific difficulty (beginner|intermediate|advanced|expert)
  --high-seo              Generate only high SEO value topics (score >= 8)
  --min-seo <number>      Generate topics with minimum SEO score
  --help                   Show this help message

EXAMPLES:
  # Generate 10 random articles
  npm run generate:knowledge -- --count 10

  # Generate all articles (${R3F_KNOWLEDGE_INDEX.length} topics)
  npm run generate:knowledge -- --all

  # Generate high SEO value articles
  npm run generate:knowledge -- --high-seo

  # Generate advanced difficulty articles
  npm run generate:knowledge -- --difficulty advanced

  # Generate all performance-related articles
  npm run generate:knowledge -- --category "Performance & Optimization"

OUTPUT:
  Articles are saved to: ${OUTPUT_DIR}
  Format: MDX with frontmatter
  Naming: [slug].mdx

NARRATIVE STYLE:
  All articles are written as "tech horror from the future" - incident reports
  and maintenance logs from IT departments in 2045-2055 dealing with legacy
  2025 technology. This creates engaging, SEO-friendly content that doesn't
  feel like traditional marketing material.
`);
}

/**
 * Select topics based on options
 */
function selectTopics(options: ReturnType<typeof parseArgs>): R3FTopic[] {
  if (options.all) {
    console.log('📚 Generating articles for ALL topics...');
    return R3F_KNOWLEDGE_INDEX;
  }

  if (options.category) {
    console.log(`📂 Generating articles for category: ${options.category}`);
    return getTopicsByCategory(options.category);
  }

  if (options.difficulty) {
    console.log(`🎯 Generating articles for difficulty: ${options.difficulty}`);
    return getTopicsByDifficulty(options.difficulty);
  }

  if (options.highSEO) {
    console.log('🔥 Generating high SEO value articles...');
    return getHighSEOTopics(8);
  }

  if (options.minSEO) {
    console.log(`📈 Generating articles with SEO score >= ${options.minSEO}`);
    return getHighSEOTopics(options.minSEO);
  }

  if (options.count) {
    console.log(`🎲 Generating ${options.count} random articles...`);
    const shuffled = [...R3F_KNOWLEDGE_INDEX].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, options.count);
  }

  // Default: generate 5 high SEO topics
  console.log('🌟 Generating 5 high SEO value articles (default)...');
  return getHighSEOTopics(9).slice(0, 5);
}

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✅ Created output directory: ${OUTPUT_DIR}`);
  }
}

/**
 * Load existing stats
 */
function loadStats(): GenerationStats {
  if (fs.existsSync(STATS_FILE)) {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
  }
  return {
    totalGenerated: 0,
    generationDate: new Date().toISOString(),
    topics: {},
  };
}

/**
 * Save stats
 */
function saveStats(stats: GenerationStats) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

/**
 * Generate articles
 */
function generateArticles(topics: R3FTopic[]) {
  ensureOutputDir();
  const stats = loadStats();

  console.log('\n🎬 Starting generation...\n');

  let generated = 0;
  let skipped = 0;

  for (const topic of topics) {
    const article = generateArticle(topic);
    const fileName = `${article.slug}.mdx`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`⏭️  Skipped (exists): ${fileName}`);
      skipped++;
      continue;
    }

    // Generate MDX content
    const mdxContent = generateMDX(article);

    // Write file
    fs.writeFileSync(filePath, mdxContent);

    // Update stats
    stats.topics[topic.id] = {
      count: (stats.topics[topic.id]?.count || 0) + 1,
      difficulty: topic.difficulty,
      category: topic.category,
      seoScore: topic.seoValue,
    };

    console.log(`✅ Generated: ${fileName}`);
    console.log(`   📝 Title: ${article.title}`);
    console.log(`   👤 Author: ${article.author} (${article.metadata.protagonist.role})`);
    console.log(`   🎯 SEO Score: ${article.seoScore}/10`);
    console.log(`   📅 Date: ${article.date}`);
    console.log(`   🏢 Setting: ${article.metadata.setting}`);
    console.log(`   🎭 Narrative: ${article.metadata.template.name}\n`);

    generated++;
  }

  // Update and save stats
  stats.totalGenerated += generated;
  stats.generationDate = new Date().toISOString();
  saveStats(stats);

  console.log('\n📊 GENERATION COMPLETE\n');
  console.log(`✅ Generated: ${generated} new articles`);
  console.log(`⏭️  Skipped: ${skipped} existing articles`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`📈 Total articles in knowledge base: ${stats.totalGenerated}`);
  console.log(`\n🎉 Your tech horror knowledge base is growing!\n`);
}

/**
 * Print generation summary
 */
function printSummary(topics: R3FTopic[]) {
  console.log('\n📋 GENERATION PLAN\n');
  console.log(`Total topics to generate: ${topics.length}`);

  const byCategory: { [key: string]: number } = {};
  const byDifficulty: { [key: string]: number } = {};
  let totalSEO = 0;

  topics.forEach(topic => {
    byCategory[topic.category] = (byCategory[topic.category] || 0) + 1;
    byDifficulty[topic.difficulty] = (byDifficulty[topic.difficulty] || 0) + 1;
    totalSEO += topic.seoValue;
  });

  console.log('\nBy Category:');
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  console.log('\nBy Difficulty:');
  Object.entries(byDifficulty).forEach(([diff, count]) => {
    console.log(`  ${diff}: ${count}`);
  });

  console.log(`\nAverage SEO Score: ${(totalSEO / topics.length).toFixed(2)}/10`);
  console.log('\n');
}

/**
 * Main execution
 */
function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎭 R3F KNOWLEDGE BASE GENERATOR                         ║
║   Tech Horror Stories from the Future                    ║
║                                                           ║
║   Generate thousands of SEO-optimized articles           ║
║   about React Three Fiber, framed as incident reports    ║
║   from IT departments in 2045-2055                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

  const options = parseArgs();
  const topics = selectTopics(options);

  if (topics.length === 0) {
    console.log('❌ No topics selected. Use --help for usage information.');
    process.exit(1);
  }

  printSummary(topics);

  // Generate articles
  generateArticles(topics);

  console.log(`
💡 NEXT STEPS:

1. Review generated articles in: ${OUTPUT_DIR}
2. Run the vector indexing script to add to search:
   npm run index:knowledge

3. Deploy to production to see SEO impact
4. Generate more articles as needed:
   npm run generate:knowledge -- --all

5. Monitor SEO performance and adjust topic selection

🎯 SEO STRATEGY:
   - Each article targets specific R3F keywords
   - Narrative format increases engagement and shares
   - Future-dated stories create unique, non-duplicate content
   - Technical accuracy builds authority and trust

🔮 REMEMBER:
   These aren't fake business stories - they're speculative fiction
   that happens to teach real R3F concepts and rank for real keywords.
`);
}

// Run if called directly
if (require.main === module) {
  main();
}

export { generateArticles, selectTopics };
