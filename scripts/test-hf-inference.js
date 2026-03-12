const { ProxyAgent, fetch: undiciFetch } = require('undici')
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
const agent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined
const pf = agent ? (url, init) => undiciFetch(url, { ...init, dispatcher: agent }) : fetch
const TOKEN = process.env.HF_TOKEN

async function main() {
  // Try HF Router API for text-to-video
  console.log('Testing HF Router API for text-to-video...')

  const res = await pf('https://router.huggingface.co/models/Lightricks/LTX-Video-0.9.5-Distilled', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: 'A warm golden light filtering through blinds onto a wooden desk, slow dust particles drifting, cinematic.',
    })
  })

  console.log('Status:', res.status)
  const contentType = res.headers.get('content-type')
  console.log('Content-Type:', contentType)

  if (contentType && contentType.includes('video')) {
    const buffer = Buffer.from(await res.arrayBuffer())
    const fs = require('fs')
    fs.writeFileSync('/tmp/test-hf-video.mp4', buffer)
    console.log('Video saved! Size:', buffer.length, 'bytes')
  } else {
    const text = await res.text()
    console.log('Response:', text.slice(0, 500))

    // Also try the fal-compatible LTX models
    console.log('\nTrying Wan-2.1 (smaller model)...')
    const res2 = await pf('https://router.huggingface.co/models/Wan-AI/Wan2.1-T2V-1.3B', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: 'Golden light filtering through blinds, dust particles, cinematic.',
      })
    })
    console.log('Wan-2.1 Status:', res2.status)
    const ct2 = res2.headers.get('content-type')
    console.log('Content-Type:', ct2)

    if (ct2 && (ct2.includes('video') || ct2.includes('octet'))) {
      const buffer = Buffer.from(await res2.arrayBuffer())
      const fs = require('fs')
      fs.writeFileSync('/tmp/test-wan-video.mp4', buffer)
      console.log('Video saved! Size:', buffer.length, 'bytes')
    } else {
      const text2 = await res2.text()
      console.log('Response:', text2.slice(0, 500))
    }
  }
}

main().catch(e => console.error('Error:', e.message))
