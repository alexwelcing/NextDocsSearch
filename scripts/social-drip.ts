/**
 * Social Drip System
 *
 * Automated article posting to social platforms every 4 hours.
 * Tracks posted articles to avoid duplicates and cycles through content.
 *
 * Usage:
 *   pnpm run social:drip           # Post next article
 *   pnpm run social:drip --preview # Preview without posting
 *   pnpm run social:drip --reset   # Reset posting history
 */

import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'

dotenv.config()

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://alexwelcing.com'
const DRIP_STATE_FILE = path.join(process.cwd(), '.drip-state.json')
const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')

interface Article {
  slug: string
  title: string
  description: string
  date: string
  keywords: string[]
  ogImage?: string
}

interface DripState {
  postedSlugs: string[]
  lastPostedAt: string | null
  totalPosted: number
}

interface PostResult {
  success: boolean
  platform: string
  postId?: string
  error?: string
}

// Load drip state
function loadDripState(): DripState {
  try {
    if (fs.existsSync(DRIP_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(DRIP_STATE_FILE, 'utf8'))
    }
  } catch (error) {
    console.error('Error loading drip state:', error)
  }
  return { postedSlugs: [], lastPostedAt: null, totalPosted: 0 }
}

// Save drip state
function saveDripState(state: DripState): void {
  fs.writeFileSync(DRIP_STATE_FILE, JSON.stringify(state, null, 2))
}

// Reset drip state
function resetDripState(): void {
  saveDripState({ postedSlugs: [], lastPostedAt: null, totalPosted: 0 })
  console.log('Drip state reset')
}

// Get all articles sorted by date (newest first)
function getAllArticles(): Article[] {
  const filenames = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.mdx'))

  return filenames.map(filename => {
    const filePath = path.join(ARTICLES_DIR, filename)
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(fileContents)

    return {
      slug: filename.replace('.mdx', ''),
      title: data.title || 'Untitled',
      description: data.description || '',
      date: data.date instanceof Date ? data.date.toISOString() : (data.date || new Date().toISOString()),
      keywords: data.keywords || [],
      ogImage: data.ogImage || null,
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// Get the next article to post
function getNextArticle(articles: Article[], state: DripState): Article | null {
  // Find articles that haven't been posted yet
  const unposted = articles.filter(a => !state.postedSlugs.includes(a.slug))

  if (unposted.length > 0) {
    // Return the oldest unposted article (to go chronologically through content)
    return unposted[unposted.length - 1]
  }

  // All articles have been posted - start cycling from the beginning
  // Reset the state and start fresh
  console.log('All articles posted! Starting new cycle...')
  state.postedSlugs = []
  const oldest = articles[articles.length - 1]
  return oldest
}

// Generate social post content
function generatePostContent(article: Article): { xPost: string; linkedInPost: string } {
  const url = `${SITE_URL}/articles/${article.slug}`
  const hashtags = article.keywords
    .slice(0, 3)
    .map(k => `#${k.replace(/\s+/g, '').replace(/-/g, '')}`)
    .join(' ')

  // X/Twitter post (280 chars max)
  const xContent = article.description.length > 180
    ? article.description.slice(0, 177) + '...'
    : article.description
  const xPost = `${article.title}\n\n${xContent}\n\n${url}\n\n${hashtags}`

  // LinkedIn post (longer form)
  const linkedInPost = `📚 New Research: ${article.title}

${article.description}

Read the full analysis: ${url}

${hashtags}

#SpeculativeAI #AIFutures #EmergentIntelligence`

  return { xPost, linkedInPost }
}

// Post to X (Twitter) using their API
async function postToX(content: string): Promise<PostResult> {
  const bearerToken = process.env.X_BEARER_TOKEN
  const apiKey = process.env.X_API_KEY
  const apiSecret = process.env.X_API_SECRET
  const accessToken = process.env.X_ACCESS_TOKEN
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET

  if (!bearerToken && !apiKey) {
    return { success: false, platform: 'x', error: 'Missing X API credentials' }
  }

  try {
    // Using Twitter API v2
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: content }),
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, platform: 'x', error }
    }

    const data = await response.json()
    return { success: true, platform: 'x', postId: data.data?.id }
  } catch (error) {
    return { success: false, platform: 'x', error: String(error) }
  }
}

// Post to LinkedIn
async function postToLinkedIn(content: string): Promise<PostResult> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN
  const personUrn = process.env.LINKEDIN_PERSON_URN // format: urn:li:person:XXXXX

  if (!accessToken || !personUrn) {
    return { success: false, platform: 'linkedin', error: 'Missing LinkedIn credentials' }
  }

  try {
    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: content },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return { success: false, platform: 'linkedin', error }
    }

    const data = await response.json()
    return { success: true, platform: 'linkedin', postId: data.id }
  } catch (error) {
    return { success: false, platform: 'linkedin', error: String(error) }
  }
}

// Main drip function
async function runDrip(preview: boolean = false): Promise<void> {
  console.log('\n🚰 Social Drip System\n')
  console.log(`Mode: ${preview ? 'PREVIEW (no posts will be made)' : 'LIVE'}\n`)

  const state = loadDripState()
  const articles = getAllArticles()

  console.log(`📊 Stats:`)
  console.log(`   Total articles: ${articles.length}`)
  console.log(`   Already posted: ${state.postedSlugs.length}`)
  console.log(`   Last post: ${state.lastPostedAt || 'Never'}\n`)

  const nextArticle = getNextArticle(articles, state)

  if (!nextArticle) {
    console.log('❌ No articles available to post')
    return
  }

  console.log(`📄 Next Article:`)
  console.log(`   Title: ${nextArticle.title}`)
  console.log(`   Slug: ${nextArticle.slug}`)
  console.log(`   Date: ${nextArticle.date}`)
  console.log(`   URL: ${SITE_URL}/articles/${nextArticle.slug}\n`)

  const { xPost, linkedInPost } = generatePostContent(nextArticle)

  console.log(`📝 X/Twitter Post (${xPost.length} chars):`)
  console.log(`   ${xPost.split('\n').join('\n   ')}\n`)

  console.log(`📝 LinkedIn Post (${linkedInPost.length} chars):`)
  console.log(`   ${linkedInPost.split('\n').join('\n   ')}\n`)

  if (preview) {
    console.log('✅ Preview complete (no posts made)')
    return
  }

  // Post to platforms
  console.log('🚀 Posting to platforms...\n')

  const results: PostResult[] = []

  // Post to X
  console.log('   Posting to X...')
  const xResult = await postToX(xPost)
  results.push(xResult)
  if (xResult.success) {
    console.log(`   ✅ X: Posted (ID: ${xResult.postId})`)
  } else {
    console.log(`   ⚠️ X: ${xResult.error}`)
  }

  // Post to LinkedIn
  console.log('   Posting to LinkedIn...')
  const linkedInResult = await postToLinkedIn(linkedInPost)
  results.push(linkedInResult)
  if (linkedInResult.success) {
    console.log(`   ✅ LinkedIn: Posted (ID: ${linkedInResult.postId})`)
  } else {
    console.log(`   ⚠️ LinkedIn: ${linkedInResult.error}`)
  }

  // Update state if at least one post succeeded
  const anySuccess = results.some(r => r.success)
  if (anySuccess) {
    state.postedSlugs.push(nextArticle.slug)
    state.lastPostedAt = new Date().toISOString()
    state.totalPosted++
    saveDripState(state)
    console.log('\n✅ Drip state updated')
  } else {
    console.log('\n⚠️ No successful posts - state not updated')
  }

  console.log('\n📊 Final Results:')
  results.forEach(r => {
    console.log(`   ${r.platform}: ${r.success ? '✅ Success' : '❌ Failed'}`)
  })
}

// Get next scheduled article (for API/display)
function getNextScheduledArticle(): { article: Article; posts: { xPost: string; linkedInPost: string } } | null {
  const state = loadDripState()
  const articles = getAllArticles()
  const nextArticle = getNextArticle(articles, state)

  if (!nextArticle) return null

  const posts = generatePostContent(nextArticle)
  return { article: nextArticle, posts }
}

// CLI handling
const args = process.argv.slice(2)

if (args.includes('--reset')) {
  resetDripState()
} else if (args.includes('--next')) {
  // Just show next article
  const next = getNextScheduledArticle()
  if (next) {
    console.log(JSON.stringify(next, null, 2))
  } else {
    console.log('No articles available')
  }
} else {
  const preview = args.includes('--preview') || args.includes('-p')
  runDrip(preview)
}

export { getNextScheduledArticle, getAllArticles, loadDripState }
