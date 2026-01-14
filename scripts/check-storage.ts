
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = 'sb_publishable_oZ8eD7313M9O8BKZff8-0A_howeh8mE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Checking images bucket...');
  const { data, error } = await supabase.storage.from('images').list();
  
  if (error) {
    console.error('Error listing bucket:', error);
  } else {
    console.log('Root files:', data.map(f => f.name));
  }
  
  // Try to upload a dummy text file
  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload('test-upload.txt', 'Hello world', { upsert: true });

  if (uploadError) {
    console.error('Upload text error:', uploadError);
  } else {
    console.log('Upload text success');
  }

  // Try to upload a dummy video file (small)
  const videoBuffer = Buffer.from('fake video content');
  const { error: videoError } = await supabase.storage
    .from('images')
    .upload('videos/test.mp4', videoBuffer, { contentType: 'video/mp4', upsert: true });

  if (videoError) {
    console.error('Upload video error:', videoError);
  } else {
    console.log('Upload video success');
  }
}

main();
