/**
 * Setup script for creating Supabase storage buckets for article media
 * Run with: tsx scripts/setup-media-storage.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function setupStorageBuckets() {
  console.log('🚀 Setting up Article Media Storage Buckets...\n');

  // Check if buckets already exist
  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('❌ Error listing buckets:', listError);
    process.exit(1);
  }

  const bucketNames = existingBuckets?.map((b) => b.name) || [];

  // Create article-images bucket
  console.log('📸 Creating article-images bucket...');
  if (bucketNames.includes('article-images')) {
    console.log('   ℹ️  Bucket already exists, skipping...');
  } else {
    const { data: imagesBucket, error: imagesError } = await supabase.storage.createBucket(
      'article-images',
      {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png', 'image/gif'],
      }
    );

    if (imagesError) {
      console.error('   ❌ Error creating article-images bucket:', imagesError);
    } else {
      console.log('   ✅ article-images bucket created successfully');
    }
  }

  // Create article-videos bucket
  console.log('\n🎥 Creating article-videos bucket...');
  if (bucketNames.includes('article-videos')) {
    console.log('   ℹ️  Bucket already exists, skipping...');
  } else {
    const { data: videosBucket, error: videosError } = await supabase.storage.createBucket(
      'article-videos',
      {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['video/mp4', 'video/webm'],
      }
    );

    if (videosError) {
      console.error('   ❌ Error creating article-videos bucket:', videosError);
    } else {
      console.log('   ✅ article-videos bucket created successfully');
    }
  }

  // Verify buckets were created
  console.log('\n📋 Verifying buckets...');
  const { data: finalBuckets, error: finalListError } = await supabase.storage.listBuckets();

  if (finalListError) {
    console.error('❌ Error verifying buckets:', finalListError);
    process.exit(1);
  }

  const hasImages = finalBuckets?.some((b) => b.name === 'article-images');
  const hasVideos = finalBuckets?.some((b) => b.name === 'article-videos');

  console.log('   article-images:', hasImages ? '✅' : '❌');
  console.log('   article-videos:', hasVideos ? '✅' : '❌');

  if (hasImages && hasVideos) {
    console.log('\n✨ Storage buckets setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run the database migration: supabase db push');
    console.log('2. Navigate to /admin/media-upload to start uploading media');
    console.log('3. See docs/ARTICLE_MEDIA_SYSTEM.md for full documentation');
  } else {
    console.log('\n⚠️  Some buckets failed to create. Please check errors above.');
    process.exit(1);
  }
}

// Run setup
setupStorageBuckets().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
