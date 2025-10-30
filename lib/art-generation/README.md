# NextDocs Article Art Generation System

> Automated AI-powered artwork generation for blog articles using a signature visual style

## Overview

This system generates unique, consistent artwork for all blog articles using OpenAI's DALL-E 3. Each image is created in the **NextDocs Quantum Aesthetic** - a signature style that combines abstract geometry, data visualization, and futuristic tech elements.

## The NextDocs Quantum Aesthetic

### Visual Style

Our signature art style features:

- **Abstract geometric shapes** with flowing data streams
- **Interconnected networks** and circuit patterns
- **Holographic overlays** with particle systems
- **Gradient meshes** and depth layering

### Color Palette

- **Primary**: Deep indigo, electric blue, cyberpunk purple
- **Secondary**: Teal, mint green, coral pink
- **Accents**: Golden yellow, bright cyan, magenta
- **Background**: Dark navy, deep space black, midnight blue

### Mood

Futuristic • Professional • Innovative • Clean • Sophisticated • Tech-forward

## Usage

### Prerequisites

1. Set your OpenAI API key in `.env.local`:
   ```bash
   OPENAI_KEY=sk-...
   ```

2. Ensure dependencies are installed:
   ```bash
   pnpm install
   ```

### Generate Art for All Articles

```bash
# Generate art for articles that don't have images yet
pnpm run generate:art

# Regenerate art for articles without images
pnpm run generate:art:refresh

# Force regenerate all art (overwrites existing)
pnpm run generate:art:force

# Preview what would be generated (no API calls)
pnpm run generate:art:dry-run
```

### Generate Art for a Specific Article

```bash
# Generate art for a single article by slug
pnpm run generate:art -- --article your-article-slug

# Example:
pnpm run generate:art -- --article eu-ai-act-deadlines-for-us-pms
```

### Advanced Options

```bash
# Limit number of images to generate
pnpm run generate:art -- --limit 5

# Combine options
pnpm run generate:art -- --refresh --limit 10
```

## How It Works

### 1. Article Analysis

The system reads each article's frontmatter:
- **Title**: Used as the primary concept
- **Description**: Provides context
- **Keywords**: Extracted as visual themes

### 2. Prompt Generation

Each article gets a custom prompt that combines:
- The signature base style (consistent across all images)
- Topic-specific elements from the article metadata
- Composition and quality directives

Example prompt structure:
```
Modern abstract digital art in a sophisticated tech style.
Visual elements: abstract geometric shapes, flowing data streams...
Color palette: deep indigo, electric blue...
Topic: The AI Act Article 13 Exemption
Key themes: EU AI Act, Article 13, AI Regulation
```

### 3. Image Generation

- **Model**: DALL-E 3
- **Quality**: HD (high definition)
- **Style**: Vivid (hyper-real and dramatic)
- **Sizes**:
  - Hero image: 1792×1024 (wide landscape)
  - OG image: 1200×630 (cropped for social media)

### 4. Automatic Frontmatter Update

The system automatically updates each article's frontmatter with the new image path:

```yaml
---
title: "Your Article Title"
ogImage: "/images/og/your-article-slug.jpg"
---
```

## Cost

### DALL-E 3 Pricing

- **HD quality (1792×1024)**: $0.080 per image
- The system shows cost estimates before generating
- Example: 17 articles = ~$1.36 USD

### Cost Optimization

- Use `--dry-run` to preview before generating
- Use `--limit` to generate in batches
- The system skips existing images by default

## Output

### Directory Structure

```
public/images/
├── articles/           # Hero images (1792×1024)
│   ├── article-slug-1.jpg
│   ├── article-slug-2.jpg
│   └── ...
└── og/                # Open Graph images (1200×630)
    ├── article-slug-1.jpg
    ├── article-slug-2.jpg
    └── ...
```

### Image Specifications

**Hero Images** (`/images/articles/`)
- Size: 1792×1024 pixels
- Format: JPEG (90% quality)
- Purpose: Article headers, featured images
- Optimized with Sharp for web delivery

**OG Images** (`/images/og/`)
- Size: 1200×630 pixels
- Format: JPEG (90% quality)
- Purpose: Social media previews (Twitter, LinkedIn, Facebook)
- Cropped from center of hero image

## Customization

### Modify the Art Style

Edit `lib/art-generation/art-style.ts` to customize:

```typescript
export const BLOG_ART_STYLE = {
  name: "Your Custom Style Name",
  elements: ["your", "visual", "elements"],
  colors: {
    primary: ["color1", "color2"],
    // ...
  },
  mood: ["mood1", "mood2"],
  // ...
}
```

### Adjust Image Generation Parameters

In `art-style.ts`, modify:

```typescript
export function getImageGenerationParams(type: 'hero' | 'og' | 'thumbnail') {
  return {
    model: 'dall-e-3',
    size: '1792x1024',  // Change size
    quality: 'hd',       // or 'standard' for lower cost
    style: 'vivid',      // or 'natural' for less dramatic
  }
}
```

## Troubleshooting

### API Key Not Found

```
❌ Error: OPENAI_KEY environment variable is not set
```

**Solution**: Add `OPENAI_KEY=sk-...` to `.env.local`

### Rate Limit Errors

The system includes automatic 1-second delays between requests. If you hit rate limits:
- Use `--limit` to generate fewer images at once
- Wait and try again later

### Image Quality Issues

To regenerate a specific image with better results:
```bash
pnpm run generate:art -- --article your-slug --force
```

The prompt will be slightly revised by OpenAI each time, potentially yielding better results.

### Out of Memory

For large batches, process in smaller chunks:
```bash
pnpm run generate:art -- --limit 5
```

## Integration with Build Process

To automatically generate art during builds, add to `package.json`:

```json
{
  "scripts": {
    "build": "pnpm run generate:art && pnpm run embeddings && next build"
  }
}
```

**Note**: This will increase build times and incur API costs on every build. Recommended only for production builds.

## Examples

### Generate art for all new articles
```bash
pnpm run generate:art
```

### Test the system without spending money
```bash
pnpm run generate:art:dry-run
```

### Regenerate art for a specific article
```bash
pnpm run generate:art -- --article meta-quest-3 --force
```

### Generate art for the first 3 articles only
```bash
pnpm run generate:art -- --limit 3
```

## Architecture

```
lib/art-generation/
├── art-style.ts          # Style definitions and prompt generation
├── image-generator.ts    # DALL-E 3 API integration
└── README.md            # This file

lib/
└── generate-article-art.ts  # Main CLI script

public/images/
├── articles/            # Generated hero images
└── og/                  # Generated OG images
```

## Future Enhancements

Potential improvements for the system:

- [ ] A/B testing different prompts for the same article
- [ ] Manual prompt override via article frontmatter
- [ ] Image variation generation (multiple options per article)
- [ ] Automated quality scoring
- [ ] Integration with CDN for image optimization
- [ ] Thumbnail generation for article listings
- [ ] Dark mode / light mode variants

## Support

For issues or questions about the art generation system:
1. Check this README
2. Review the console output for error messages
3. Check OpenAI status at status.openai.com
4. Verify your API key has sufficient credits

---

**Happy generating! 🎨**
