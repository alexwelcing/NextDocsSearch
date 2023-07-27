// components/Footer.tsx
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from '../../styles/Home.module.css';
import { SearchDialog } from '../SearchDialog';

const Footer: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <footer className={`${styles.footer} ${expanded ? styles.expandedFooter : ''} transition-max-height duration-500 ease-in-out relative flex items-center`}>

    <div
      className={`${styles.expandButton} ${expanded ? styles.expandedButton : ''} absolute top-1/2 right-5 cursor-pointer transform -translate-y-1/2 p-1 rounded`}
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
        {/* Chat Bar */}
        <div className="py-1 w-full flex flex-wrap items-center justify-center space-x-6">
          <SearchDialog />
        </div>
        {/* Display the rest of the links only when expanded on mobile */}
        {expanded && (
          <div className="w-full flex items-center justify-center space-x-6">
            <div className="opacity-40 transition hover:opacity-100 cursor-pointer">
              <Link href="https://github.com/alexwelcing">
                  <Image src={'/github.svg'} width="35" height="35" alt="GitHub logo" />
              </Link>
            </div>
            <div className="opacity-40 transition hover:opacity-100 cursor-pointer">
              <Link href="https://linkedin.com/in/alexwelcing">
                  <Image src={'/LI-In-Bug.png'} width="35" height="35" alt="LinkedIn logo" />
              </Link>
            </div>
            <div className="w-half flex items-center justify-center space-x-6">
              <div className="opacity-40 transition hover:opacity-100 cursor-pointer">
                <Link href="https://supabase.com">
                    <Image src={'/supabase.svg'} width="35" height="35" alt="Supabase logo" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>
    </footer>
  );
}


export default Footer;
