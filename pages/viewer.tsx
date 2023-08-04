import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import Footer from '@/components/ui/footer';
import ThreeSixty from '@/components/ThreeSixty'; // Assuming this path is correct

export default function ThreeSixtyPage() {
    const [currentImage, setCurrentImage] = useState<string>('./background/scifi1.jpg');
    const [backgroundImages, setBackgroundImages] = useState<string[]>([]);

    useEffect(() => {
        // Fetch images from the API when the component is mounted
        fetch("/api/backgroundImages")
            .then(response => response.json())
            .then(images => {
                setBackgroundImages(images);
                // Preload the images
                images.forEach((image: any) => {
                    new Image().src = `./background/${image}`;
                });
                const randomImage = images[Math.floor(Math.random() * images.length)];
                setCurrentImage(`./background/${randomImage}`);
            });
    }, []);

    const changeImageRandomly = () => {
        const randomImage = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];
        setCurrentImage(`./background/${randomImage}`);
    };

    return (
        <>
            <Head>
                <title>Explore with Alex in 360.</title>
                <meta name="description" content="360 view of Alex Welcing's world." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <ThreeSixty currentImage={currentImage} isDialogOpen={false} />
                {/* Assuming you'll manage the isDialogOpen state appropriately */}
            </main>

            <Footer onImageChange={changeImageRandomly} showChangeScenery={true} />
        </>
    );
}
