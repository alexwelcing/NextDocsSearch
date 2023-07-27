import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Script from 'next/script'

import * as ga from '../lib/google-analytics'

function App({ Component, pageProps }: AppProps) {
  const router = useRouter()

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      ga.pageview(url)
    }

    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router.events])

  return (
    <>
      <Script src="https://www.googletagmanager.com/gtag/js?id=${process.env.GOOGLE_ANALYTICS_ID}" strategy='afterInteractive' />
      <Script id="google-analytics-script" strategy='afterInteractive'>
        {`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', '${process.env.GOOGLE_ANALYTICS_ID}');
      `}
      </Script>
      <Component {...pageProps} />
    </>
  )
}

export default App