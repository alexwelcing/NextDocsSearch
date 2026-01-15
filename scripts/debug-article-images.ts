import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function debugArticleImages() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check for the article from the screenshot
  const slug = 'when-post-scarcity-destroyed-civilization-infinite-abundance-zero-motivation';

  console.log(`\n🔍 Checking images for article: ${slug}\n`);

  // Check article_art_options
  const { data: artworkData, error: artworkError } = await supabase
    .from('article_art_options')
    .select('*')
    .eq('article_slug', slug)
    .order('created_at', { ascending: false });

  if (artworkError) {
    console.error('❌ Error fetching artwork:', artworkError);
  } else {
    console.log(`📊 Found ${artworkData?.length || 0} artwork records`);
    if (artworkData && artworkData.length > 0) {
      console.log('\nArtwork details:');
      artworkData.forEach((art, i) => {
        console.log(`\n  ${i + 1}. ID: ${art.id}`);
        console.log(`     Model: ${art.model_name}`);
        console.log(`     Status: ${art.status}`);
        console.log(`     Selected: ${art.is_selected}`);
        console.log(`     Image URL: ${art.image_url?.substring(0, 80)}...`);
        console.log(`     Storage Path: ${art.storage_path || 'none'}`);
        console.log(`     Created: ${art.created_at}`);
      });
    }
  }

  // Check article_media
  const { data: mediaData, error: mediaError } = await supabase
    .from('article_media')
    .select('*')
    .eq('article_slug', slug);

  if (mediaError) {
    console.error('\n❌ Error fetching media:', mediaError);
  } else {
    console.log(`\n📷 Found ${mediaData?.length || 0} media records`);
    if (mediaData && mediaData.length > 0) {
      mediaData.forEach((media, i) => {
        console.log(`\n  ${i + 1}. ID: ${media.id}`);
        console.log(`     Type: ${media.media_type}`);
        console.log(`     Status: ${media.status}`);
        console.log(`     Storage Path: ${media.storage_path}`);
      });
    }
  }

  // List all buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (!bucketsError && buckets) {
    console.log(`\n🪣 Available storage buckets:`);
    buckets.forEach(bucket => {
      console.log(`   - ${bucket.name}`);
    });
  }
}

debugArticleImages().catch(console.error);
