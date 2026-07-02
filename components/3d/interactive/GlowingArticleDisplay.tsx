import React, { useRef, useState } from 'react';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

export interface ArticleData {
    length: number;
    filename: string;
    title: string;
    date: string;
    author: string[];
}

interface GlowingArticleDisplayProps {
    articles: ArticleData[];
    article: ArticleData | undefined;
    currentIndex: number;
    setCurrentIndex: (index: number) => void;
    showArticles: boolean;
    title: string;
    totalArticles: number;
}

const GlowingArticleDisplay: React.FC<GlowingArticleDisplayProps> = ({ articles, article, currentIndex, setCurrentIndex, showArticles, title, totalArticles }) => {
    const groupRef = useRef<THREE.Group | null>(null);
    const lightRef = useRef<THREE.PointLight | null>(null);
    const isBackAvailable = currentIndex > 0;
    const isNextAvailable = currentIndex < articles.length - 1;

    const [backHovered, setBackHovered] = useState(false);
    const [nextHovered, setNextHovered] = useState(false);
    const [viewHovered, setViewHovered] = useState(false);

    return (
        <group ref={groupRef} position={[0, 1, -6]}>
            <RoundedBox args={[8, 5, 0.5]} radius={0.2} smoothness={4}>
                <meshStandardMaterial color={showArticles ? "white" : "gray"} />
            </RoundedBox>

            {showArticles && (
                <pointLight ref={lightRef} position={[0, 0, 0.6]} intensity={1} />
            )}

            {showArticles && article && (
                <>
                    <Text fontSize={0.3} color="black" anchorX="center" textAlign='center' anchorY="middle" position={[0, 0, 0.7]} maxWidth={4}>
                        {`${article.title}`}
                    </Text>
                </>
            )}

            {showArticles && (
                <>
                    {/* "Back" Button */}
                    <RoundedBox
                        args={[1.5, 0.8, 0.1]}
                        position={[-4, -2.5, 0.6]}
                        onClick={() => isBackAvailable && setCurrentIndex(currentIndex - 1)}
                        onPointerOver={() => isBackAvailable && setBackHovered(true)}
                        onPointerOut={() => setBackHovered(false)}
                    >
                        <meshStandardMaterial color={backHovered && isBackAvailable ? "#00d4ff" : (!isBackAvailable ? '#B0B0B0' : '#1E88E5')} />
                        <Text fontSize={0.3} color="#0a0a1a" anchorX="center" textAlign='center' anchorY="middle" position={[0, 0, 0.1]}>
                            Back
                        </Text>
                    </RoundedBox>

                    {/* "Next" Button */}
                    <RoundedBox
                        args={[1.5, 0.8, 0.1]}
                        position={[4, -2.5, 0.6]}
                        onClick={() => isNextAvailable && setCurrentIndex(currentIndex + 1)}
                        onPointerOver={() => isNextAvailable && setNextHovered(true)}
                        onPointerOut={() => setNextHovered(false)}
                    >
                        <meshStandardMaterial color={nextHovered && isNextAvailable ? "#00d4ff" : (!isNextAvailable ? '#B0B0B0' : '#1E88E5')} />
                        <Text fontSize={0.3} color="#0a0a1a" anchorX="center" textAlign='center' anchorY="middle" position={[0, 0, 0.1]}>
                            Next
                        </Text>
                    </RoundedBox>

                    {/* "View Article" Button */}
                    <RoundedBox
                        args={[2.5, .6, 0.1]}
                        position={[0, -1.2, 0.6]}
                        onClick={() => article && window.open(`/articles/${article.filename.replace('.mdx', '')}`, '_blank')}
                        onPointerOver={() => setViewHovered(true)}
                        onPointerOut={() => setViewHovered(false)}
                    >
                        <meshStandardMaterial color={viewHovered ? "#00d4ff" : "#1E88E5"} />
                        <Text fontSize={0.4} color="#0a0a1a" anchorX="center" textAlign='center' anchorY="middle" position={[0, 0, 0.1]}>
                            View Article
                        </Text>
                    </RoundedBox>
                </>
            )}
        </group>
    );
};

export default GlowingArticleDisplay;
