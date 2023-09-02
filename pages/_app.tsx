import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import Script from 'next/script'

function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Script
        src="https://cookie-cdn.cookiepro.com/scripttemplates/otSDKStub.js"
        data-domain-script="2767f96d-f8c2-489d-862e-bfeb24f3c968"
      />

      {/* Material icons */}
      <link
        href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
        rel="stylesheet"
      />

      {/* Inline script for cookie pro */}
      <Script id="optanon" strategy="afterInteractive">
        {`function OptanonWrapper() { }`}
      </Script>

      <Component {...pageProps} />
    </>
  )
}

export default App;
