import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import { SearchDialog } from '@/components/SearchDialog'
import ThreeSixty from "@/components/ThreeSixty"
import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <>
      <Head>
        <title>Explore with Alex.</title>
        <meta
          name="description"
          content="Explore Alex Welcing's career in technology, consulting, and marketing."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <ThreeSixty />

      </main>

      <footer className={styles.footer}>
        <section className="w-full text-center">
          <div className="py-1 w-full flex items-center justify-center space-x-6">
            <SearchDialog />

            <div className="opacity-40 transition hover:opacity-100 cursor-pointer">
              <Link href="https://github.com/alexwelcing" className="flex items-center justify-center">
                <Image src={'/github.svg'} width="35" height="35" alt="GitHub logo" />
              </Link>
            </div>
            <div className="opacity-40 transition hover:opacity-100 cursor-pointer">
              <Link href="https://twitter.com/alexwelcing" className="flex items-center justify-center">
                <Image src={'/twitter.svg'} width="35" height="35" alt="Twitter logo" />
              </Link>
            </div>
            <div className="opacity-40 transition hover:opacity-100 cursor-pointer">
              <Link href="https://linkedin.com/in/alexwelcing" className="flex items-center justify-center">
                <Image src={'/LI-In-Bug.png'} width="35" height="35" alt="LinkedIn logo" />
              </Link>
            </div>

            <div className="w-half flex items-center justify-center absolute right-6 space-x-6">
              <div className="opacity-40 transition hover:opacity-100 cursor-pointer">
                <Link href="https://supabase.com" className="flex items-center justify-center">
                  <p className="text-base mr-2">Supabase</p>
                  <Image src={'/supabase.svg'} width="35" height="35" alt="Supabase logo" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </footer>

    </>
  )
}