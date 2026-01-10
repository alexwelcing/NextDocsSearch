/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ENHANCED HERO CANVAS - RESPONSIVE, ALIVE BACKGROUND
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A beautiful, WebGPU-inspired background shader that responds to:
 * - Mouse position and movement
 * - Scroll position
 * - Time-based animations
 *
 * Features:
 * - Flowing particle field
 * - Reactive metaball-style effects
 * - Noise-based fluid dynamics
 * - Beautiful color gradients
 * - Performance optimized
 */

import React, { useRef, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// VERTEX SHADER
// ═══════════════════════════════════════════════════════════════════════════

const vertexShader = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// FRAGMENT SHADER - WebGPU-inspired responsive effects
// ═══════════════════════════════════════════════════════════════════════════

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uMouse;           // Normalized mouse position (0-1)
  uniform vec2 uMouseVelocity;   // Mouse movement velocity
  uniform float uScroll;         // Scroll progress (0-1)

  // ═══════════════════════════════════════════════════════════════════════
  // NOISE FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════

  // Hash function for pseudo-random values
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  // Smooth noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Fractal Brownian Motion - creates organic, flowing patterns (optimized)
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 3; i++) {
      value += amplitude * noise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value;
  }

  // Domain warping for fluid-like distortion
  vec2 warp(vec2 p, float t) {
    vec2 offset = vec2(
      fbm(p + vec2(1.7, 9.2) + t * 0.1),
      fbm(p + vec2(8.3, 2.8) + t * 0.12)
    );
    return p + offset * 0.4;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VISUAL EFFECTS
  // ═══════════════════════════════════════════════════════════════════════

  // Smooth metaball-like field
  float metaball(vec2 p, vec2 center, float radius) {
    float d = length(p - center);
    return radius / (d * d + 0.001);
  }

  // Flowing energy lines
  float flowLine(vec2 p, float seed) {
    float t = uTime * 0.3 + seed * 10.0;
    vec2 flow = vec2(
      sin(t + p.y * 3.0 + seed) * 0.3,
      cos(t * 0.7 + p.x * 2.0 + seed * 2.0) * 0.2
    );
    p += flow;

    float line = sin(p.x * 8.0 + p.y * 4.0 + t * 2.0 + seed * 5.0);
    line = smoothstep(0.8, 1.0, abs(line));
    return line * 0.15;
  }

  // Particle field with mouse attraction (optimized)
  float particleField(vec2 uv, vec2 mouse) {
    float particles = 0.0;

    for (float i = 0.0; i < 30.0; i++) {
      // Base particle position
      vec2 basePos = vec2(
        hash(vec2(i, 0.0)),
        hash(vec2(0.0, i))
      );

      // Animate particles
      float speed = 0.2 + hash(vec2(i, i)) * 0.3;
      float t = uTime * speed + i;

      vec2 particlePos = basePos + vec2(
        sin(t * 0.5 + i) * 0.1,
        cos(t * 0.3 + i * 0.7) * 0.1
      );

      // Mouse attraction - particles flow toward mouse
      vec2 toMouse = mouse - particlePos;
      float mouseInfluence = exp(-length(toMouse) * 3.0) * 0.15;
      particlePos += toMouse * mouseInfluence;

      // Mouse velocity influence - particles react to movement
      particlePos += uMouseVelocity * 0.05 * exp(-length(particlePos - mouse) * 5.0);

      // Particle rendering
      float dist = length(uv - particlePos);
      float size = 0.002 + hash(vec2(i * 3.0, i)) * 0.003;

      // Twinkle effect
      float twinkle = 0.5 + 0.5 * sin(uTime * (2.0 + hash(vec2(i, i * 2.0))) + i);

      // Glow
      particles += smoothstep(size * 3.0, 0.0, dist) * twinkle * 0.4;
      // Core
      particles += smoothstep(size, 0.0, dist) * twinkle * 0.8;
    }

    return particles;
  }

  // Neural network-like connections (optimized)
  float connections(vec2 uv, vec2 mouse) {
    float conn = 0.0;

    for (float i = 0.0; i < 5.0; i++) {
      vec2 p1 = vec2(hash(vec2(i, 0.0)), hash(vec2(0.0, i)));
      vec2 p2 = vec2(hash(vec2(i + 1.0, 0.0)), hash(vec2(0.0, i + 1.0)));

      // Animate connection endpoints
      float t = uTime * 0.2;
      p1 += vec2(sin(t + i), cos(t * 0.7 + i)) * 0.05;
      p2 += vec2(cos(t * 0.8 + i), sin(t * 0.6 + i)) * 0.05;

      // Line segment distance
      vec2 pa = uv - p1;
      vec2 ba = p2 - p1;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      float d = length(pa - ba * h);

      // Mouse proximity activates connections
      float mouseProx = max(
        exp(-length(mouse - p1) * 4.0),
        exp(-length(mouse - p2) * 4.0)
      );

      conn += smoothstep(0.01, 0.0, d) * mouseProx * 0.5;
    }

    return conn;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN
  // ═══════════════════════════════════════════════════════════════════════

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 p = (gl_FragCoord.xy - uResolution * 0.5) / min(uResolution.x, uResolution.y);

    // Mouse in normalized coordinates
    vec2 mouse = uMouse;

    // ─────────────────────────────────────────────────────────────────────
    // BASE: Deep space gradient with subtle color variation
    // ─────────────────────────────────────────────────────────────────────

    // Rich dark blue-purple base
    vec3 col = vec3(0.008, 0.008, 0.02);

    // Subtle gradient based on position
    col += vec3(0.0, 0.01, 0.02) * (1.0 - uv.y);
    col += vec3(0.01, 0.0, 0.02) * uv.x;

    // ─────────────────────────────────────────────────────────────────────
    // LAYER 1: Flowing noise field (responds to mouse)
    // ─────────────────────────────────────────────────────────────────────

    // Warp coordinates based on mouse position
    vec2 warpedP = warp(p * 2.0 + mouse * 0.3, uTime);
    float noiseField = fbm(warpedP);

    // Mouse-reactive color in noise field
    float mouseInfluence = exp(-length(p - (mouse - 0.5) * 2.0) * 2.0);

    // Cyan tint near mouse, purple away
    vec3 noiseColor = mix(
      vec3(0.02, 0.01, 0.04),  // Purple (far from mouse)
      vec3(0.0, 0.06, 0.08),   // Cyan (near mouse)
      mouseInfluence
    );

    col += noiseColor * noiseField * 0.8;

    // ─────────────────────────────────────────────────────────────────────
    // LAYER 2: Metaball-style mouse glow
    // ─────────────────────────────────────────────────────────────────────

    // Primary mouse glow
    vec2 mouseWorld = (mouse - 0.5) * 2.0;
    float mouseGlow = metaball(p, mouseWorld, 0.02);
    mouseGlow = smoothstep(0.1, 2.0, mouseGlow);

    // Trailing glows based on velocity
    float velMag = length(uMouseVelocity);
    vec2 trail1 = mouseWorld - normalize(uMouseVelocity + 0.001) * 0.1 * velMag;
    vec2 trail2 = mouseWorld - normalize(uMouseVelocity + 0.001) * 0.2 * velMag;

    float trailGlow = metaball(p, trail1, 0.01) + metaball(p, trail2, 0.005);
    trailGlow = smoothstep(0.05, 1.0, trailGlow) * velMag * 5.0;

    // Cyan glow color
    col += vec3(0.0, 0.5, 0.7) * mouseGlow * 0.3;
    col += vec3(0.0, 0.4, 0.6) * trailGlow * 0.2;

    // ─────────────────────────────────────────────────────────────────────
    // LAYER 3: Particle field
    // ─────────────────────────────────────────────────────────────────────

    float particles = particleField(uv, mouse);

    // Multi-colored particles
    vec3 particleColor = mix(
      vec3(0.6, 0.7, 1.0),   // Cool blue-white
      vec3(0.0, 0.9, 1.0),   // Bright cyan
      mouseInfluence
    );

    col += particleColor * particles;

    // ─────────────────────────────────────────────────────────────────────
    // LAYER 4: Neural connections (mouse-activated)
    // ─────────────────────────────────────────────────────────────────────

    float conn = connections(uv, mouse);
    col += vec3(0.0, 0.8, 1.0) * conn;

    // ─────────────────────────────────────────────────────────────────────
    // LAYER 5: Flowing energy lines (optimized)
    // ─────────────────────────────────────────────────────────────────────

    for (float i = 0.0; i < 2.0; i++) {
      float line = flowLine(p, i);
      vec3 lineColor = mix(
        vec3(0.1, 0.0, 0.2),
        vec3(0.0, 0.3, 0.4),
        i / 2.0
      );
      col += lineColor * line * (1.0 + mouseInfluence * 2.0);
    }

    // ─────────────────────────────────────────────────────────────────────
    // LAYER 6: Central emergence glow
    // ─────────────────────────────────────────────────────────────────────

    float centerDist = length(p);
    float centralGlow = exp(-centerDist * 1.5);
    float pulse = 0.7 + 0.3 * sin(uTime * 0.5);

    // Golden-cyan gradient in center
    vec3 centerColor = mix(
      vec3(0.0, 0.08, 0.12),    // Cyan base
      vec3(0.1, 0.08, 0.0),     // Golden hint
      sin(uTime * 0.3) * 0.5 + 0.5
    );

    col += centerColor * centralGlow * pulse;

    // ─────────────────────────────────────────────────────────────────────
    // LAYER 7: Radial pulse rings (mouse triggered)
    // ─────────────────────────────────────────────────────────────────────

    float ring1 = abs(sin(centerDist * 15.0 - uTime * 2.0));
    ring1 = smoothstep(0.9, 1.0, ring1) * exp(-centerDist * 3.0);

    float mouseRing = abs(sin(length(p - mouseWorld) * 20.0 - uTime * 4.0));
    mouseRing = smoothstep(0.95, 1.0, mouseRing) * exp(-length(p - mouseWorld) * 5.0) * velMag * 3.0;

    col += vec3(0.0, 0.15, 0.2) * ring1;
    col += vec3(0.0, 0.4, 0.5) * mouseRing;

    // ─────────────────────────────────────────────────────────────────────
    // POST-PROCESSING
    // ─────────────────────────────────────────────────────────────────────

    // Scroll fade
    col *= 1.0 - uScroll * 0.5;

    // Vignette
    float vignette = 1.0 - smoothstep(0.3, 1.3, centerDist);
    col *= vignette;

    // Subtle film grain
    float grain = hash(uv * uTime * 100.0) * 0.02;
    col += grain;

    // Tone mapping for HDR-like effect
    col = col / (col + 0.5);

    // Slight contrast boost
    col = pow(col, vec3(0.95));

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface EnhancedHeroCanvasProps {
  className?: string;
}

export default function EnhancedHeroCanvas({ className }: EnhancedHeroCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const mouseVelocityRef = useRef({ x: 0, y: 0 });
  const prevMouseRef = useRef({ x: 0.5, y: 0.5 });
  const scrollRef = useRef(0);

  // Smooth mouse tracking
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const x = e.clientX / window.innerWidth;
    const y = 1.0 - e.clientY / window.innerHeight; // Flip Y for WebGL

    // Calculate velocity
    mouseVelocityRef.current = {
      x: x - prevMouseRef.current.x,
      y: y - prevMouseRef.current.y,
    };

    prevMouseRef.current = { x, y };
    mouseRef.current = { x, y };
  }, []);

  // Touch support
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const x = touch.clientX / window.innerWidth;
      const y = 1.0 - touch.clientY / window.innerHeight;

      mouseVelocityRef.current = {
        x: x - prevMouseRef.current.x,
        y: y - prevMouseRef.current.y,
      };

      prevMouseRef.current = { x, y };
      mouseRef.current = { x, y };
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return;

    // Create shaders
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    gl.shaderSource(vs, vertexShader);
    gl.compileShader(vs);

    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('Vertex shader error:', gl.getShaderInfoLog(vs));
      return;
    }

    gl.shaderSource(fs, fragmentShader);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fs));
      return;
    }

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Fullscreen quad
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const uTimeLoc = gl.getUniformLocation(program, 'uTime');
    const uResolutionLoc = gl.getUniformLocation(program, 'uResolution');
    const uMouseLoc = gl.getUniformLocation(program, 'uMouse');
    const uMouseVelocityLoc = gl.getUniformLocation(program, 'uMouseVelocity');
    const uScrollLoc = gl.getUniformLocation(program, 'uScroll');

    const startTime = performance.now();

    // Event listeners
    const handleScroll = () => {
      scrollRef.current = Math.min(window.scrollY / window.innerHeight, 1);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // Smooth velocity decay
    let smoothVelX = 0;
    let smoothVelY = 0;

    const animate = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const width = Math.floor(window.innerWidth * dpr);
      const height = Math.floor(window.innerHeight * dpr);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      // Smooth velocity interpolation
      smoothVelX = smoothVelX * 0.9 + mouseVelocityRef.current.x * 0.1;
      smoothVelY = smoothVelY * 0.9 + mouseVelocityRef.current.y * 0.1;

      // Decay velocity reference
      mouseVelocityRef.current.x *= 0.95;
      mouseVelocityRef.current.y *= 0.95;

      const elapsed = (performance.now() - startTime) / 1000;

      gl.uniform1f(uTimeLoc, elapsed);
      gl.uniform2f(uResolutionLoc, width, height);
      gl.uniform2f(uMouseLoc, mouseRef.current.x, mouseRef.current.y);
      gl.uniform2f(uMouseVelocityLoc, smoothVelX * 10, smoothVelY * 10);
      gl.uniform1f(uScrollLoc, scrollRef.current);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      cancelAnimationFrame(rafRef.current);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [handleMouseMove, handleTouchMove]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
}
