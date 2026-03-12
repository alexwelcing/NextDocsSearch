const { ProxyAgent, fetch: undiciFetch } = require('undici')
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
const agent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined
const pf = agent ? (url, init) => undiciFetch(url, { ...init, dispatcher: agent }) : fetch
const TOKEN = process.env.HF_TOKEN

// Try BOTH Spaces
const SPACES = [
  {
    name: 'ltx-2-distilled',
    base: 'https://lightricks-ltx-2-distilled.hf.space',
    endpoint: '/generate_video',
    data: [
      null,  // input_image
      'A warm golden light filtering through blinds onto a wooden desk, slow dust particles drifting, cinematic.',
      3,     // duration
      true,  // enhance_prompt
      42,    // seed
      false, // randomize_seed
      512,   // height
      768,   // width
    ]
  },
  {
    name: 'ltx-video-distilled (original)',
    base: 'https://lightricks-ltx-video-distilled.hf.space',
    endpoint: '/text_to_video',
    data: [
      'A warm golden light filtering through blinds onto a wooden desk, slow dust particles drifting, cinematic.',
      'worst quality, inconsistent motion, blurry, jittery, distorted',
      null, null,
      512, 704,
      'text-to-video',
      2, 9, 42, false, 1.0, true
    ]
  }
]

async function trySpace(space) {
  console.log(`\n=== ${space.name} ===`)
  console.log('URL:', space.base + '/gradio_api/call' + space.endpoint)

  try {
    // 1. Submit
    const submitRes = await pf(space.base + '/gradio_api/call' + space.endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: space.data })
    })

    console.log('Submit status:', submitRes.status)
    if (submitRes.status !== 200) {
      console.log('Body:', (await submitRes.text()).slice(0, 300))
      return false
    }

    const submitData = await submitRes.json()
    console.log('Event ID:', submitData.event_id)
    if (!submitData.event_id) return false

    // 2. Poll with increasing delays
    const delays = [5, 10, 15, 20, 30, 40, 50, 60]
    for (const wait of delays) {
      console.log(`Waiting ${wait}s...`)
      await new Promise(r => setTimeout(r, wait * 1000))

      const resultRes = await pf(
        space.base + '/gradio_api/call' + space.endpoint + '/' + submitData.event_id,
        { headers: { Authorization: 'Bearer ' + TOKEN } }
      )

      const text = await resultRes.text()

      // Parse SSE events
      const events = []
      let currentEvent = {}
      for (const line of text.split('\n')) {
        if (line.startsWith('event: ')) {
          currentEvent = { event: line.slice(7).trim() }
        } else if (line.startsWith('data: ')) {
          currentEvent.data = line.slice(6)
          events.push(currentEvent)
          currentEvent = {}
        }
      }

      for (const evt of events) {
        if (evt.event === 'complete') {
          console.log('COMPLETE!')
          try {
            const parsed = JSON.parse(evt.data)
            console.log('Data:', JSON.stringify(parsed).slice(0, 500))
          } catch {
            console.log('Raw:', evt.data.slice(0, 500))
          }
          return true
        }
        if (evt.event === 'error') {
          console.log('Error:', evt.data)
          // If it's a real error (not null), stop retrying
          if (evt.data && evt.data !== 'null' && !evt.data.includes('Not Found')) {
            return false
          }
        }
        if (evt.event === 'generating') {
          console.log('Still generating...', evt.data ? evt.data.slice(0, 100) : '')
        }
        if (evt.event === 'heartbeat') {
          console.log('Heartbeat (still alive)')
        }
      }

      if (events.length === 0) {
        console.log('No events in response (status:', resultRes.status + ')')
      }
    }

    return false
  } catch(e) {
    console.log('Error:', e.message)
    return false
  }
}

async function main() {
  for (const space of SPACES) {
    const ok = await trySpace(space)
    if (ok) {
      console.log('\nSUCCESS with', space.name)
      return
    }
  }
  console.log('\nAll spaces failed')
}

main()
