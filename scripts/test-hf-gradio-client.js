const { ProxyAgent, setGlobalDispatcher } = require('undici')
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl))
  console.log('Proxy configured')
}

const { Client } = require('@gradio/client')

async function main() {
  console.log('Connecting to Lightricks/ltx-2-distilled...')
  const client = await Client.connect('Lightricks/ltx-2-distilled', {
    hf_token: process.env.HF_TOKEN
  })
  console.log('Connected!')

  // /generate_video params:
  // 0: input_image (null for T2V)
  // 1: prompt
  // 2: duration (float, default 3)
  // 3: enhance_prompt (bool, default true)
  // 4: seed (float, default 42)
  // 5: randomize_seed (bool, default true)
  // 6: height (int, default 512)
  // 7: width (int, default 768)

  console.log('Submitting T2V job (null image = text-only)...')
  const startTime = Date.now()

  const job = client.submit('/generate_video', [
    null,  // input_image — null for T2V
    'A warm golden light filtering through blinds onto a wooden desk, slow dust particles drifting, shallow depth of field, 50mm f/1.4, cinematic.',
    3,     // duration (seconds)
    true,  // enhance_prompt
    42,    // seed
    false, // randomize_seed
    512,   // height
    768,   // width
  ])

  for await (const event of job) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    if (event.type === 'data') {
      console.log(`[${elapsed}s] DATA received!`)
      console.log(JSON.stringify(event.data, null, 2).slice(0, 1000))
      break
    } else if (event.type === 'status') {
      const stage = event.stage || 'unknown'
      const queue = event.queue_size !== undefined ? ` (queue: ${event.queue_size})` : ''
      console.log(`[${elapsed}s] Status: ${stage}${queue}`)
    }
  }

  console.log('Done! Total time:', ((Date.now() - startTime) / 1000).toFixed(1) + 's')
}

main().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})
