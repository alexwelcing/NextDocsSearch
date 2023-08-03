// components/Footer.tsx
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from '../../styles/Home.module.css';
import { Button } from './button';

interface FooterProps {
  onImageChange: (newImage: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onImageChange }) => {
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
          // Use the minus SVG icon when expanded
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.75 9.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" />
          </svg>
        ) : (
          // Use the plus SVG icon when not expanded
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M10.75 6.75a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" />
          </svg>
        )}
      </div>

      <section className={`w-full text-center ${styles.footerContent}`}>
        <div className="py-1 w-full flex flex-wrap items-center justify-center space-x-6">
          {expanded && (
            <div className="flex flex-col items-center space-y-4">
              <Button className="text-xl bg-blue-500 text-white py-2 px-8 mt-4 hover:bg-blue-700 transition-colors rounded-md border border-blue-500 hover:border-blue-700" onClick={handleChangeImage}>
                Change of scenery?
              </Button>

              <div className="flex space-x-6">
                <Link href="https://github.com/alexwelcing" target="_blank" rel="noopener noreferrer">
                  <div className="opacity-80 hover:opacity-100 transition">
                    <Image src={'/github.svg'} width="35" height="35" alt="GitHub logo" />
                  </div>
                </Link>
                <Link href="https://linkedin.com/in/alexwelcing" target="_blank" rel="noopener noreferrer">
                  <div className="opacity-60 hover:opacity-100 transition">
                    <Image src={'/LI-In-Bug.png'} width="35" height="35" alt="LinkedIn logo" />
                  </div>
                </Link>
                <Link href="https://supabase.com" target="_blank" rel="noopener noreferrer">
                  <div className="opacity-40 hover:opacity-80 transition">
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