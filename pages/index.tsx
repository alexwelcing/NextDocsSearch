import Head from 'next/head'
import { Inter } from 'next/font/google'
import styles from '@/styles/Home.module.css'
import { SearchDialog } from '@/components/SearchDialog'
import Image from 'next/image'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  return (
    <>
      <Head>
        <title>Pre-emptive Alex Chat.</title>
        <meta
          name="description"
          content="Explore Alex's career in technology, consulting, and marketing."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <div className={styles.center}>
          <SearchDialog />
        </div>

        <div className="py-8 w-full flex items-center justify-center space-x-6">
          <div className="opacity-75 transition hover:opacity-100 cursor-pointer">
            <Link href="https://supabase.com" className="flex items-center justify-center">
              <p className="text-base mr-2">Theme by Supabase</p>
              <Image src={'/supabase.svg'} width="20" height="20" alt="Supabase logo" />
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
