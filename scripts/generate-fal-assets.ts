#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables from .env
dotenv.config()

import { assetPromptSet, AssetPrompt } from '../lib/assets/falPromptSet'

const FAL_BASE_URL = 'https://fal.run'
const AUTH_HEADER = 'Authorization'

interface FalCost {
  total?: number
  currency?: string
}

interface AssetRunResult {
  id: string
  label: string
  model: string
  outputPath: string
  costUsd: number | null
  status: 'success' | 'skipped' | 'failed'
  error?: string
}

function getArgFlag(flag: string) {
  return process.argv.includes(flag)
}

function getArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

async function ensureDir(filePath: string) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
}

async function downloadToFile(url: string, outputPath: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await ensureDir(outputPath)
  await fs.writeFile(outputPath, buffer)
}

function extractCost(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null
  const record = data as { cost?: FalCost; billing?: FalCost; usage?: FalCost }
  const cost = record.cost ?? record.billing ?? record.usage
  if (!cost?.total) return null
  return Number(cost.total)
}

async function runFalGeneration(prompt: AssetPrompt, falKey: string) {
  const endpoint = `${FAL_BASE_URL}/${prompt.falModel}`
  const payload = {
    prompt: prompt.prompt,
    ...prompt.params,
  }

  console.log(`   📡 Calling: ${endpoint}`)
  console.log(`   📝 Prompt: "${prompt.prompt.substring(0, 60)}..."`)

  // Add timeout with AbortController
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 min timeout

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        [AUTH_HEADER]: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Fal request failed (${response.status}): ${text}`)
    }

    const data = (await response.json()) as {
      images?: { url: string }[]
      audio?: { url: string }[]
      video?: { url: string }[]
      model?: { url: string }[]
      output?: { url: string }[]
    }

    console.log(`   ✅ Response received, extracting URL...`)

    const fileUrl =
      data.audio?.[0]?.url ||
      data.images?.[0]?.url ||
      data.model?.[0]?.url ||
      data.output?.[0]?.url ||
      data.video?.[0]?.url

    if (!fileUrl) {
      console.log(`   ⚠️ Response data:`, JSON.stringify(data, null, 2).substring(0, 500))
      throw new Error('Fal response did not include a downloadable asset URL.')
    }

    await downloadToFile(fileUrl, prompt.outputPath)

    return extractCost(data)
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out after 2 minutes')
    }
    throw err
  }
}

async function main() {
  const dryRun = getArgFlag('--dry-run')
  const onlyCategory = getArgValue('--category')

  // Load and validate environment variables
  const falKey = process.env.FAL_KEY

  console.log('\n🔧 Environment Check:')
  console.log(`   FAL_KEY: ${falKey ? falKey.substring(0, 12) + '...' : '❌ NOT FOUND'}`)
  console.log(`   FAL_BASE_URL: ${FAL_BASE_URL}`)
  console.log('')

  if (!falKey && !dryRun) {
    console.error('❌ Missing FAL_KEY environment variable. Use --dry-run to preview outputs.')
    process.exit(1)
  }

  const prompts = assetPromptSet.filter((item) =>
    onlyCategory ? item.category === onlyCategory : true
  )

  console.log(`🎛️  Fal Asset Generator`)
  console.log(`Generating ${prompts.length} asset(s)${dryRun ? ' (dry run)' : ''}\n`)

  const results: AssetRunResult[] = []

  for (const prompt of prompts) {
    if (dryRun) {
      results.push({
        id: prompt.id,
        label: prompt.label,
        model: prompt.falModel,
        outputPath: prompt.outputPath,
        costUsd: null,
        status: 'skipped',
      })
      console.log(`⏭️  [dry-run] ${prompt.id} -> ${prompt.outputPath}`)
      continue
    }

    try {
      const cost = await runFalGeneration(prompt, falKey!)
      results.push({
        id: prompt.id,
        label: prompt.label,
        model: prompt.falModel,
        outputPath: prompt.outputPath,
        costUsd: cost,
        status: 'success',
      })
      console.log(`✅ ${prompt.id} -> ${prompt.outputPath}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({
        id: prompt.id,
        label: prompt.label,
        model: prompt.falModel,
        outputPath: prompt.outputPath,
        costUsd: null,
        status: 'failed',
        error: message,
      })
      console.error(`❌ ${prompt.id}: ${message}`)
    }
  }

  const totalCost = results.reduce((sum, item) => sum + (item.costUsd ?? 0), 0)
  const costLog = {
    generatedAt: new Date().toISOString(),
    totalCostUsd: Number(totalCost.toFixed(4)),
    currency: 'USD',
    results,
  }

  const logPath = path.join(process.cwd(), 'public', 'assets', 'asset-costs.json')
  await ensureDir(logPath)
  await fs.writeFile(logPath, JSON.stringify(costLog, null, 2))

  console.log(`\n💸 Total cost: $${totalCost.toFixed(4)} USD`)
  console.log(`🧾 Cost log saved to ${logPath}\n`)
}

main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})
