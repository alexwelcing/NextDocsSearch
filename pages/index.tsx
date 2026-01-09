import React, { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { SupabaseDataProvider } from '@/components/contexts/SupabaseDataContext'
import AchievementUnlock from '@/components/AchievementUnlock'
import CircleNav from '@/components/ui/CircleNav'
import ArticleList from '@/components/ui/ArticleList'
import StylishFallback from '@/components/StylishFallback'
import StructuredData from '@/components/StructuredData'
import styles from '@/styles/Home.module.css'
import type { GameState } from '@/components/3d/game/ClickingGame'
import { useJourney } from '@/components/contexts/JourneyContext'

// Dynamically import the 3D environment
const ThreeSixty = dynamic(() => import('@/components/3d/scene/ThreeSixty'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

// Minimal GLSL background shader for hero
const heroVertexShader = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const heroFragmentShader = `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uScroll;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 p = (gl_FragCoord.xy - uResolution * 0.5) / min(uResolution.x, uResolution.y);

    // Deep space base
    vec3 col = vec3(0.012, 0.012, 0.024);

    // Subtle noise field
    float n = noise(p * 3.0 + uTime * 0.1);
    col += vec3(0.0, 0.03, 0.06) * n;

    // Distant stars
    for (float i = 0.0; i < 80.0; i++) {
      vec2 starPos = vec2(hash(vec2(i, 0.0)), hash(vec2(0.0, i)));
      float starDist = length(uv - starPos);
      float twinkle = 0.5 + 0.5 * sin(uTime * (1.0 + hash(vec2(i, i)) * 2.0) + i);
      col += vec3(0.7, 0.8, 1.0) * smoothstep(0.003, 0.0, starDist) * twinkle * 0.4;
    }

    // Central subtle glow
    float centerDist = length(p);
    col += vec3(0.0, 0.08, 0.12) * exp(-centerDist * 2.0) * (0.5 + 0.2 * sin(uTime * 0.5));

    // Scroll fade
    col *= 1.0 - uScroll * 0.3;

    // Vignette
    float vignette = 1.0 - smoothstep(0.4, 1.2, centerDist);
    col *= vignette;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Hero shader canvas component
function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const scrollRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) return;

    // Create shaders
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    gl.shaderSource(vs, heroVertexShader);
    gl.compileShader(vs);
    gl.shaderSource(fs, heroFragmentShader);
    gl.compileShader(fs);

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Fullscreen quad
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const uTimeLoc = gl.getUniformLocation(program, 'uTime');
    const uResolutionLoc = gl.getUniformLocation(program, 'uResolution');
    const uScrollLoc = gl.getUniformLocation(program, 'uScroll');

    const startTime = performance.now();

    const handleScroll = () => {
      scrollRef.current = Math.min(window.scrollY / window.innerHeight, 1);
    };
    window.addEventListener('scroll', handleScroll);

    const animate = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      const width = window.innerWidth * dpr;
      const height = window.innerHeight * dpr;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      const elapsed = (performance.now() - startTime) / 1000;
      gl.uniform1f(uTimeLoc, elapsed);
      gl.uniform2f(uResolutionLoc, width, height);
      gl.uniform1f(uScrollLoc, scrollRef.current);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafRef.current);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
}

export default function HomePage() {
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [isIn3DMode, setIsIn3DMode] = useState<boolean>(false)
  const [gameState, setGameState] = useState<GameState>('IDLE')
  const [isEntering, setIsEntering] = useState(false)

  const { achievements } = useJourney()
  const [currentAchievement, setCurrentAchievement] = useState<typeof achievements[0] | null>(null)

  useEffect(() => {
    const unlockedAchievements = achievements.filter(a => a.unlocked)
    if (unlockedAchievements.length > 0) {
      const latest = unlockedAchievements[unlockedAchievements.length - 1]
      setCurrentAchievement(latest)
    }
  }, [achievements])

  const getRandomImage = useCallback(async () => {
    try {
      const response = await fetch('/api/backgroundImages')
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`)
      const data = await response.json()
      setCurrentImage(data.image)
    } catch (error) {
      console.error('Failed fetching background image:', error)
    }
  }, [])

  useEffect(() => {
    getRandomImage()
  }, [getRandomImage])

  const handleEnter3D = useCallback(() => {
    setIsEntering(true)
    // Small delay for transition effect
    setTimeout(() => setIsIn3DMode(true), 300)
  }, [])

  // Handle changing to a specific image (from scene selection)
  const handleChangeImage = useCallback((newImage: string) => {
    setCurrentImage(newImage)
  }, [])

  return (
    <>
      <Head>
        <title>Alex Welcing | Speculative AI Futures</title>
        <meta
          name="description"
          content="Exploring speculative AI futures, agent civilizations, and emergent intelligence systems."
        />
        <meta name="keywords" content="speculative AI, emergent intelligence, AI futures, Alex Welcing" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph Meta Tags */}
        <meta
          property="og:title"
          content="Speculative AI Futures & Emergent Intelligence Systems | Alex Welcing"
        />
        <meta
          property="og:description"
          content="Exploring speculative AI futures, agent civilizations, and emergent intelligence systems. Original frameworks for understanding worlds where intelligence is abundant."
        />
        <meta property="og:image" content="https://alexwelcing.com/social-preview.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://alexwelcing.com" />
        <meta property="og:type" content="website" />

        {/* X (Twitter) Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Speculative AI Futures & Emergent Intelligence Systems | Alex Welcing" />
        <meta name="twitter:description" content="Exploring speculative AI futures, agent civilizations, and emergent intelligence systems. Original frameworks for understanding worlds where intelligence is abundant." />
        <meta name="twitter:image" content="https://alexwelcing.com/social-preview.png" />

        {/* Performance and PWA hints */}
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="preload" as="image" href="/social-preview.png" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Alex Welcing - Speculative AI Futures",
          url: "https://alexwelcing.com",
          description: "Exploring speculative AI futures, agent civilizations, and emergent intelligence systems.",
          author: { "@type": "Person", name: "Alex Welcing", url: "https://alexwelcing.com/about" }
        }}
      />

      <StructuredData
        type="Person"
        data={{
          name: "Alex Welcing",
          url: "https://alexwelcing.com",
          jobTitle: "AI Futures Researcher",
          description: "Exploring speculative AI futures, agent civilizations, and emergent intelligence systems.",
          sameAs: [
            "https://www.linkedin.com/in/alexwelcing",
            "https://github.com/alexwelcing",
            "https://x.com/alexwelcing"
          ]
        }}
      />

      <SupabaseDataProvider>
        <CircleNav isGamePlaying={gameState === 'PLAYING'} />

        {isIn3DMode ? (
          <main className={styles.main}>
            {currentImage && (
              <ThreeSixty
                currentImage={currentImage}
                isDialogOpen={false}
                onChangeImage={handleChangeImage}
                onGameStateChange={setGameState}
              />
            )}
            <AchievementUnlock
              achievement={currentAchievement}
              onDismiss={() => setCurrentAchievement(null)}
            />
          </main>
        ) : (
          <div
            className="min-h-screen text-white"
            style={{
              opacity: isEntering ? 0 : 1,
              transition: 'opacity 0.3s ease-out',
            }}
          >
            {/* Hero - Immersive, mysterious, minimal */}
            <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
              <HeroCanvas />

              {/* Content overlay */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-4xl">
                <h1
                  className="text-4xl md:text-6xl lg:text-7xl font-light tracking-tight mb-8"
                  style={{
                    fontFamily: "'Inter', -apple-system, sans-serif",
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                  }}
                >
                  <span className="opacity-90">Futures</span>
                  <span className="opacity-60"> where intelligence </span>
                  <span className="opacity-90">emerges</span>
                </h1>

                {/* Two clear paths */}
                <div className="flex flex-col sm:flex-row gap-6 mt-12">
                  <Link
                    href="/articles"
                    className="group relative px-8 py-4 overflow-hidden"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '2px',
                    }}
                  >
                    <span className="relative z-10 text-sm font-medium tracking-widest uppercase text-white/80 group-hover:text-white transition-colors">
                      Explore Research
                    </span>
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.1), rgba(255, 215, 0, 0.05))',
                      }}
                    />
                  </Link>

                  <button
                    onClick={handleEnter3D}
                    className="group relative px-8 py-4 overflow-hidden cursor-pointer"
                    style={{
                      background: 'rgba(0, 212, 255, 0.08)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      borderRadius: '2px',
                    }}
                  >
                    <span className="relative z-10 text-sm font-medium tracking-widest uppercase" style={{ color: 'rgba(0, 212, 255, 0.9)' }}>
                      Enter World
                    </span>
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.15), rgba(0, 212, 255, 0.05))',
                      }}
                    />
                  </button>
                </div>
              </div>

              {/* Scroll indicator */}
              <div
                className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
                style={{
                  animation: 'float 3s ease-in-out infinite',
                }}
              >
                <div
                  className="w-px h-16 opacity-30"
                  style={{
                    background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.5), transparent)',
                  }}
                />
              </div>

              <style jsx>{`
                @keyframes float {
                  0%, 100% { transform: translateX(-50%) translateY(0); }
                  50% { transform: translateX(-50%) translateY(8px); }
                }
              `}</style>
            </section>

            {/* Featured work - Clean, minimal grid */}
            <section id="work" className="py-24 px-6" style={{ background: '#030308' }}>
              <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-baseline mb-16">
                  <h2
                    className="text-2xl font-light tracking-tight"
                    style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    Recent Work
                  </h2>
                  <Link
                    href="/articles"
                    className="text-sm tracking-widest uppercase transition-colors"
                    style={{ color: 'rgba(0, 212, 255, 0.7)' }}
                  >
                    View All
                  </Link>
                </div>
                <ArticleList limit={3} showTitle={false} />
              </div>
            </section>
          </div>
        )}
      </SupabaseDataProvider>
    </>
  )
}
