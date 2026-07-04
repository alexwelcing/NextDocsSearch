import { Html, Head, Main, NextScript } from 'next/document'

// Fonts self-host from /public/fonts (VT323 / Share Tech Mono via styles/immersive.css) — no
// external font requests. GTM noscript mirrors the loader in _app.tsx.
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link
          rel="preload"
          href="/fonts/VT323-Regular.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W24L468" height="0" width="0" style="display: none; visibility: hidden;" />`,
          }}
        />
      </body>
    </Html>
  )
}
