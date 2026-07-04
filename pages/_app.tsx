import '@/styles/globals.css'
import '@/styles/immersive.css'
import type { AppProps } from 'next/app'
import Script from 'next/script'
import ErrorBoundary from '@/components/ErrorBoundary'
import ImmersiveApp from '@/components/immersive/ImmersiveApp'

const GTM_ID = 'GTM-W24L468'

// The immersive scene mounts once here and persists across route changes; page components only
// contribute crawlable HTML (and metadata) inside #arc-page-content, hidden while the scene runs.
function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Script
        src="https://cookie-cdn.cookiepro.com/scripttemplates/otSDKStub.js"
        data-domain-script="2767f96d-f8c2-489d-862e-bfeb24f3c968"
      />
      <Script id="optanon" strategy="afterInteractive">
        {`function OptanonWrapper() { }`}
      </Script>
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');
        `}
      </Script>

      <ErrorBoundary>
        <ImmersiveApp />
        <div id="arc-page-content">
          <Component {...pageProps} />
        </div>
      </ErrorBoundary>
    </>
  )
}

export default App
