// components/Footer.tsx
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from '../../styles/Home.module.css';
import { Button } from './button';

interface FooterProps {
  onImageChange: (newImage: string) => void;
  showChangeScenery: boolean;
}

const Footer: React.FC<FooterProps> = ({ onImageChange, showChangeScenery = true }) => {
  const [expanded, setExpanded] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    // Fetch the list of background images from the API route
    fetch('/api/backgroundImages')
      .then(response => response.json())
      .then(data => {
        setImages(data.map((imageName: string) => `/background/${imageName}`));
      });
  }, []);

  const handleChangeImage = () => {
    // Fetching the image list from the API on each button click
    fetch('/api/backgroundImages')
      .then(response => response.json())
      .then(data => {
        const allImages = data.map((imageName: string) => `/background/${imageName}`);
        // Randomize the selection
        const randomImage = allImages[Math.floor(Math.random() * allImages.length)];
        onImageChange(randomImage);
      });
  };

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

      <section className={`w-full text-center ${styles.expandedFooter}`}>
        <div className="py-1 w-full flex flex-wrap items-center justify-center space-x-6">

          {expanded && (
            <div className="flex flex-col items-center space-y-4">
              {showChangeScenery && (
                <Button className="text-xl bg-blue-500 text-white py-2 px-8 mt-4 hover:bg-blue-700 transition-colors rounded-md border border-blue-500 hover:border-blue-700" onClick={handleChangeImage}>
                  Change of scenery?
                </Button>
              )}

              <div className="flex space-x-6">
              <Link href="/">
                  <div className="opacity-40 hover:opacity-100 transition">
                    <Image src={'/icons/indexs.svg'} width="35" height="35" alt="Home icon" />
                  </div>
                </Link>
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