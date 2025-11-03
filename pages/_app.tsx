import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Script from 'next/script';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { trackEvent } from '@/lib/google-analytics';
import { JourneyProvider } from '@/components/JourneyContext';


const GTM_ID = 'GTM-W24L468'

function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      const urlObj = new URL(url, window.location.origin);
      const abTestVariant = urlObj.searchParams.get('ab_test_variant');
      if (abTestVariant) {
        trackEvent('ab_test_variant', { variant: abTestVariant });
      }
    };

    // Subscribe to route changes
    router.events.on('routeChangeComplete', handleRouteChange);

    // Unsubscribe from events when component unmounts
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);  return (
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
            {/* Inline script for gtm */}
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');
        `}
      </Script>

      <JourneyProvider>
        <Component {...pageProps} />
      </JourneyProvider>
    </>
  )
}

export default App;
