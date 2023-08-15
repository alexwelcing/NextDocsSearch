import { Html, Head, Main, NextScript } from 'next/document'
import Script from 'next/script'


const GTM_ID = process.env.GTM_ID as string

export default function Document() {
  return (
    <Html lang="en">
      <Script src="https://www.googletagmanager.com/gtag/js?id=G-HZNLDCC1GR" />
      <Head />
      <Script id="google-tag-manager" strategy="afterInteractive">
      {`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${GTM_ID}');
      `}
    </Script>
      <body>
  <Main />
  <NextScript />
  <noscript
    dangerouslySetInnerHTML={{
      __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXX" height="0" width="0" style="display: none; visibility: hidden;" />`,
    }}
  />
</body>
    </Html>
  )
}
