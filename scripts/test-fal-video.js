const { ProxyAgent, fetch: undiciFetch } = require('undici')
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
const agent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined
const pf = agent ? (url, init) => undiciFetch(url, { ...init, dispatcher: agent }) : fetch

async function main() {
  const models = [
    'fal-ai/minimax-video/text-to-video',
    'fal-ai/kling-video/v1/standard/text-to-video',
    'fal-ai/luma-dream-machine',
    'fal-ai/cogvideox-5b',
    'fal-ai/hunyuan-video',
    'fal-ai/ltx-video-v095/image-to-video',
    'fal-ai/fast-svd/text-to-video',
    'fal-ai/animatediff-v2v',
  ]

  for (const model of models) {
    try {
      const res = await pf('https://fal.run/' + model, {
        method: 'POST',
        headers: {
          Authorization: 'Key ' + process.env.FAL_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: 'test' })
      })
      const text = await res.text()
      console.log(model + ': ' + res.status + ' — ' + text.slice(0, 150))
    } catch(e) {
      console.log(model + ': ERROR — ' + e.message.slice(0, 100))
    }
  }
}
main()
