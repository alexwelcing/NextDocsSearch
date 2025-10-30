# Article Art Generation - Quick Start Guide

> Generate unique AI artwork for your blog in 3 simple steps

## What You Get

🎨 **Signature Visual Style**: The "NextDocs Quantum Aesthetic"
- Abstract geometric shapes with data visualization elements
- Modern tech-focused color palette (blues, purples, teals)
- Consistent brand identity across all articles

📐 **Two Image Formats Per Article**:
- **Hero Image**: 1792×1024 (for article headers)
- **OG Image**: 1200×630 (for social media previews)

🤖 **Powered by DALL-E 3**:
- High quality HD images
- Unique artwork for every article
- Auto-generated from article metadata

## Prerequisites

1. **OpenAI API Key**: Get one at https://platform.openai.com/api-keys

2. **Add to .env.local**:
   ```bash
   OPENAI_KEY=sk-proj-...your-key-here
   ```

3. **Verify dependencies** (should already be installed):
   ```bash
   pnpm install
   ```

## Quick Start

### Step 1: Preview (No Cost)

See what will be generated without making API calls:

```bash
pnpm run generate:art:dry-run
```

This shows:
- Articles that need artwork
- Cost estimate
- What would be generated

### Step 2: Generate Art

Generate artwork for all articles missing images:

```bash
pnpm run generate:art
```

The system will:
- Show cost estimate (~$0.08 per article)
- Wait 5 seconds (time to cancel with Ctrl+C)
- Generate artwork for each article
- Save images to `public/images/`
- Update article frontmatter automatically

### Step 3: Verify Results

Check the generated images:

```bash
# Hero images (1792×1024)
ls -lh public/images/articles/

# OG images (1200×630)
ls -lh public/images/og/
```

View in your articles at: `http://localhost:3000/articles/[slug]`

## Commands Reference

```bash
# Generate for articles without images
pnpm run generate:art

# Preview without generating
pnpm run generate:art:dry-run

# Regenerate missing images
pnpm run generate:art:refresh

# Force regenerate ALL images
pnpm run generate:art:force

# Generate for one article
pnpm run generate:art -- --article your-slug

# Generate first 5 only
pnpm run generate:art -- --limit 5
```

## Example Session

```bash
$ pnpm run generate:art:dry-run

🎨 NextDocs Article Art Generator
================================

📚 Found 17 article(s)

💰 Cost Estimate:
   Images to generate: 17
   Estimated cost: $1.36 USD
   (DALL-E 3 HD: $0.080 per image)

🏃 DRY RUN - No images will be generated

1. eu-ai-act-article-13-exemption
   Title: The AI Act Article 13 Exemption
   Keywords: EU AI Act, Article 13, AI Regulation

2. meta-quest-3
   Title: Meta Quest 3: The Future of VR
   Keywords: Meta Quest 3, VR, Virtual Reality

...
```

```bash
$ pnpm run generate:art -- --limit 1

🎨 NextDocs Article Art Generator
================================

📚 Found 17 article(s)

💰 Cost Estimate:
   Images to generate: 1
   Estimated cost: $0.08 USD

⚠️  This will generate images using OpenAI DALL-E 3.
   Press Ctrl+C to cancel, or wait 5 seconds to continue...

[1/1] Processing: eu-ai-act-article-13-exemption
Title: The AI Act Article 13 Exemption

🎨 Generating image with DALL-E 3...
   Size: 1792x1024
   Quality: hd
✅ Image generated successfully
💾 Image downloaded to: public/images/temp-eu-ai-act-article-13-exemption.png
🖼️  Creating hero image...
✅ Hero image created: public/images/articles/eu-ai-act-article-13-exemption.jpg
🖼️  Creating OG image (1200x630)...
✅ OG image created: public/images/og/eu-ai-act-article-13-exemption.jpg
📝 Updated frontmatter in eu-ai-act-article-13-exemption.mdx
✅ Success! Generated artwork for: eu-ai-act-article-13-exemption

============================================================
🎉 Article Art Generation Complete!
============================================================
✅ Successful: 1
❌ Failed: 0
💰 Actual cost: ~$0.08 USD

📁 Images saved to:
   - Hero images: public/images/articles/
   - OG images: public/images/og/
```

## Cost Management

### Pricing
- DALL-E 3 HD (1792×1024): **$0.08 per image**
- Your 17 articles: **~$1.36 total**

### Tips
1. **Use dry-run first**: Preview before spending
2. **Generate in batches**: Use `--limit 5` to control costs
3. **Skip existing**: Default behavior saves money
4. **Commit images to git**: Avoid regenerating on every deploy

### Optional: Add to .gitignore

If you DON'T want to commit generated images (will need to regenerate):

```bash
# Add to .gitignore
echo "public/images/articles/" >> .gitignore
echo "public/images/og/" >> .gitignore
```

If you DO want to commit images (recommended):
- Just commit them normally
- Only regenerate when you want new art

## The Art Style

### "NextDocs Quantum Aesthetic"

**Visual Elements**:
- Abstract geometric shapes
- Flowing data streams
- Interconnected networks
- Circuit patterns & holographic effects

**Colors**:
- Primary: Deep indigo, electric blue, cyberpunk purple
- Accents: Teal, golden yellow, bright cyan
- Background: Dark navy, deep space black

**Mood**: Futuristic, professional, innovative, tech-forward

### Customization

Want to change the style? Edit:
```
lib/art-generation/art-style.ts
```

Modify colors, elements, composition rules, etc.

## Troubleshooting

### "OPENAI_KEY environment variable is not set"

**Solution**: Create `.env.local` with your API key:
```bash
echo "OPENAI_KEY=sk-your-key-here" > .env.local
```

### Images look wrong

**Solution**: Regenerate with force flag:
```bash
pnpm run generate:art -- --article problematic-slug --force
```

Each generation is unique - try a few times for best results.

### Rate limit errors

**Solution**: Use smaller batches:
```bash
pnpm run generate:art -- --limit 3
```

Wait between batches if needed.

## Next Steps

1. ✅ Generate artwork for your articles
2. 📝 Review and commit the images
3. 🚀 Deploy and see them on social media shares
4. 🎨 Customize the art style if desired
5. ♻️ Regenerate individual articles as needed

## Learn More

- Full documentation: `lib/art-generation/README.md`
- Art style config: `lib/art-generation/art-style.ts`
- Generator code: `lib/generate-article-art.ts`

---

**Ready to create stunning artwork for your blog? Run the dry-run command to get started! 🚀**
