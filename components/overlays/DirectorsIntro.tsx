/**
 * DirectorsIntro - A sophisticated GLSL shader-based introduction
 *
 * Demonstrates visual mastery through GPU shaders while:
 * 1. Buying loading time for 3D/gaussian/effects
 * 2. Creating mystery without over-explanation
 * 3. Showing the path rather than telling
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface DirectorsIntroProps {
  onComplete: () => void;
  onSkip: () => void;
  onProgressUpdate?: (progress: number) => void;
}

// Vertex shader - simple passthrough
const vertexShader = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Fragment shader - sophisticated visual composition
const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uPhase;
  uniform vec2 uResolution;
  uniform float uTransition;

  #define PI 3.14159265359
  #define TAU 6.28318530718

  // Noise functions
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  // Signed distance functions
  float sdCircle(vec2 p, float r) {
    return length(p) - r;
  }

  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }

  // Rotation matrix
  mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
  }

  // Phase 1: Void awakening - particles coalescing
  vec3 phaseVoid(vec2 uv, float t) {
    vec3 col = vec3(0.012, 0.012, 0.031);

    // Distant stars
    for (float i = 0.0; i < 100.0; i++) {
      vec2 starPos = vec2(
        hash(vec2(i, 0.0)) * 2.0 - 1.0,
        hash(vec2(0.0, i)) * 2.0 - 1.0
      );
      float starDist = length(uv - starPos);
      float starBrightness = smoothstep(0.01, 0.0, starDist);
      starBrightness *= 0.3 + 0.7 * sin(t * 2.0 + i);
      col += vec3(0.8, 0.9, 1.0) * starBrightness * 0.5;
    }

    // Converging particles
    float convergence = smoothstep(0.0, 1.0, t * 0.5);
    for (float i = 0.0; i < 50.0; i++) {
      vec2 origin = vec2(
        hash(vec2(i * 7.0, 3.0)) * 4.0 - 2.0,
        hash(vec2(3.0, i * 11.0)) * 4.0 - 2.0
      );
      vec2 particlePos = mix(origin, vec2(0.0), convergence);
      float dist = length(uv - particlePos);
      float glow = exp(-dist * 30.0) * (0.5 + 0.5 * sin(t * 3.0 + i));
      col += vec3(0.0, 0.83, 1.0) * glow * 0.3;
    }

    return col;
  }

  // Phase 2: Emergence - intelligence forming
  vec3 phaseEmergence(vec2 uv, float t) {
    vec3 col = vec3(0.012, 0.012, 0.031);

    // Central form emerging
    vec2 p = uv;

    // Rotating geometry layers
    for (float i = 0.0; i < 5.0; i++) {
      float angle = t * (0.2 + i * 0.1) + i * PI / 5.0;
      vec2 rotP = rot(angle) * p;

      float scale = 0.3 + i * 0.1;
      float d = sdBox(rotP, vec2(scale * (0.3 + 0.2 * sin(t + i))));

      float edge = smoothstep(0.02, 0.0, abs(d));
      vec3 edgeColor = mix(
        vec3(0.0, 0.83, 1.0),
        vec3(1.0, 0.84, 0.0),
        i / 5.0
      );
      col += edgeColor * edge * (0.3 + 0.2 * sin(t * 2.0 + i));
    }

    // Inner glow
    float innerGlow = exp(-length(uv) * 3.0);
    col += vec3(0.0, 0.83, 1.0) * innerGlow * 0.5 * (0.8 + 0.2 * sin(t * 4.0));

    // Orbiting particles
    for (float i = 0.0; i < 20.0; i++) {
      float orbitRadius = 0.2 + hash(vec2(i, 0.0)) * 0.6;
      float orbitSpeed = 0.5 + hash(vec2(0.0, i)) * 1.5;
      float orbitAngle = t * orbitSpeed + i * TAU / 20.0;
      vec2 orbitPos = vec2(cos(orbitAngle), sin(orbitAngle)) * orbitRadius;
      float dist = length(uv - orbitPos);
      float particle = exp(-dist * 50.0);
      col += vec3(1.0, 0.84, 0.0) * particle * 0.4;
    }

    return col;
  }

  // Phase 3: Portal - gateway revealing
  vec3 phasePortal(vec2 uv, float t) {
    vec3 col = vec3(0.012, 0.012, 0.031);

    float radius = length(uv);
    float angle = atan(uv.y, uv.x);

    // Portal ring expansion
    float ringRadius = 0.2 + smoothstep(0.0, 1.0, t) * 0.6;
    float ring = smoothstep(0.03, 0.0, abs(radius - ringRadius));

    // Animated ring distortion
    float distortion = sin(angle * 8.0 + t * 3.0) * 0.02;
    ring = smoothstep(0.03, 0.0, abs(radius - ringRadius - distortion));

    col += vec3(0.0, 0.83, 1.0) * ring * 2.0;

    // Inner portal effect
    if (radius < ringRadius) {
      // Warped space inside
      vec2 warpedUV = uv / (ringRadius + 0.001);
      float warp = fbm(warpedUV * 3.0 + t * 0.5);

      // Depth layers
      for (float i = 0.0; i < 5.0; i++) {
        float layerDepth = i / 5.0;
        vec2 layerUV = warpedUV * (1.0 + layerDepth * 0.5);
        layerUV = rot(t * 0.2 * (1.0 + i * 0.3)) * layerUV;

        float layerNoise = fbm(layerUV * 2.0 + t * 0.3);
        vec3 layerColor = mix(
          vec3(0.0, 0.2, 0.4),
          vec3(0.0, 0.83, 1.0),
          layerNoise
        );
        col += layerColor * 0.15 * (1.0 - layerDepth);
      }

      // Central light
      float centerGlow = exp(-length(warpedUV) * 2.0);
      col += vec3(1.0, 0.95, 0.9) * centerGlow * 0.6;
    }

    // Outer energy tendrils
    for (float i = 0.0; i < 12.0; i++) {
      float tendrilAngle = i * TAU / 12.0 + t * 0.5;
      vec2 tendrilDir = vec2(cos(tendrilAngle), sin(tendrilAngle));
      float tendrilDist = dot(uv - tendrilDir * ringRadius * 0.95, tendrilDir);
      float tendrilWidth = abs(dot(uv - tendrilDir * ringRadius * 0.95, vec2(-tendrilDir.y, tendrilDir.x)));

      if (tendrilDist > 0.0 && tendrilDist < 0.3) {
        float tendril = exp(-tendrilWidth * 40.0) * exp(-tendrilDist * 5.0);
        tendril *= 0.5 + 0.5 * sin(t * 4.0 + i);
        col += vec3(1.0, 0.84, 0.0) * tendril * 0.5;
      }
    }

    return col;
  }

  // Phase 4: Transcendence - final reveal
  vec3 phaseTranscendence(vec2 uv, float t) {
    vec3 col = vec3(0.012, 0.012, 0.031);

    // Expanding light
    float expansion = smoothstep(0.0, 1.0, t);
    float radius = expansion * 2.0;

    // Central bright area growing
    float dist = length(uv);
    float brightness = smoothstep(radius, radius * 0.5, dist);

    // Color transition from portal blue to warm white
    vec3 lightColor = mix(
      vec3(0.0, 0.83, 1.0),
      vec3(1.0, 0.98, 0.95),
      expansion
    );

    col = mix(col, lightColor, brightness * expansion);

    // Edge glow
    float edgeGlow = smoothstep(radius + 0.1, radius, dist) * smoothstep(radius - 0.2, radius, dist);
    col += vec3(0.0, 0.83, 1.0) * edgeGlow * (1.0 - expansion * 0.5);

    return col;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - uResolution.xy * 0.5) / min(uResolution.x, uResolution.y);

    float t = uTime;
    vec3 col;

    // Phase transitions
    if (uPhase < 1.0) {
      col = phaseVoid(uv, t);
    } else if (uPhase < 2.0) {
      float blend = fract(uPhase);
      col = mix(phaseVoid(uv, t), phaseEmergence(uv, t), blend);
    } else if (uPhase < 3.0) {
      float blend = fract(uPhase);
      col = mix(phaseEmergence(uv, t), phasePortal(uv, t - 2.0), blend);
    } else if (uPhase < 4.0) {
      float blend = fract(uPhase);
      col = mix(phasePortal(uv, t - 2.0), phaseTranscendence(uv, t - 4.0), blend);
    } else {
      col = phaseTranscendence(uv, t - 4.0);
    }

    // Final transition fade to world
    col = mix(col, vec3(0.0), uTransition);

    // Vignette
    float vignette = 1.0 - smoothstep(0.5, 1.5, length(uv));
    col *= vignette;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function DirectorsIntro({ onComplete, onSkip, onProgressUpdate }: DirectorsIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const startTimeRef = useRef<number>(0);

  const [phase, setPhase] = useState(0);
  const [showText, setShowText] = useState(false);
  const [textIndex, setTextIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  // Evocative, minimal text sequence
  const textSequence = [
    '',
    'Beyond the familiar',
    'lies the extraordinary.',
    '',
  ];

  // Total duration: 12 seconds for loading buffer
  const PHASE_DURATION = 2.5; // seconds per phase
  const TOTAL_DURATION = 12; // total seconds

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: false
    });
    if (!gl) return;

    glRef.current = gl;

    // Create shaders
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    gl.shaderSource(vs, vertexShader);
    gl.compileShader(vs);

    gl.shaderSource(fs, fragmentShader);
    gl.compileShader(fs);

    // Check for shader errors
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fs));
      return;
    }

    // Create program
    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    programRef.current = program;

    // Create fullscreen quad
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Set initial time
    startTimeRef.current = performance.now();

    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  // Animation loop
  useEffect(() => {
    const gl = glRef.current;
    const program = programRef.current;
    const canvas = canvasRef.current;
    if (!gl || !program || !canvas) return;

    const animate = () => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      const progress = Math.min(elapsed / TOTAL_DURATION, 1);

      // Update phase
      const currentPhase = Math.min(elapsed / PHASE_DURATION, 4.5);
      setPhase(currentPhase);

      // Text timing
      if (elapsed > 2 && elapsed < 4) {
        setShowText(true);
        setTextIndex(1);
      } else if (elapsed > 4 && elapsed < 7) {
        setTextIndex(2);
      } else if (elapsed > 7) {
        setShowText(false);
      }

      // Fade out at end
      if (elapsed > TOTAL_DURATION - 1.5) {
        setFadeOut(true);
      }

      // Report progress
      onProgressUpdate?.(progress);

      // Complete
      if (elapsed >= TOTAL_DURATION) {
        onComplete();
        return;
      }

      // Resize canvas
      const dpr = Math.min(window.devicePixelRatio, 2);
      const width = window.innerWidth * dpr;
      const height = window.innerHeight * dpr;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      // Update uniforms
      const uTimeLoc = gl.getUniformLocation(program, 'uTime');
      const uPhaseLoc = gl.getUniformLocation(program, 'uPhase');
      const uResolutionLoc = gl.getUniformLocation(program, 'uResolution');
      const uTransitionLoc = gl.getUniformLocation(program, 'uTransition');

      gl.uniform1f(uTimeLoc, elapsed);
      gl.uniform1f(uPhaseLoc, currentPhase);
      gl.uniform2f(uResolutionLoc, width, height);
      gl.uniform1f(uTransitionLoc, fadeOut ? Math.min((elapsed - (TOTAL_DURATION - 1.5)) / 1.5, 1) : 0);

      // Render
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [onComplete, onProgressUpdate]);

  const handleSkip = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    onSkip();
  }, [onSkip]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: '#030308',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Minimal text overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: 'clamp(18px, 3vw, 28px)',
            fontWeight: 300,
            color: 'rgba(255, 255, 255, 0.9)',
            letterSpacing: '0.1em',
            textAlign: 'center',
            opacity: showText ? 1 : 0,
            transform: showText ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 1s ease-out',
          }}
        >
          {textSequence[textIndex]}
        </div>
      </div>

      {/* Skip button - subtle, professional */}
      <button
        onClick={handleSkip}
        style={{
          position: 'absolute',
          bottom: 40,
          right: 40,
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 4,
          padding: '10px 20px',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '12px',
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontWeight: 400,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
        }}
      >
        Skip
      </button>

      {/* Progress indicator - minimal line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: `${(phase / 4.5) * 100}%`,
          height: 2,
          background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.8), rgba(255, 215, 0, 0.8))',
          transition: 'width 0.1s linear',
        }}
      />
    </div>
  );
}
