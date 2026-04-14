const STATIC_CACHE = 'pretext-static-v1'
const DATA_CACHE = 'pretext-data-v1'
const MEDIA_CACHE = 'pretext-media-v1'

const PRECACHE_URLS = ['/', '/manifest.webmanifest', '/data/index.json', '/data/search-docs.json', '/data/prefetch-manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, DATA_CACHE, MEDIA_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

function isMedia(request) {
  return request.url.includes('/images/') || request.destination === 'image' || request.destination === 'video'
}

function isData(request) {
  return request.url.includes('/data/')
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  if (isMedia(request)) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        cache.put(request, response.clone())
        return response
      })
    )
    return
  }

  if (isData(request)) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        try {
          const response = await fetch(request)
          cache.put(request, response.clone())
          return response
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: 'offline_data_unavailable',
              url: request.url,
            }),
            {
              status: 503,
              headers: { 'content-type': 'application/json' },
            }
          )
        }
      })
    )
    return
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  )
})
