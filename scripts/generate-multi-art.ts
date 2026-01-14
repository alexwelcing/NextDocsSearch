#!/usr/bin/env node

/**
 * Multi-Model Article Art Generator
 * 
 * Generates 3 different art options per article using different AI models.
 * Results are stored in Supabase for easy selection.
 * 
 * Usage:
 *   pnpm generate:multi-art                    # Generate for articles missing art
 *   pnpm generate:multi-art --limit 10         # Limit to 10 articles
 *   pnpm generate:multi-art --article my-slug  # Generate for specific article
 *   pnpm generate:multi-art --force            # Regenerate even if options exist
 *   pnpm generate:multi-art --dry-run          # Preview without generating
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

import { FalClient } from '../lib/art-generation/fal-client';
import { buildModelPrompt, ArticleContext, detectArticleTheme } from '../lib/art-generation/prompt-customizer';
import { 
  FalImageModel, 
  getModelById,
  FAST_MODELS,
  QUALITY_MODELS,
  ARTISTIC_MODELS,
  BALANCED_MODELS,
  PHOTOREALISTIC_MODELS,
} from '../lib/fal-models';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'multi-art');

// Model selection strategy - pick 3 diverse models per article
interface ModelSelectionStrategy {
  name: string;
  description: string;
  selectModels: (articleContext: ArticleContext) => [FalImageModel, FalImageModel, FalImageModel];
}

const MODEL_STRATEGIES: ModelSelectionStrategy[] = [
  {
    name: 'diverse-quality',
    description: 'One fast, one balanced, one quality model',
    selectModels: (ctx) => {
      const theme = detectArticleTheme(ctx);
      const seed = hashString(ctx.slug);
      
      // Pick from different tiers for variety
      const fast = pickFromArray(FAST_MODELS.filter(m => m.qualityTier >= 3), seed);
      const balanced = pickFromArray(BALANCED_MODELS, seed + 1);
      const quality = pickFromArray(QUALITY_MODELS.filter(m => m.speedTier !== 'slow' || m.qualityTier === 5), seed + 2);
      
      return [fast, balanced, quality];
    },
  },
  {
    name: 'artistic-variety',
    description: 'Mix of artistic and photorealistic styles',
    selectModels: (ctx) => {
      const seed = hashString(ctx.slug);
      
      const artistic = pickFromArray(ARTISTIC_MODELS, seed);
      const photo = pickFromArray(PHOTOREALISTIC_MODELS, seed + 1);
      const balanced = pickFromArray(BALANCED_MODELS, seed + 2);
      
      return [artistic, photo, balanced];
    },
  },
  {
    name: 'speed-focused',
    description: 'All fast models for quick iteration',
    selectModels: (ctx) => {
      const seed = hashString(ctx.slug);
      const fastModels = FAST_MODELS.filter(m => m.qualityTier >= 3);
      
      return [
        pickFromArray(fastModels, seed),
        pickFromArray(fastModels, seed + 1),
        pickFromArray(fastModels, seed + 2),
      ];
    },
  },
];

// Curated model pools for intelligent crapshoot
// VERIFIED WORKING endpoints as of Jan 2026
const CURATED_MODEL_POOLS = {
  // Fast models - all verified working
  fast: [
    'fal-ai/flux/schnell',      // ✅ verified
    'fal-ai/fast-sdxl',         // ✅ verified
    'fal-ai/flux-pro/v1.1',     // ✅ verified (fast pro variant)
  ],
  
  // Quality models worth the wait
  quality: [
    'fal-ai/flux/dev',          // ✅ verified
    'fal-ai/stable-diffusion-v35-large', // ✅ verified
    'fal-ai/recraft-v3',        // ✅ verified
  ],
  
  // Unique/experimental worth trying
  experimental: [
    'fal-ai/ideogram/v2',       // ✅ verified (v2 not v3)
    'fal-ai/kolors',            // ✅ verified
    'fal-ai/aura-flow',         // ✅ verified
    'fal-ai/stable-cascade',    // experimental
    'fal-ai/pixart-sigma',      // experimental
  ],
  
  // Photorealistic specialists
  photorealistic: [
    'fal-ai/flux/dev',          // best for photorealism
    'fal-ai/stable-diffusion-v35-large',
  ],
};

// ═══════════════════════════════════════════════════════════════
// CLI ARGUMENTS
// ═══════════════════════════════════════════════════════════════

const argv = yargs(hideBin(process.argv))
  .option('limit', {
    alias: 'l',
    type: 'number',
    description: 'Maximum number of articles to process',
  })
  .option('article', {
    alias: 'a',
    type: 'string',
    description: 'Generate for specific article slug',
  })
  .option('force', {
    alias: 'f',
    type: 'boolean',
    description: 'Regenerate even if options already exist',
    default: false,
  })
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Preview without generating',
    default: false,
  })
  .option('strategy', {
    alias: 's',
    type: 'string',
    choices: ['diverse-quality', 'artistic-variety', 'speed-focused', 'random'],
    description: 'Model selection strategy',
    default: 'random',
  })
  .option('parallel', {
    alias: 'p',
    type: 'number',
    description: 'Number of parallel generations (be careful with rate limits)',
    default: 1,
  })
  .option('save-local', {
    type: 'boolean',
    description: 'Also save images locally',
    default: true,
  })
  .help()
  .parseSync();

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function pickFromArray<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Select 3 diverse models using the "intelligent crapshoot" approach
 */
function selectDiverseModels(context: ArticleContext): [string, string, string] {
  const theme = detectArticleTheme(context);
  const seed = hashString(context.slug);
  
  // Always include one fast model for quick feedback
  const fastModel = pickFromArray(CURATED_MODEL_POOLS.fast, seed);
  
  // Second model based on theme
  let secondPool: string[];
  if (theme === 'tech-horror' || theme === 'ai-tech') {
    secondPool = CURATED_MODEL_POOLS.experimental;
  } else if (theme === 'business' || theme === 'narrative') {
    secondPool = CURATED_MODEL_POOLS.photorealistic;
  } else {
    secondPool = CURATED_MODEL_POOLS.quality;
  }
  const secondModel = pickFromArray(secondPool, seed + 1);
  
  // Third model - randomize from experimental for variety
  const thirdModel = pickFromArray(CURATED_MODEL_POOLS.experimental, seed + 2);
  
  // Ensure all three are different
  const models = new Set([fastModel]);
  models.add(secondModel);
  
  let third = thirdModel;
  while (models.has(third)) {
    third = pickRandom([...CURATED_MODEL_POOLS.quality, ...CURATED_MODEL_POOLS.experimental]);
  }
  models.add(third);
  
  return Array.from(models) as [string, string, string];
}

/**
 * Get article context from MDX file
 */
function getArticleContext(filePath: string): ArticleContext | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, content: bodyContent } = matter(content);
    
    const slug = path.basename(filePath, '.mdx');
    
    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      keywords: data.keywords || [],
      excerpt: bodyContent.substring(0, 500),
    };
  } catch (err) {
    console.error(`Failed to parse ${filePath}:`, err);
    return null;
  }
}

/**
 * Get all articles
 */
function getAllArticles(): ArticleContext[] {
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.mdx'));
  const articles: ArticleContext[] = [];
  
  for (const file of files) {
    const ctx = getArticleContext(path.join(ARTICLES_DIR, file));
    if (ctx) articles.push(ctx);
  }
  
  return articles;
}

/**
 * Check if article already has art options in Supabase
 */
async function hasExistingOptions(slug: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('article_art_options')
    .select('id')
    .eq('article_slug', slug)
    .eq('status', 'completed')
    .limit(1);
  
  if (error) {
    console.error(`Error checking existing options for ${slug}:`, error);
    return false;
  }
  
  return (data?.length || 0) > 0;
}

/**
 * Save image to local filesystem
 */
async function saveImageLocally(
  imageUrl: string, 
  slug: string, 
  optionNumber: number,
  modelId: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Create directory if needed
    const articleDir = path.join(OUTPUT_DIR, slug);
    if (!fs.existsSync(articleDir)) {
      fs.mkdirSync(articleDir, { recursive: true });
    }
    
    // Create filename from model
    const modelName = modelId.split('/').pop() || 'unknown';
    const filename = `option-${optionNumber}-${modelName}.png`;
    const localPath = path.join(articleDir, filename);
    
    fs.writeFileSync(localPath, buffer);
    
    return localPath;
  } catch (err) {
    console.error('Failed to save locally:', err);
    return null;
  }
}

/**
 * Upload image to Supabase Storage
 */
async function uploadToStorage(
  imageUrl: string,
  slug: string,
  optionNumber: number,
  modelId: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    const modelName = modelId.split('/').pop() || 'unknown';
    const storagePath = `${slug}/option-${optionNumber}-${modelName}.png`;
    
    const { error } = await supabase.storage
      .from('article-artwork')
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: true,
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }
    
    return storagePath;
  } catch (err) {
    console.error('Upload failed:', err);
    return null;
  }
}

/**
 * Generate art for a single article
 */
async function generateArticleArt(
  context: ArticleContext,
  falClient: FalClient,
  batchId: string
): Promise<{ success: number; failed: number }> {
  const modelIds = selectDiverseModels(context);
  const results = { success: 0, failed: 0 };
  
  console.log(`\n📸 ${context.slug}`);
  console.log(`   Theme: ${detectArticleTheme(context)}`);
  console.log(`   Models: ${modelIds.join(', ')}`);
  
  for (let i = 0; i < modelIds.length; i++) {
    const modelId = modelIds[i];
    const model = getModelById(modelId);
    const optionNumber = i + 1;
    
    if (!model) {
      console.log(`   ❌ Option ${optionNumber}: Model not found: ${modelId}`);
      results.failed++;
      continue;
    }
    
    // Build model-specific prompt
    const { prompt, negativePrompt } = buildModelPrompt(modelId, context, i);
    
    console.log(`   🎨 Option ${optionNumber}: ${model.name}`);
    console.log(`      Prompt: "${prompt.substring(0, 80)}..."`);
    
    if (argv.dryRun) {
      console.log(`      [DRY RUN] Would generate with ${model.name}`);
      results.success++;
      continue;
    }
    
    // Insert pending record
    const { data: record, error: insertError } = await supabase
      .from('article_art_options')
      .insert({
        article_slug: context.slug,
        batch_id: batchId,
        option_number: optionNumber,
        model_id: modelId,
        model_name: model.name,
        model_tier: categorizeModelTier(model),
        prompt,
        negative_prompt: negativePrompt,
        model_params: model.defaultParams,
        status: 'processing',
      })
      .select()
      .single();
    
    if (insertError) {
      console.error(`      ❌ Failed to insert record:`, insertError);
      results.failed++;
      continue;
    }
    
    // Generate image
    const startTime = Date.now();
    const result = await falClient.generate({
      modelId,
      prompt,
      negativePrompt,
      params: model.defaultParams,
    });
    
    if (!result.success || !result.imageUrl) {
      console.log(`      ❌ Generation failed: ${result.error}`);
      
      await supabase
        .from('article_art_options')
        .update({
          status: 'failed',
          error_message: result.error,
        })
        .eq('id', record.id);
      
      results.failed++;
      continue;
    }
    
    console.log(`      ✅ Generated in ${result.generationTimeMs}ms`);
    
    // Save locally if configured
    let localPath: string | null = null;
    if (argv.saveLocal) {
      localPath = await saveImageLocally(result.imageUrl, context.slug, optionNumber, modelId);
      if (localPath) {
        console.log(`      💾 Saved: ${path.relative(process.cwd(), localPath)}`);
      }
    }
    
    // Upload to Supabase Storage
    const storagePath = await uploadToStorage(result.imageUrl, context.slug, optionNumber, modelId);
    
    // Update record with results
    await supabase
      .from('article_art_options')
      .update({
        status: 'completed',
        image_url: result.imageUrl,
        storage_path: storagePath,
        width: result.width,
        height: result.height,
        seed: result.seed,
        generation_time_ms: result.generationTimeMs,
        actual_cost_usd: result.cost,
        completed_at: new Date().toISOString(),
      })
      .eq('id', record.id);
    
    results.success++;
    
    // Small delay between models to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

function categorizeModelTier(model: FalImageModel): string {
  if (model.speedTier === 'instant' || model.speedTier === 'fast') return 'fast';
  if (model.qualityTier >= 5) return 'quality';
  if (model.category.includes('artistic')) return 'artistic';
  if (model.category.includes('balanced')) return 'balanced';
  return 'experimental';
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('🎨 MULTI-MODEL ARTICLE ART GENERATOR');
  console.log('═'.repeat(60));
  
  // Validate environment
  const falKey = process.env.FAL_KEY;
  console.log(`\n🔧 Environment:`);
  console.log(`   FAL_KEY: ${falKey ? falKey.substring(0, 12) + '...' : '❌ NOT FOUND'}`);
  console.log(`   Supabase: ${supabaseUrl ? '✅' : '❌'}`);
  console.log(`   Strategy: ${argv.strategy}`);
  console.log(`   Dry Run: ${argv.dryRun}`);
  
  if (!falKey && !argv.dryRun) {
    console.error('\n❌ FAL_KEY is required for generation');
    process.exit(1);
  }
  
  // Initialize FAL client
  const falClient = argv.dryRun ? null : new FalClient(falKey);
  
  // Get articles to process
  let articles: ArticleContext[];
  
  if (argv.article) {
    const ctx = getArticleContext(path.join(ARTICLES_DIR, `${argv.article}.mdx`));
    if (!ctx) {
      console.error(`\n❌ Article not found: ${argv.article}`);
      process.exit(1);
    }
    articles = [ctx];
  } else {
    articles = getAllArticles();
  }
  
  console.log(`\n📚 Found ${articles.length} articles`);
  
  // Filter to articles needing art
  if (!argv.force) {
    const needsArt: ArticleContext[] = [];
    for (const article of articles) {
      const hasArt = await hasExistingOptions(article.slug);
      if (!hasArt) needsArt.push(article);
    }
    articles = needsArt;
    console.log(`📋 ${articles.length} articles need art generation`);
  }
  
  // Apply limit
  if (argv.limit && argv.limit < articles.length) {
    articles = articles.slice(0, argv.limit);
    console.log(`🔢 Limited to ${articles.length} articles`);
  }
  
  if (articles.length === 0) {
    console.log('\n✅ All articles have art options!');
    return;
  }
  
  // Create batch record
  const batchId = crypto.randomUUID();
  
  if (!argv.dryRun) {
    await supabase.from('art_generation_batches').insert({
      id: batchId,
      name: `Multi-model batch ${new Date().toISOString()}`,
      article_slugs: articles.map(a => a.slug),
      total_articles: articles.length,
      total_generations: articles.length * 3,
      models_used: [...new Set(articles.flatMap(a => selectDiverseModels(a)))],
      status: 'running',
      started_at: new Date().toISOString(),
    });
  }
  
  console.log(`\n🚀 Starting generation batch: ${batchId.substring(0, 8)}...`);
  console.log(`   Articles: ${articles.length}`);
  console.log(`   Total images: ${articles.length * 3}`);
  
  // Process articles
  let totalSuccess = 0;
  let totalFailed = 0;
  
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    console.log(`\n[${i + 1}/${articles.length}]`);
    
    const results = await generateArticleArt(article, falClient!, batchId);
    totalSuccess += results.success;
    totalFailed += results.failed;
  }
  
  // Update batch status
  if (!argv.dryRun) {
    await supabase.from('art_generation_batches').update({
      completed_generations: totalSuccess,
      failed_generations: totalFailed,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', batchId);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 GENERATION COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   ✅ Success: ${totalSuccess}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  console.log(`   📁 Local output: ${OUTPUT_DIR}`);
  console.log(`   🗄️  Supabase batch: ${batchId}`);
  console.log('\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
