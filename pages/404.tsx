import Link from 'next/link'
import Head from 'next/head'

export default function NotFound() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found | Alex Welcing</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen bg-parchment-50 flex items-center justify-center px-6">
        <div className="text-center max-w-lg">
          {/* Decorative plant illustration */}
          <div className="mb-8 relative">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-sun-100 to-flora-100 flex items-center justify-center">
              <svg className="w-12 h-12 text-flora-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19V6M12 6c-1.5-2-4-3-6-2 2-1 4.5 0 6 2zm0 0c1.5-2 4-3 6-2-2-1-4.5 0-6 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19c-2 0-4 1-4 1s2-3 4-3 4 3 4 3-2-1-4-1z" />
              </svg>
            </div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-32 h-32 bg-sun-200/30 rounded-full blur-2xl" />
          </div>

          <h1 className="font-serif text-7xl font-bold bg-gradient-to-r from-sun-500 to-flora-500 bg-clip-text text-transparent mb-4">
            404
          </h1>
          <h2 className="text-2xl font-serif font-semibold text-earth-700 mb-4">
            This path hasn&apos;t been planted yet
          </h2>
          <p className="text-earth-500 mb-10 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved to a different part of the garden.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-sun-400 to-sun-500 text-earth-700 font-semibold rounded-full hover:from-sun-500 hover:to-sun-600 transition-all shadow-lg shadow-sun-400/25"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Return Home
            </Link>
            <Link
              href="/articles"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-earth-300 text-earth-600 font-semibold rounded-full hover:border-flora-400 hover:text-flora-600 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Browse Research
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
