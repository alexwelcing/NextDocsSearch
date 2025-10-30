/**
 * Art Style Configuration for NextDocsSearch Blog
 *
 * This defines the signature visual style for all blog article images.
 * The style is: Modern, Abstract Geometric, Tech-focused with AI elements
 */

export const BLOG_ART_STYLE = {
  name: "NextDocs Quantum Aesthetic",
  description: "A unique blend of abstract geometry, data visualization, and futuristic tech elements",

  // Core visual elements
  elements: [
    "abstract geometric shapes",
    "flowing data streams",
    "interconnected nodes and networks",
    "subtle circuit patterns",
    "holographic overlays",
    "particle systems",
    "gradient meshes",
  ],

  // Color palette
  colors: {
    primary: ["deep indigo", "electric blue", "cyberpunk purple"],
    secondary: ["teal", "mint green", "coral pink"],
    accents: ["golden yellow", "bright cyan", "magenta"],
    background: ["dark navy", "deep space black", "midnight blue"],
  },

  // Mood and atmosphere
  mood: [
    "futuristic",
    "professional",
    "innovative",
    "clean",
    "sophisticated",
    "tech-forward",
  ],

  // Composition rules
  composition: [
    "minimalist composition",
    "negative space",
    "rule of thirds",
    "depth and layering",
    "subtle glow effects",
  ],

  // Style modifiers
  style: [
    "modern digital art",
    "vector illustration style",
    "gradient mesh technique",
    "isometric perspective (occasional)",
    "3D rendered look",
  ],

  // Quality directives
  quality: [
    "high detail",
    "sharp and crisp",
    "professional design",
    "award-winning",
  ],
}

/**
 * Generate the base style prompt that will be consistent across all images
 */
export function getBaseStylePrompt(): string {
  return `
Modern abstract digital art in a sophisticated tech style.
Visual elements: ${BLOG_ART_STYLE.elements.slice(0, 4).join(", ")}.
Color palette: ${BLOG_ART_STYLE.colors.primary.join(", ")} with accents of ${BLOG_ART_STYLE.colors.accents.slice(0, 2).join(" and ")}.
Mood: ${BLOG_ART_STYLE.mood.slice(0, 3).join(", ")}.
Composition: ${BLOG_ART_STYLE.composition.slice(0, 3).join(", ")}.
Style: ${BLOG_ART_STYLE.style.slice(0, 2).join(", ")}, ${BLOG_ART_STYLE.quality.slice(0, 2).join(", ")}.
  `.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ')
}

/**
 * Generate a topic-specific prompt for an article
 */
export function generateArticlePrompt(
  title: string,
  description: string,
  keywords: string[]
): string {
  const baseStyle = getBaseStylePrompt()

  // Extract key themes from keywords
  const themes = keywords.slice(0, 3).join(", ")

  // Create a concise topic description
  const topicFocus = `representing the concept of: ${title}. Key themes: ${themes}.`

  return `${baseStyle}

Topic-specific elements: ${topicFocus}

The artwork should visually represent the article's theme while maintaining the signature NextDocs Quantum Aesthetic.
No text, no words, no letters in the image. Pure abstract visual representation.`
}

/**
 * Generate prompts for different image sizes/purposes
 */
export function generateImagePrompts(
  title: string,
  description: string,
  keywords: string[]
) {
  const basePrompt = generateArticlePrompt(title, description, keywords)

  return {
    // Hero image - wider format, more breathing room
    hero: `${basePrompt} Wide landscape format with extra negative space for text overlay.`,

    // Open Graph image - must work at small sizes
    og: `${basePrompt} Centered composition optimized for social media preview (1200x630). Bold, clear focal point.`,

    // Thumbnail - simplified version
    thumbnail: `${basePrompt} Simplified composition with one strong focal element. Works well at small sizes.`,
  }
}

/**
 * Get image generation parameters for DALL-E 3
 */
export function getImageGenerationParams(type: 'hero' | 'og' | 'thumbnail') {
  const sizeMap = {
    hero: '1792x1024' as const,  // Wide landscape
    og: '1792x1024' as const,    // Will be cropped to 1200x630
    thumbnail: '1024x1024' as const,  // Square
  }

  return {
    model: 'dall-e-3',
    size: sizeMap[type],
    quality: 'hd' as const,
    n: 1,
    style: 'vivid' as const,  // More hyper-real and dramatic
  }
}
