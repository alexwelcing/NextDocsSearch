/* eslint-disable @next/next/no-sync-scripts */
import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Script from 'next/script'

function App({ Component, pageProps }: AppProps) {

  return (
    <>
      <script
        src="https://cookie-cdn.cookiepro.com/scripttemplates/otSDKStub.js"
        type="text/javascript"
        data-domain-script="2767f96d-f8c2-489d-862e-bfeb24f3c968"
      ></script>
              <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
          rel="stylesheet"
        ></link>
      <script type="text/javascript">{`function OptanonWrapper() { }`}</script>
      <Component {...pageProps} />
    </>
  )
}

export default App
