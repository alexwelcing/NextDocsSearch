// www.alexwelcing.com → https://alexwelcing.com, path and query kept. Its own Worker because Static
// Assets rules (_redirects, _headers) cannot match on hostname, and routing every request through
// the site Worker just for www would put Worker invocations in front of every static asset.
import { HSTS } from '../policy'

export default {
  fetch(request: Request): Response {
    const url = new URL(request.url)
    url.protocol = 'https:'
    url.hostname = 'alexwelcing.com'
    url.port = ''
    return new Response(null, {
      status: 301,
      headers: {
        Location: url.toString(),
        'Cache-Control': 'public, max-age=86400',
        'Strict-Transport-Security': HSTS,
      },
    })
  },
} satisfies ExportedHandler
