import { Html, Head, Main, NextScript } from 'next/document'
import Script from 'next/script'

export default function Document() {
  return (
    <Html lang="en">
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-HZNLDCC1GR" />
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
