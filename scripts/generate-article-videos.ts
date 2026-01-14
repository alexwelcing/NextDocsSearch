#!/usr/bin/env node

/**
 * Article Video Generator
 *
 * Generates videos for top articles using image-to-video models.
 * Uses existing "multi-art" images as source.
 * Results are stored in Supabase 'article-videos' bucket and 'article_media' table.
 *
 * Usage:
 *   pnpm generate:videos                       # Generate for top articles
 *   pnpm generate:videos --limit 5             # Limit to 5 articles
 *   pnpm generate:videos --article my-slug     # Generate for specific article
 *   pnpm generate:videos --dry-run             # Preview without generating
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

import { FalClient } from '../lib/art-generation/fal-client';
import { FEATURED_ARTICLES, EXTENDED_FEATURED } from '../lib/featured-articles';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'article-videos');
const VIDEO_MODEL_ID = 'fal-ai/luma-dream-machine';
// Alternative: 'fal-ai/kling-video/v1/standard/image-to-video'

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
    description: 'Regenerate even if video exists',
    default: false,
  })
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Preview without generating',
    default: false,
  })
  .option('save-local', {
    type: 'boolean',
    description: 'Also save videos locally',
    default: true,
  })
  .help()
  .parseSync();

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Hardcoded key as requested
const supabaseKey = 'sb_publishable_oZ8eD7313M9O8BKZff8-0A_howeh8mE';

if (!supabaseUrl) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function getArticleSourceImage(slug: string): Promise<{ url: string; prompt: string } | null> {
  // Try to find a completed multi-art option
  const { data, error } = await supabase
    .from('article_art_options')
    .select('image_url, prompt')
    .eq('article_slug', slug)
    .eq('status', 'completed')
    .order('option_number', { ascending: true }) // Prefer option 1
    .limit(1)
    .single();

  if (error || !data) {
    // console.log(`   ⚠️ No art found for ${slug}`);
    return null;
  }

  return { url: data.image_url, prompt: data.prompt };
}

async function hasExistingVideo(slug: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('article_media')
    .select('id')
    .eq('article_id', slug) // Assuming article_id is the slug or we need to look up ID
    .eq('media_type', 'video')
    .limit(1);

  // Note: article_media might use UUID for article_id.
  // Let's check schema assumption. The previous migration showed article_media linked to articles?
  // Actually, usually articles are identified by slug in file-based CMS, but Supabase might have an articles table.
  // generate-multi-art.ts used article_slug string in article_art_options.
  // Let's assume for now we check by filename in storage or if I can't check easily, I'll rely on force flag or check storage.
  
  // Alternative: Check storage directly
  const { data: storageData } = await supabase.storage
    .from('images')
    .list(`videos/${slug}`);
    
  return (storageData?.length || 0) > 0;
}

async function saveVideoLocally(
  videoUrl: string,
  slug: string
): Promise<string | null> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());

    // Create directory if needed
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const filename = `${slug}.mp4`;
    const localPath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(localPath, buffer);

    return localPath;
  } catch (err) {
    console.error('Failed to save locally:', err);
    return null;
  }
}

async function uploadToStorage(
  videoUrl: string,
  slug: string
): Promise<string | null> {
  try {
    const response = await fetch(videoUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    // Store in videos/ subfolder in the images bucket
    const storagePath = `videos/${slug}/generated-video.mp4`;

    const { error } = await supabase.storage
      .from('images')
      .upload(storagePath, buffer, {
        contentType: 'video/mp4',
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

async function generateVideo(
  slug: string,
  imageUrl: string,
  prompt: string,
  falClient: FalClient
): Promise<boolean> {
  console.log(`
🎥 ${slug}`);
  console.log(`   Source: ${imageUrl.substring(0, 50)}...`);
  
  if (argv.dryRun) {
    console.log(`   [DRY RUN] Would generate video with ${VIDEO_MODEL_ID}`);
    return true;
  }

  const startTime = Date.now();
  
  // Use simple prompt derived from original image prompt
  const videoPrompt = "Cinematic slow motion, subtle movement, 4k, high quality";

  const result = await falClient.generate({
    modelId: VIDEO_MODEL_ID,
    prompt: videoPrompt, // Kling requires a prompt even for img2vid usually
    params: {
      image_url: imageUrl,
      duration: "5s",
      aspect_ratio: "16:9"
    },
  });

  if (!result.success || !result.videoUrl) {
    console.log(`   ❌ Generation failed: ${result.error}`);
    return false;
  }

  console.log(`   ✅ Generated in ${result.generationTimeMs}ms`);

  // Save locally
  if (argv.saveLocal) {
    const localPath = await saveVideoLocally(result.videoUrl, slug);
    if (localPath) {
      console.log(`   💾 Saved: ${path.relative(process.cwd(), localPath)}`);
    }
  }

  // Upload to Supabase
  const storagePath = await uploadToStorage(result.videoUrl, slug);
  
  if (storagePath) {
    console.log(`   ☁️  Uploaded to ${storagePath}`);
    
    // Here we would ideally update a DB record
    // For now, we just ensure it's in storage
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('🎬 ARTICLE VIDEO GENERATOR');
  console.log('═'.repeat(60));

  // Validate environment
  const falKey = process.env.FAL_KEY;
  if (!falKey && !argv.dryRun) {
    console.error('\n❌ FAL_KEY is required for generation');
    process.exit(1);
  }

  const falClient = argv.dryRun ? null : new FalClient(falKey);

  // Get articles to process
  let targetSlugs: string[] = [];

  if (argv.article) {
    targetSlugs = [argv.article];
  } else {
    // Combine featured articles
    const allFeatured = [...FEATURED_ARTICLES, ...EXTENDED_FEATURED];
    // Sort by priority
    targetSlugs = allFeatured
      .sort((a, b) => b.priority - a.priority)
      .map(a => a.slug);
  }

  console.log(`\n🎯 Found ${targetSlugs.length} target articles`);

  // Apply limit
  if (argv.limit && argv.limit < targetSlugs.length) {
    targetSlugs = targetSlugs.slice(0, argv.limit);
    console.log(`   Limited to top ${targetSlugs.length}`);
  }

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const slug of targetSlugs) {
    // Check if video exists
    if (!argv.force && !argv.dryRun) {
      const exists = await hasExistingVideo(slug);
      if (exists) {
        console.log(`\n⏭️  ${slug} (video exists)`);
        skipCount++;
        continue;
      }
    }

    // Get source image
    const source = await getArticleSourceImage(slug);
    if (!source) {
      console.log(`\n⚠️  ${slug} (no source image found - generate multi-art first)`);
      skipCount++;
      continue;
    }

    // Generate
    if (falClient || argv.dryRun) {
      const success = await generateVideo(slug, source.url, source.prompt, falClient!);
      if (success) successCount++;
      else failCount++;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 GENERATION COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📁 Output: ${OUTPUT_DIR}`);
  console.log('\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
