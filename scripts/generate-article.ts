#!/usr/bin/env tsx

/**
 * CLI TOOL: Manual Article Generation
 *
 * Generate articles manually without deploying
 * Run with: npx tsx scripts/generate-article.ts [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
  generateArticle,
  articleToMDX,
  generateFilename,
  estimateGenerationCost,
  validateArticle,
} from '../lib/knowledge/ai-article-generator';
import {
  type TimelineState,
  calculateConvergence,
} from '../lib/knowledge/timeline-convergence';

const argv = yargs(hideBin(process.argv))
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Show what would be generated without actually generating',
    default: false,
  })
  .help()
  .parseSync();

const STATE_FILE = path.join(process.cwd(), '.timeline-state.json');
const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles');

/**
 * Load timeline state
 */
function loadState(): TimelineState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load state:', error);
  }

  return {
    currentConvergence: 0,
    lastArticlePublished: {},
    nextConvergencePoint: null,
    totalArticlesPublished: 0,
  };
}

/**
 * Save timeline state
 */
function saveState(state: TimelineState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Main execution
 */
async function main() {
  console.log('Timeline Convergence Article Generator\n');

  // Check for OpenAI key
  if (!process.env.OPENAI_KEY) {
    console.error('Error: OPENAI_KEY environment variable is not set');
    console.log('\nSet it with:');
    console.log('  export OPENAI_KEY=sk-your-key-here');
    console.log('\nOr add it to .env.local file');
    process.exit(1);
  }

  // Load current state
  const state = loadState();
  const convergence = calculateConvergence(state);

  console.log('Current State:');
  console.log(`   Convergence: ${convergence.toFixed(1)}%`);
  console.log(`   Total articles: ${state.totalArticlesPublished}`);
  console.log(`   Last present: ${state.lastArticlePublished.present || 'Never'}`);
  console.log(`   Last future: ${state.lastArticlePublished.future || 'Never'}\n`);

  if (argv.dryRun) {
    console.log('Dry run mode - estimating cost...\n');
    const cost = estimateGenerationCost();
    console.log(`Estimated cost: $${cost.cost.toFixed(3)}`);
    console.log(`Estimated tokens: ${cost.tokens}`);
    console.log('\nNo article generated (dry run mode)');
    process.exit(0);
  }

  console.log('Generating article with AI...\n');

  try {
    // Generate article
    const article = await generateArticle(state);

    console.log('Article generated successfully!\n');
    console.log('Article Details:');
    console.log(`   Title: ${article.title}`);
    console.log(`   Timeline: ${article.timeline}`);
    console.log(`   Date: ${article.date}`);
    console.log(`   Author: ${article.author.join(', ')}`);
    console.log(`   Keywords: ${article.keywords.slice(0, 5).join(', ')}...`);
    console.log(`   Convergence: ${article.convergence.toFixed(1)}%`);
    console.log(`   Content length: ${article.content.length} characters\n`);

    // Validate
    const validation = validateArticle(article);
    if (!validation.valid) {
      console.error('Validation failed:');
      validation.errors.forEach((err) => console.error(`   - ${err}`));
      process.exit(1);
    }

    console.log('Validation passed\n');

    // Save article
    const filename = generateFilename(article);
    const filepath = path.join(ARTICLES_DIR, filename);
    const mdx = articleToMDX(article);

    // Ensure directory exists
    if (!fs.existsSync(ARTICLES_DIR)) {
      fs.mkdirSync(ARTICLES_DIR, { recursive: true });
    }

    fs.writeFileSync(filepath, mdx, 'utf-8');
    console.log(`Saved to: ${filepath}\n`);

    // Update state
    const newState: TimelineState = {
      ...state,
      currentConvergence: calculateConvergence(state),
      lastArticlePublished: {
        ...state.lastArticlePublished,
        [article.timeline]: new Date().toISOString(),
      },
      totalArticlesPublished: state.totalArticlesPublished + 1,
    };

    saveState(newState);
    console.log('Timeline state updated\n');

    console.log('Done! Article ready for publishing.');
    console.log(`\nView at: /articles/${article.slug}\n`);
  } catch (error) {
    console.error('\nError generating article:', error);
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

main();
