import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import Script from 'next/script'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-W24L468'

function App({ Component, pageProps }: AppProps) {
  const router = useRouter()

  // Track page views
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // Push to dataLayer for GTM
      if (typeof window !== 'undefined' && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: 'pageview',
          page: url,
        })
      }
    }

    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router.events])

  return (
    <>
      {/* Google Tag Manager */}
      <Script id="gtm" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');
        `}
      </Script>

      <Component {...pageProps} />
    </>
  )
}

export default App
