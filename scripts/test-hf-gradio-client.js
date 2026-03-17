require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
if (proxyUrl) {
  console.warn('test-hf-gradio-client: proxy environment detected; @gradio/client may not honor proxy settings here.')
}

const SPACE_BASE = 'https://lightricks-ltx-2-distilled.hf.space'

async function submitT2vJob(token) {
  const response = await fetch(`${SPACE_BASE}/gradio_api/call/generate_video`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [
        null,
        'A warm golden light filtering through blinds onto a wooden desk, slow dust particles drifting, shallow depth of field, 50mm f/1.4, cinematic.',
        2,
        true,
        42,
        false,
        512,
        704,
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Submit failed: ${response.status} ${await response.text()}`)
  }

  return response.json()
}

async function fetchResult(token, eventId) {
  const response = await fetch(`${SPACE_BASE}/gradio_api/call/generate_video/${eventId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Result fetch failed: ${response.status} ${await response.text()}`)
  }

  return response.text()
}

function parseSseResult(text) {
  const lines = text.split('\n')
  let lastEvent = ''
  let lastData = ''

  for (const line of lines) {
    if (line.startsWith('event: ')) lastEvent = line.slice(7).trim()
    if (line.startsWith('data: ')) lastData = line.slice(6)
  }

  return { lastEvent, lastData }
}

async function main() {
  const token = process.env.HF_TOKEN
  if (!token) {
    throw new Error('HF_TOKEN missing')
  }

  console.log('Submitting T2V job to Lightricks/ltx-2-distilled...')
  const startTime = Date.now()
  const submit = await submitT2vJob(token)
  if (!submit.event_id) {
    throw new Error(`No event_id returned: ${JSON.stringify(submit).slice(0, 400)}`)
  }

  console.log('Event ID:', submit.event_id)
  const resultText = await fetchResult(token, submit.event_id)
  const parsed = parseSseResult(resultText)
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`[${elapsed}s] Final event: ${parsed.lastEvent || 'unknown'}`)
  console.log(parsed.lastData.slice(0, 1000))
}

main().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})
