const { ProxyAgent, fetch: undiciFetch } = require('undici')
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
const agent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined
const pf = agent ? (url, init) => undiciFetch(url, { ...init, dispatcher: agent }) : fetch

async function main() {
  const res = await pf('https://lightricks-ltx-video-distilled.hf.space/gradio_api/info', {
    headers: { Authorization: 'Bearer ' + process.env.HF_TOKEN }
  })
  const data = await res.json()
  const t2v = data.named_endpoints['/text_to_video']
  console.log('T2V endpoint params:')
  for (let i = 0; i < t2v.parameters.length; i++) {
    const p = t2v.parameters[i]
    const def = p.parameter_default !== undefined ? ' default=' + JSON.stringify(p.parameter_default) : ''
    console.log(i + ': ' + p.parameter_name + ' - ' + p.label + ' (' + p.python_type.type + ')' + def)
  }

  const i2v = data.named_endpoints['/image_to_video']
  console.log('\nI2V endpoint params:')
  for (let i = 0; i < i2v.parameters.length; i++) {
    const p = i2v.parameters[i]
    const def = p.parameter_default !== undefined ? ' default=' + JSON.stringify(p.parameter_default) : ''
    console.log(i + ': ' + p.parameter_name + ' - ' + p.label + ' (' + p.python_type.type + ')' + def)
  }
}

main().catch(e => console.error(e.message))
