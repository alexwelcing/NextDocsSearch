#!/usr/bin/env node

/**
 * Capture screenshots for each feature section in the NextDocsSearch guide article.
 * Outputs PNGs to public/images/screenshots/nextdocssearch/
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'images', 'screenshots', 'nextdocssearch')

/** Navigate, set localStorage to skip intro, then reload */
async function gotoWithSkippedIntro(page, urlPath) {
  await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.evaluate(() => localStorage.setItem('hasWatchedIntro', 'true'))
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 })
}

const screenshots = [
  {
    name: '01-3d-scene',
    description: '3D Scene with React Three Fiber',
    capture: async (browser) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      })
      const p = await ctx.newPage()
      await gotoWithSkippedIntro(p, '/chat')
      await p.waitForTimeout(6000)
      await p.screenshot({ path: path.join(OUTPUT_DIR, '01-3d-scene.png') })
      await ctx.close()
    },
  },
  {
    name: '02-cinematic-intro',
    description: 'Cinematic intro camera sequence',
    capture: async (browser) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      })
      const p = await ctx.newPage()
      // Don't skip cinematic - capture mid-flight
      await p.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle', timeout: 30000 })
      await p.waitForTimeout(3000)
      await p.screenshot({ path: path.join(OUTPUT_DIR, '02-cinematic-intro.png') })
      await ctx.close()
    },
  },
  {
    name: '03-dynamic-backgrounds',
    description: 'Dynamic background system',
    capture: async (browser) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      })
      const p = await ctx.newPage()
      await gotoWithSkippedIntro(p, '/chat')
      await p.waitForTimeout(7000)
      await p.screenshot({ path: path.join(OUTPUT_DIR, '03-dynamic-backgrounds.png') })
      await ctx.close()
    },
  },
  {
    name: '04-seasonal-effects',
    description: 'Seasonal effects (particles)',
    capture: async (browser) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      })
      const p = await ctx.newPage()
      await gotoWithSkippedIntro(p, '/chat')
      await p.waitForTimeout(6000)
      await p.screenshot({ path: path.join(OUTPUT_DIR, '04-seasonal-effects.png') })
      await ctx.close()
    },
  },
  {
    name: '05-interactive-tablet',
    description: 'Interactive tablet + terminal overlay',
    capture: async (browser) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      })
      const p = await ctx.newPage()
      await gotoWithSkippedIntro(p, '/chat')
      await p.waitForTimeout(5000)
      try {
        await p.click('text="MENU"', { timeout: 10000 })
        await p.waitForTimeout(1500)
      } catch (e) {
        console.log('  Note: MENU button not found')
      }
      await p.screenshot({ path: path.join(OUTPUT_DIR, '05-interactive-tablet.png') })
      await ctx.close()
    },
  },
  {
    name: '06-ai-search',
    description: 'AI-powered search / explore tab',
    capture: async (browser) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      })
      const p = await ctx.newPage()
      await gotoWithSkippedIntro(p, '/chat')
      await p.waitForTimeout(5000)
      try {
        await p.click('text="MENU"', { timeout: 10000 })
        await p.waitForTimeout(1000)
        await p.click('text="EXPLORE"', { timeout: 5000 })
        await p.waitForTimeout(1500)
      } catch (e) {
        console.log('  Note: Could not navigate to explore')
      }
      await p.screenshot({ path: path.join(OUTPUT_DIR, '06-ai-search.png') })
      await ctx.close()
    },
  },
  {
    name: '07-mdx-pipeline',
    description: 'Articles page showing published content',
    capture: async (browser) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      })
      const p = await ctx.newPage()
      await p.goto(`${BASE_URL}/articles`, { waitUntil: 'networkidle', timeout: 30000 })
      await p.waitForTimeout(3000)
      await p.screenshot({ path: path.join(OUTPUT_DIR, '07-mdx-pipeline.png') })
      await ctx.close()
    },
  },
  {
    name: '08-sphere-hunter',
    description: 'Sphere Hunter game tab',
    capture: async (browser) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      })
      const p = await ctx.newPage()
      await gotoWithSkippedIntro(p, '/chat')
      await p.waitForTimeout(5000)
      try {
        await p.click('text="MENU"', { timeout: 10000 })
        await p.waitForTimeout(1000)
        await p.click('text="GAME"', { timeout: 5000 })
        await p.waitForTimeout(1500)
      } catch (e) {
        console.log('  Note: Could not navigate to game')
      }
      await p.screenshot({ path: path.join(OUTPUT_DIR, '08-sphere-hunter.png') })
      await ctx.close()
    },
  },
  {
    name: '09-journey-system',
    description: 'Journey / quest system',
    capture: async (browser) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      })
      const p = await ctx.newPage()
      await gotoWithSkippedIntro(p, '/chat')
      await p.waitForTimeout(5000)
      try {
        await p.click('text="MENU"', { timeout: 10000 })
        await p.waitForTimeout(1000)
        const questBtn = await p.$('text="QUESTS"') || await p.$('text="JOURNEY"')
        if (questBtn) {
          await questBtn.click()
          await p.waitForTimeout(1500)
        }
      } catch (e) {
        console.log('  Note: Could not navigate to quests')
      }
      await p.screenshot({ path: path.join(OUTPUT_DIR, '09-journey-system.png') })
      await ctx.close()
    },
  },
  {
    name: '10-supabase-backend',
    description: 'Landing page showing full platform',
    capture: async (browser) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      })
      const p = await ctx.newPage()
      await p.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 30000 })
      await p.waitForTimeout(3000)
      await p.screenshot({
        path: path.join(OUTPUT_DIR, '10-supabase-backend.png'),
        fullPage: true,
      })
      await ctx.close()
    },
  },
]

async function run() {
  console.log('Capturing feature screenshots...\n')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Output:   ${OUTPUT_DIR}\n`)

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--disable-gpu-sandbox',
    ],
  })

  let succeeded = 0
  let failed = 0

  for (const shot of screenshots) {
    const start = Date.now()
    try {
      process.stdout.write(`  ${shot.name}: ${shot.description}...`)
      await shot.capture(browser)
      const ms = Date.now() - start
      console.log(` done (${ms}ms)`)
      succeeded++
    } catch (err) {
      const ms = Date.now() - start
      console.log(` FAILED (${ms}ms): ${err.message}`)
      failed++
    }
  }

  await browser.close()

  console.log(`\nDone: ${succeeded} captured, ${failed} failed`)
  console.log(`Screenshots in: ${OUTPUT_DIR}`)
}

;(async () => {
  try {
    const resp = await fetch(BASE_URL)
    if (!resp.ok) throw new Error(`Server returned ${resp.status}`)
  } catch {
    console.error(`Server not running at ${BASE_URL}. Start with: pnpm dev`)
    process.exit(1)
  }
  await run()
})()
