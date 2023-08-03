import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
    return (
        <>
            <Head>
                <title>Explore with Alex.</title>
                <meta name="description" content="Explore Alex Welcing's career in technology, consulting, and marketing." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
                <div className="text-4xl font-bold mb-10">
                    Welcome to Our Platform!
                </div>
                <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                    <Link href="/chat">
                        <a className="btn">
                            Chat with Alex
                        </a>
                    </Link>
                    <Link href="/viewer">
                        <a className="btn">
                            View 360° Image
                        </a>
                    </Link>
                </div>
            </div>
        </>
    );
}
