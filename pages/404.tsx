import Link from 'next/link'
import Head from 'next/head'

export default function NotFound() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found | Alex Welcing</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen bg-[#030308] text-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-mono text-6xl text-cyan-400 mb-4">404</h1>
          <h2 className="text-2xl font-semibold mb-4 text-white/90">Page Not Found</h2>
          <p className="text-white/50 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-sm tracking-wide hover:bg-cyan-500/20 transition-all"
            >
              GO HOME
            </Link>
            <Link
              href="/articles"
              className="px-6 py-3 border border-white/10 text-white/60 font-mono text-sm tracking-wide hover:border-white/30 hover:text-white/80 transition-all"
            >
              VIEW ARTICLES
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
