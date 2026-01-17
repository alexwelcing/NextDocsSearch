import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Text, Plane, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ORB_COLORS } from './types';

interface Terminal3DProps {
  text: string;
  isLoading: boolean;
  prompt?: string; // The user's last prompt
}

const MAX_WIDTH = 3.5;
const LINE_HEIGHT = 1.4;
const FONT_SIZE = 0.12;

export default function Terminal3D({ text, isLoading, prompt }: Terminal3DProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const [status, setStatus] = useState('READY');
  
  // Typewriter effect
  useEffect(() => {
    if (!text) {
      setDisplayedText('');
      return;
    }

    // If we're loading but have text (streaming), we want to show it as it comes
    // Since the parent component handles the streaming accumulation, 
    // we can just set displayedText to text. 
    // To make it look cooler, we could limit the update rate, but simple assignment 
    // works well for "simulating" latency-free if the stream is fast.
    
    // However, for a "terminal" feel, we might want to ensure we don't just jump.
    // But for "avoiding latency", instant update is better.
    setDisplayedText(text);

  }, [text]);

  // Cursor blink
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Status Logic
  useEffect(() => {
    if (isLoading && !text) {
      setStatus('PROCESSING...');
    } else if (isLoading && text) {
      setStatus('RECEIVING DATA STREAM...');
    } else {
      setStatus('IDLE - AWAITING INPUT');
    }
  }, [isLoading, text]);

  // Animated background lines
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
      materialRef.current.uniforms.uLoading.value = isLoading ? 1.0 : 0.0;
    }
  });

  // Shader for the terminal screen
  const shader = useMemo(() => ({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(ORB_COLORS.chat) },
      uLoading: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uLoading;
      varying vec2 vUv;

      void main() {
        // Scanlines
        float scanline = sin(vUv.y * 200.0 + uTime * 5.0) * 0.1;
        
        // Grid
        float gridX = step(0.98, fract(vUv.x * 20.0));
        float gridY = step(0.98, fract(vUv.y * 10.0));
        float grid = max(gridX, gridY) * 0.1;
        
        // Pulse background when loading
        float pulse = sin(uTime * 3.0) * 0.1 * uLoading;

        // Vignette
        float vignette = distance(vUv, vec2(0.5));
        vignette = smoothstep(0.8, 0.2, vignette);

        vec3 color = uColor * (0.05 + pulse + scanline + grid);
        
        gl_FragColor = vec4(color, 0.8 * vignette);
      }
    `,
  }), []);

  return (
    <group>
      {/* Screen Background */}
      <Plane args={[4, 2.5]} position={[0, 0, -0.01]}>
        <shaderMaterial ref={materialRef} args={[shader]} transparent depthWrite={false} />
      </Plane>
      
      {/* Status Header */}
      <group position={[-1.8, 1.1, 0.02]}>
         <Text
          fontSize={0.08}
          color={ORB_COLORS.chat}
          anchorX="left"
          anchorY="top"
        >
          {`> SYSTEM STATUS: ${status}`}
        </Text>
        {isLoading && (
           <Text
            position={[3.5, 0, 0]}
            fontSize={0.08}
            color={ORB_COLORS.chat}
            anchorX="right"
            anchorY="top"
          >
            [ENCRYPTED UPLINK]
          </Text>
        )}
      </group>

      {/* Main Content Area */}
      <group position={[-1.8, 0.9, 0.05]}>
        {/* Previous Prompt Echo */}
        {prompt && (
            <Text
            fontSize={FONT_SIZE}
            color="#88aaff"
            maxWidth={MAX_WIDTH}
            lineHeight={LINE_HEIGHT}
            anchorX="left"
            anchorY="top"
            position={[0, 0, 0]}
            >
            {`> USER: ${prompt}`}
            </Text>
        )}

        {/* AI Response */}
        <Text
          fontSize={FONT_SIZE}
          color="white"
          maxWidth={MAX_WIDTH}
          lineHeight={LINE_HEIGHT}
          anchorX="left"
          anchorY="top"
          position={[0, prompt ? -0.3 : 0, 0]} // Offset if prompt is shown
        >
          {`> ORACLE: ${displayedText}${cursorVisible ? '_' : ''}`}
        </Text>
      </group>

      {/* Loading Animation (Holographic Rings) */}
      {isLoading && !text && (
          <group position={[0, -0.2, 0.2]}>
             <LoadingRings color={ORB_COLORS.chat} />
          </group>
      )}
    </group>
  );
}

function LoadingRings({ color }: { color: string }) {
    const groupRef = useRef<THREE.Group>(null);
    
    useFrame((state) => {
        if(groupRef.current) {
            groupRef.current.rotation.z -= 0.02;
            groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.2;
        }
    });

    return (
        <group ref={groupRef}>
             <mesh>
                <torusGeometry args={[0.5, 0.02, 16, 32]} />
                <meshBasicMaterial color={color} transparent opacity={0.6} />
             </mesh>
             <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.35, 0.02, 16, 32]} />
                <meshBasicMaterial color={color} transparent opacity={0.4} />
             </mesh>
        </group>
    )
}
