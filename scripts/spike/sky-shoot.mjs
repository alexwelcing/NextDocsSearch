// SPIKE (H1 sky): real-GPU screenshot + metrics driver for the ?sky= experiment.
// Run on the forge L4 under xvfb-run, against a `pnpm start` server:
//   node scripts/spike/sky-shoot.mjs http://localhost:PORT OUTDIR plan.json
// plan.json: [{ "name": "stacks-8k-uastc", "query": "sky=ktx2&tier=8k-uastc&still=1",
//               "views": [{ "name": "start", "yaw": 0, "pitch": 0, "lean": [0, 0] }, ...] }]
// For each case: load, wait for the sky (preview -> full tier [-> depth]) and the boot reveal,
// then per view: set it through window.__skySpike.view, screenshot, and sample fps + GPU time.
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const [base, outDir, planPath] = process.argv.slice(2)
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({
  headless: false,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-angle=vulkan',
    '--ignore-gpu-blocklist',
    '--disable-vulkan-surface',
    '--autoplay-policy=no-user-gesture-required',
  ],
})

const summary = []
for (const c of plan) {
  const [vw, vh] = c.viewport ?? [1600, 900]
  const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 })
  const logs = []
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type()))
      logs.push(`[${m.type()}] ${m.text()}`.slice(0, 400))
  })
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`.slice(0, 400)))
  const t0 = Date.now()
  await page.goto(`${base}/?${c.query}`, { waitUntil: 'domcontentloaded' })
  // Hide third-party consent chrome so it does not cover the nadir shots (no consent is given).
  await page
    .addStyleTag({ content: '[id^="onetrust"],#ot-sdk-btn-floating{display:none!important}' })
    .catch(() => {})
  const want = c.wait ?? ['sky.fullMs']
  let ready = false
  for (let i = 0; i < 120 && !ready; i++) {
    await page.waitForTimeout(500)
    ready = await page.evaluate((keys) => {
      const m = window.__skySpike?.metrics ?? {}
      const boot = document.querySelector('.arc-boot')
      return keys.every((k) => k in m) && !boot
    }, want)
  }
  const loadWallMs = Date.now() - t0
  await page.waitForTimeout(c.settle ?? 1500)
  const views = []
  for (const v of c.views ?? [{ name: 'start' }]) {
    await page.evaluate((v) => window.__skySpike?.view?.(v), v)
    await page.waitForTimeout(v.wait ?? 900)
    const file = path.join(outDir, `${c.name}--${v.name}.png`)
    await page.screenshot({ path: file })
    views.push({ view: v, file })
  }
  // fps (rAF count over 2 s) and GPU time per frame from timestamp queries (render passes).
  const perf = await page.evaluate(async () => {
    const r = window.__skySpike?.renderer
    const frames = []
    let n = 0
    const s = performance.now()
    await new Promise((res) => {
      const f = () => {
        n++
        performance.now() - s < 2000 ? requestAnimationFrame(f) : res()
      }
      requestAnimationFrame(f)
    })
    const fps = Math.round(n / ((performance.now() - s) / 1000))
    if (r?.resolveTimestampsAsync) {
      await r.resolveTimestampsAsync('render') // drain queries accumulated before sampling
      for (let i = 0; i < 60; i++) {
        await new Promise((res) => requestAnimationFrame(res))
        const d = await r.resolveTimestampsAsync('render')
        if (typeof d === 'number' && d > 0) frames.push(d)
      }
    }
    frames.sort((a, b) => a - b)
    const q = (p) =>
      frames.length ? +frames[Math.floor((frames.length - 1) * p)].toFixed(3) : null
    return {
      fps,
      gpuMsMedian: q(0.5),
      gpuMsP10: q(0.1),
      gpuMsP90: q(0.9),
      gpuSamples: frames.length,
    }
  })
  const metrics = await page.evaluate(() => window.__skySpike?.metrics ?? {})
  summary.push({
    name: c.name,
    query: c.query,
    ready,
    loadWallMs,
    perf,
    metrics,
    views,
    logs: logs.slice(0, 30),
  })
  console.log(JSON.stringify(summary.at(-1)))
  await page.close()
}
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1))
await browser.close()
