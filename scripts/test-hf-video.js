const { ProxyAgent, fetch: undiciFetch } = require('undici')
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
const agent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined
const pf = agent ? (url, init) => undiciFetch(url, { ...init, dispatcher: agent }) : fetch
const TOKEN = process.env.HF_TOKEN

async function trySpace(name, base, endpoint, data) {
  console.log(`\n=== ${name} ===`)
  try {
    const submitRes = await pf(base + '/gradio_api/call' + endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    })
    console.log('Submit:', submitRes.status)
    const submitData = await submitRes.json()
    console.log('Event ID:', submitData.event_id)
    if (!submitData.event_id) return false

    // SSE poll
    const resultRes = await pf(
      base + '/gradio_api/call' + endpoint + '/' + submitData.event_id,
      { headers: { Authorization: 'Bearer ' + TOKEN } }
    )
    const text = await resultRes.text()
    const events = []
    let cur = {}
    for (const line of text.split('\n')) {
      if (line.startsWith('event: ')) cur = { event: line.slice(7).trim() }
      else if (line.startsWith('data: ')) { cur.data = line.slice(6); events.push(cur); cur = {} }
    }
    for (const e of events) {
      if (e.event === 'complete') {
        console.log('SUCCESS!')
        console.log('Data:', (e.data || '').slice(0, 400))
        return true
      }
      console.log(`  ${e.event}: ${(e.data || '').slice(0, 150)}`)
    }
    return false
  } catch(e) { console.log('Error:', e.message); return false }
}

async function main() {
  const prompt = 'A warm golden light filtering through blinds onto a wooden desk, slow dust particles drifting, cinematic.'

  // 1. ltx-2-distilled (newer, simpler API)
  const ok1 = await trySpace(
    'ltx-2-distilled',
    'https://lightricks-ltx-2-distilled.hf.space',
    '/generate_video',
    [null, prompt, 3, true, 42, false, 512, 768]
  )
  if (ok1) return

  // 2. Original Space with Space defaults (duration=2, improve_texture=true)
  const ok2 = await trySpace(
    'ltx-video-distilled (Space defaults)',
    'https://lightricks-ltx-video-distilled.hf.space',
    '/text_to_video',
    [prompt, 'worst quality, blurry, jittery', null, null, 512, 704, 'text-to-video', 2, 9, 42, false, 1.0, true]
  )
  if (ok2) return

  // 3. Original Space with PR #163 params
  const ok3 = await trySpace(
    'ltx-video-distilled (PR #163 params)',
    'https://lightricks-ltx-video-distilled.hf.space',
    '/text_to_video',
    [prompt, 'worst quality, blurry, jittery, text, watermark', null, null, 448, 768, 'text-to-video', 4, 97, 42, false, 1.0, false]
  )
  if (ok3) return

  console.log('\nAll spaces failed')
}

main()
