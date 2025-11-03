# Build Process with Automated Image Generation

This project automatically generates AI-powered article images during the build process using OpenAI's DALL-E 3.

## How It Works

### During Build (`pnpm run build`)

The build process now includes three steps:

1. **Image Generation** (if OPENAI_KEY is set)
   - Automatically generates images for articles that don't have them
   - Skips articles with existing images (saves costs)
   - Gracefully skips if no API key is available

2. **Embeddings Generation**
   - Generates search embeddings for articles

3. **Next.js Build**
   - Builds the production site

### Build Scripts

```json
{
  "prebuild": "pnpm run generate:art:safe && pnpm run embeddings",
  "build": "next build",
  "postbuild": "next-sitemap"
}
```

## Environment Variables

### Local Development

Create a `.env.local` file:

```bash
OPENAI_KEY=sk-your-openai-api-key-here
```

### CI/CD (GitHub Actions, Vercel, etc.)

Set the `OPENAI_KEY` environment variable in your CI/CD platform:

**GitHub Actions:**
```yaml
env:
  OPENAI_KEY: ${{ secrets.OPENAI_KEY }}
```

**Vercel:**
- Go to Project Settings → Environment Variables
- Add `OPENAI_KEY` with your API key

**Other platforms:**
- Add `OPENAI_KEY` to your build environment variables

## Cost Management

### Automatic Cost Optimization

The build process is designed to minimize costs:

- ✅ **Skips existing images** - Only generates missing artwork
- ✅ **No redundant generation** - Images persist across builds
- ✅ **Commit images to git** - Reuse across all environments
- ✅ **Optional API key** - Builds succeed without it

### Expected Costs

- **First build**: ~$2.16 USD (27 articles × $0.08)
- **Subsequent builds**: $0.00 USD (images already exist)
- **New articles only**: $0.08 USD per new article

### Cost Estimate Before Building

```bash
# See what will be generated and estimated cost
pnpm run generate:art:dry-run
```

## Build Scenarios

### Scenario 1: Build WITH API Key

```bash
export OPENAI_KEY=sk-your-key
pnpm run build
```

**Result:**
- ✅ Generates images for new articles
- ✅ Skips existing images
- ✅ Completes full build

### Scenario 2: Build WITHOUT API Key

```bash
pnpm run build
```

**Result:**
- ⚠️ Skips image generation with warning
- ✅ Uses existing committed images
- ✅ Completes full build successfully

### Scenario 3: CI/CD Build

```bash
# GitHub Actions, Vercel, etc.
CI=true pnpm run build
```

**Result:**
- ✅ Automatically skips 5-second confirmation
- ✅ Generates only missing images (if key set)
- ✅ Fast, automated build process

## Manual Image Generation

### Generate All Missing Images

```bash
pnpm run generate:art
```

### Generate for Specific Article

```bash
pnpm run generate:art -- --article your-article-slug
```

### Regenerate All Images

```bash
pnpm run generate:art:force
```

### Preview Without Generating

```bash
pnpm run generate:art:dry-run
```

## Recommended Workflow

### For Development

1. **Commit existing images to git**
   ```bash
   git add public/images/articles/ public/images/og/
   git commit -m "Add article images"
   ```

2. **Set OPENAI_KEY locally** (only if generating new images)
   ```bash
   echo "OPENAI_KEY=sk-your-key" >> .env.local
   ```

3. **Build normally**
   ```bash
   pnpm run build
   ```

### For Production/CI

1. **Set OPENAI_KEY in CI environment variables**
   - This allows automatic image generation for new articles

2. **Deploy normally**
   - CI will generate images for new articles automatically
   - Existing images are reused from git

### Alternative: Pre-generate Images

If you want to avoid API calls in CI entirely:

1. **Generate images locally**
   ```bash
   pnpm run generate:art
   ```

2. **Commit images to git**
   ```bash
   git add public/images/
   git commit -m "Add generated article images"
   ```

3. **Don't set OPENAI_KEY in CI**
   - Build will use committed images
   - No API costs in CI

## Troubleshooting

### "OPENAI_KEY not found"

**This is normal** if you haven't set the API key. The build will continue successfully using existing images.

**To fix**: Set the OPENAI_KEY environment variable (see above).

### "Image generation encountered errors"

The build will continue successfully. Generate images manually:

```bash
pnpm run generate:art
```

### "Access denied" or "Connection error"

Check that your OpenAI API key is:
- Valid and not expired
- Has DALL-E 3 access
- Has sufficient credits (~$2.16 for all images)

### Build is slow

The first build with image generation takes ~30-60 seconds (27 images).
Subsequent builds are fast since images are cached.

To skip image generation entirely:
```bash
# Temporarily rename .env.local
mv .env.local .env.local.backup
pnpm run build
mv .env.local.backup .env.local
```

## Architecture

### Files

- `lib/generate-article-art.ts` - Main image generation script
- `lib/generate-article-art-safe.ts` - Build-safe wrapper
- `lib/art-generation/image-generator.ts` - OpenAI integration
- `lib/art-generation/art-style.ts` - Style definitions

### Image Output

```
public/images/
├── articles/           # Hero images (1792×1024)
│   ├── article-1.jpg
│   └── article-2.jpg
└── og/                # Open Graph images (1200×630)
    ├── article-1.jpg
    └── article-2.jpg
```

### Article Frontmatter

Images are automatically referenced:

```yaml
---
title: "Your Article"
ogImage: "/images/og/your-article.jpg"
---
```

## Best Practices

1. ✅ **Commit images to git** - Avoid regenerating on every deployment
2. ✅ **Set OPENAI_KEY in CI** - Automatically handle new articles
3. ✅ **Monitor costs** - Use dry-run to preview before generating
4. ✅ **Generate locally first** - Review images before committing
5. ✅ **Use .env.local** - Never commit API keys to git

## FAQ

**Q: Will builds fail without OPENAI_KEY?**
A: No. Builds succeed without the key, using existing images.

**Q: How much does image generation cost?**
A: $0.08 per image (DALL-E 3 HD). First build: ~$2.16 for 27 images.

**Q: Can I disable automatic generation?**
A: Yes. Don't set OPENAI_KEY in your build environment.

**Q: How do I regenerate a bad image?**
A: `pnpm run generate:art -- --article slug-name --force`

**Q: Are images committed to git?**
A: Yes, recommended. Add to `.gitignore` to exclude them.

---

**Ready to build with automated image generation!** 🚀
