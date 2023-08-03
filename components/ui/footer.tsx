// components/Footer.tsx
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from '../../styles/Home.module.css';

const Footer: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <footer className={`${styles.footer} ${expanded ? styles.expandedFooter : ''} transition-max-height duration-500 ease-in-out relative flex items-center`}>

      <div
        className={`${styles.expandButton} ${expanded ? styles.expandedButton : ''} absolute top-1/2 right-2 cursor-pointer transform -translate-y-1/2 p-1 rounded`}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#B2E03D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="feather feather-minus">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        ) : (
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#DE7EA2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="feather feather-plus">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        )}
      </div>

      <section className={`w-full text-center ${styles.footerContent}`}>
        <div className="py-1 w-full flex flex-wrap items-center justify-center space-x-6">
          {expanded && (
            <div className="flex flex-col items-center space-y-4">
              <div className="flex space-x-6">
                <Link href="https://github.com/alexwelcing">
                  <div className="opacity-40 hover:opacity-100 transition">
                    <Image src={'/github.svg'} width="35" height="35" alt="GitHub logo" />
                  </div>
                </Link>
                <Link href="https://linkedin.com/in/alexwelcing">
                  <div className="opacity-40 hover:opacity-100 transition">
                    <Image src={'/LI-In-Bug.png'} width="35" height="35" alt="LinkedIn logo" />
                  </div>
                </Link>
                <Link href="https://supabase.com">
                  <div className="opacity-40 hover:opacity-100 transition">
                    <Image src={'/supabase.svg'} width="35" height="35" alt="Supabase logo" />
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </footer>
  );
}

export default Footer;
