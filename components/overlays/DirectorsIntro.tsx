/**
 * DirectorsIntro - A cinematic GLSL shader experience
 *
 * This is the directorial debut - demonstrating visual mastery through:
 * 1. Raymarched volumetric 3D effects
 * 2. Sophisticated noise and fractal patterns
 * 3. Bloom and glow post-processing
 * 4. Dramatic lighting and atmosphere
 *
 * Visual journey: Void → Nebula → Neural Emergence → Cosmic Portal → Transcendence
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface DirectorsIntroProps {
  onComplete: () => void;
  onSkip: () => void;
  onProgressUpdate?: (progress: number) => void;
}

// Vertex shader
const vertexShader = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Advanced fragment shader with raymarching and volumetric effects
const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uPhase;
  uniform vec2 uResolution;
  uniform float uTransition;

  #define PI 3.14159265359
  #define TAU 6.28318530718
  #define MAX_STEPS 64
  #define MAX_DIST 100.0
  #define SURF_DIST 0.001

  // ==========================================
  // NOISE FUNCTIONS - Simplex-based for quality
  // ==========================================

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // Fractional Brownian Motion
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  // Worley noise for cellular patterns
  float worley(vec3 p) {
    vec3 id = floor(p);
    vec3 fd = fract(p);
    float minDist = 1.0;

    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        for (int z = -1; z <= 1; z++) {
          vec3 coord = vec3(float(x), float(y), float(z));
          vec3 rId = id + coord;
          vec3 r = coord + 0.5 + 0.5 * sin(
            6.2831 * vec3(
              fract(sin(dot(rId, vec3(12.9898, 78.233, 45.164))) * 43758.5453),
              fract(sin(dot(rId, vec3(93.9898, 67.345, 82.567))) * 28461.3254),
              fract(sin(dot(rId, vec3(45.4321, 12.873, 91.234))) * 63728.1284)
            )
          ) - fd;
          float d = dot(r, r);
          minDist = min(minDist, d);
        }
      }
    }
    return sqrt(minDist);
  }

  // ==========================================
  // ROTATION AND TRANSFORMS
  // ==========================================

  mat2 rot2D(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  mat3 rotateX(float a) {
    float c = cos(a), s = sin(a);
    return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
  }

  mat3 rotateY(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
  }

  // ==========================================
  // SIGNED DISTANCE FUNCTIONS
  // ==========================================

  float sdSphere(vec3 p, float r) {
    return length(p) - r;
  }

  float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
  }

  float sdOctahedron(vec3 p, float s) {
    p = abs(p);
    return (p.x + p.y + p.z - s) * 0.57735027;
  }

  float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
  }

  // ==========================================
  // PHASE 1: COSMIC VOID - Deep space awakening
  // ==========================================

  vec3 phaseVoid(vec2 uv, float t) {
    vec3 col = vec3(0.008, 0.008, 0.02);

    // Deep space nebula background
    vec3 nebula = vec3(0.0);
    for (float i = 0.0; i < 3.0; i++) {
      float scale = 1.5 + i * 0.8;
      float speed = 0.1 + i * 0.05;
      vec3 p = vec3(uv * scale, t * speed + i * 10.0);

      float n = fbm(p);
      float w = worley(p * 2.0);

      vec3 nebulaColor = mix(
        vec3(0.0, 0.1, 0.3),   // Deep blue
        vec3(0.0, 0.5, 0.8),   // Cyan
        n * 0.5 + 0.5
      );
      nebulaColor = mix(nebulaColor, vec3(0.8, 0.6, 0.0), w * 0.2); // Gold highlights

      nebula += nebulaColor * (n * 0.5 + 0.5) * (1.0 - i * 0.25) * 0.15;
    }
    col += nebula;

    // Stars - multiple layers with different sizes
    for (float layer = 0.0; layer < 3.0; layer++) {
      float starDensity = 80.0 + layer * 40.0;
      float starSize = 0.008 - layer * 0.002;

      for (float i = 0.0; i < starDensity; i++) {
        float seed = i * 127.1 + layer * 311.7;
        vec2 starPos = vec2(
          fract(sin(seed) * 43758.5453) * 2.0 - 1.0,
          fract(sin(seed * 1.3) * 28573.1284) * 2.0 - 1.0
        ) * (1.0 + layer * 0.3);

        float starDist = length(uv - starPos);
        float twinkle = 0.5 + 0.5 * sin(t * (2.0 + fract(sin(seed * 2.7) * 12345.0) * 3.0) + seed);

        if (starDist < starSize * (0.5 + twinkle * 0.5)) {
          float brightness = smoothstep(starSize, 0.0, starDist) * twinkle;

          vec3 starColor = mix(
            vec3(0.9, 0.95, 1.0),
            vec3(1.0, 0.9, 0.7),
            fract(sin(seed * 3.1) * 54321.0)
          );
          col += starColor * brightness * (0.3 + layer * 0.1);
        }
      }
    }

    // Awakening pulse from center
    float awakening = smoothstep(0.0, 3.0, t);
    float pulse = exp(-length(uv) * (3.0 - awakening * 2.0));
    pulse *= 0.5 + 0.5 * sin(t * 2.0 - length(uv) * 5.0);
    col += vec3(0.0, 0.7, 1.0) * pulse * awakening * 0.4;

    // Converging energy streams
    float convergence = smoothstep(1.0, 3.0, t);
    for (float i = 0.0; i < 8.0; i++) {
      float angle = i * TAU / 8.0 + t * 0.1;
      vec2 dir = vec2(cos(angle), sin(angle));
      vec2 origin = dir * 2.0;
      vec2 current = mix(origin, vec2(0.0), convergence);

      float streamDist = length(uv - current);
      float stream = exp(-streamDist * 15.0) * convergence;
      stream *= 0.5 + 0.5 * sin(t * 4.0 + i);

      col += vec3(0.0, 0.8, 1.0) * stream * 0.3;
    }

    return col;
  }

  // ==========================================
  // PHASE 2: NEURAL EMERGENCE - Intelligence forming
  // ==========================================

  vec3 phaseEmergence(vec2 uv, float t) {
    vec3 col = vec3(0.008, 0.008, 0.02);

    // Neural network pattern using worley noise
    float cells = worley(vec3(uv * 4.0, t * 0.2));
    float cellEdges = 1.0 - smoothstep(0.0, 0.15, cells);

    vec3 neuralColor = mix(
      vec3(0.0, 0.3, 0.6),
      vec3(0.0, 0.8, 1.0),
      cellEdges
    );
    col += neuralColor * cellEdges * 0.5;

    // Synaptic pulses traveling along edges
    float pulse1 = fract(t * 0.3 - cells * 2.0);
    float pulse2 = fract(t * 0.3 - cells * 2.0 + 0.5);
    float pulseIntensity = smoothstep(0.0, 0.1, pulse1) * smoothstep(0.2, 0.1, pulse1);
    pulseIntensity += smoothstep(0.0, 0.1, pulse2) * smoothstep(0.2, 0.1, pulse2);

    col += vec3(1.0, 0.9, 0.3) * pulseIntensity * cellEdges * 0.6;

    // Central consciousness core
    float coreRadius = 0.3 + 0.1 * sin(t);
    float coreDist = length(uv);
    float core = smoothstep(coreRadius + 0.1, coreRadius, coreDist);

    // Core internal structure - rotating sacred geometry
    vec2 coreUV = uv;
    coreUV = rot2D(t * 0.3) * coreUV;

    float geometry = 0.0;
    for (float i = 0.0; i < 6.0; i++) {
      float angle = i * TAU / 6.0;
      vec2 axis = vec2(cos(angle), sin(angle));
      float line = abs(dot(coreUV, axis));
      geometry += smoothstep(0.02, 0.0, line - 0.15 * (0.5 + 0.5 * sin(t + i)));
    }

    col += vec3(0.0, 0.9, 1.0) * core * 0.4;
    col += vec3(1.0, 0.85, 0.0) * geometry * core * 0.3;

    // Orbiting data fragments
    for (float i = 0.0; i < 12.0; i++) {
      float orbitR = 0.4 + 0.2 * sin(i * 0.7);
      float orbitSpeed = 0.5 + 0.3 * cos(i * 1.3);
      float orbitAngle = t * orbitSpeed + i * TAU / 12.0;

      vec2 fragPos = vec2(cos(orbitAngle), sin(orbitAngle)) * orbitR;
      float fragDist = length(uv - fragPos);

      // Triangle-shaped fragments
      vec2 localUV = rot2D(orbitAngle) * (uv - fragPos);
      float tri = max(abs(localUV.x) * 0.866 + localUV.y * 0.5, -localUV.y) - 0.03;
      float fragment = smoothstep(0.01, 0.0, tri);

      col += vec3(1.0, 0.8, 0.2) * fragment * (0.3 + 0.2 * sin(t * 3.0 + i));
    }

    // Outer glow
    float outerGlow = exp(-coreDist * 2.0) * (0.3 + 0.1 * sin(t * 2.0));
    col += vec3(0.0, 0.6, 1.0) * outerGlow;

    return col;
  }

  // ==========================================
  // PHASE 3: COSMIC PORTAL - Gateway to beyond
  // ==========================================

  float portalScene(vec3 p, float t) {
    // Torus portal ring
    p = rotateX(t * 0.2) * p;
    p = rotateY(t * 0.15) * p;

    float torus = sdTorus(p, vec2(1.0, 0.15));

    // Inner geometric form
    vec3 geoP = rotateY(t * 0.5) * rotateX(t * 0.3) * p;
    float octa = sdOctahedron(geoP, 0.4);

    // Combine with smooth blend
    float scene = opSmoothUnion(torus, octa, 0.3);

    // Add organic displacement
    scene += 0.05 * snoise(p * 5.0 + t);

    return scene;
  }

  vec3 portalNormal(vec3 p, float t) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
      portalScene(p + e.xyy, t) - portalScene(p - e.xyy, t),
      portalScene(p + e.yxy, t) - portalScene(p - e.yxy, t),
      portalScene(p + e.yyx, t) - portalScene(p - e.yyx, t)
    ));
  }

  vec3 phasePortal(vec2 uv, float t) {
    vec3 col = vec3(0.008, 0.008, 0.02);

    // Raymarching setup
    vec3 ro = vec3(0.0, 0.0, 3.5);
    vec3 rd = normalize(vec3(uv, -1.5));

    // Ray march
    float td = 0.0;
    vec3 p;
    bool hit = false;

    for (int i = 0; i < MAX_STEPS; i++) {
      p = ro + rd * td;
      float d = portalScene(p, t);

      if (d < SURF_DIST) {
        hit = true;
        break;
      }
      if (td > MAX_DIST) break;

      td += d * 0.8;
    }

    if (hit) {
      vec3 n = portalNormal(p, t);

      // Fresnel effect
      float fresnel = pow(1.0 - max(0.0, dot(-rd, n)), 3.0);

      // Base color with energy gradient
      vec3 baseColor = mix(
        vec3(0.0, 0.5, 1.0),
        vec3(0.0, 1.0, 0.9),
        fresnel
      );

      // Energy pulse
      float energyPulse = 0.5 + 0.5 * sin(p.x * 10.0 + p.y * 10.0 + t * 4.0);
      baseColor += vec3(1.0, 0.8, 0.2) * energyPulse * 0.3;

      // Rim light
      float rim = pow(fresnel, 2.0);
      baseColor += vec3(1.0, 0.95, 0.9) * rim;

      col = baseColor;
    }

    // Portal center vortex
    float vortexDist = length(uv);
    if (vortexDist < 0.8) {
      vec2 vortexUV = uv;
      float vortexAngle = atan(vortexUV.y, vortexUV.x);

      // Spiral distortion
      float spiral = vortexAngle + vortexDist * 8.0 - t * 2.0;
      float vortexPattern = 0.5 + 0.5 * sin(spiral * 4.0);

      // Depth layers
      for (float i = 0.0; i < 5.0; i++) {
        float layerDepth = i / 5.0;
        float layerScale = 1.0 + layerDepth * 2.0;
        vec2 layerUV = rot2D(t * 0.1 * (i + 1.0)) * vortexUV * layerScale;

        float layerNoise = fbm(vec3(layerUV * 2.0, t * 0.2 + i));

        vec3 layerCol = mix(
          vec3(0.0, 0.2, 0.5),
          vec3(0.0, 0.8, 1.0),
          layerNoise
        );

        float layerMask = smoothstep(0.8, 0.3, vortexDist) * (1.0 - layerDepth * 0.5);
        col = mix(col, layerCol, layerMask * 0.3 * vortexPattern);
      }

      // Central bright core
      float coreGlow = exp(-vortexDist * 4.0);
      col += vec3(1.0, 0.98, 0.95) * coreGlow * 0.5;
    }

    // Energy tendrils radiating outward
    for (float i = 0.0; i < 8.0; i++) {
      float tendrilAngle = i * TAU / 8.0 + t * 0.3;
      vec2 tendrilDir = vec2(cos(tendrilAngle), sin(tendrilAngle));

      float along = dot(uv, tendrilDir);
      float perp = abs(dot(uv, vec2(-tendrilDir.y, tendrilDir.x)));

      if (along > 0.0) {
        float tendril = exp(-perp * 20.0) * exp(-along * 2.0);
        float pulse = 0.5 + 0.5 * sin(along * 20.0 - t * 8.0 + i * 2.0);
        tendril *= pulse;

        vec3 tendrilColor = mix(
          vec3(0.0, 0.8, 1.0),
          vec3(1.0, 0.85, 0.0),
          along
        );
        col += tendrilColor * tendril * 0.4;
      }
    }

    return col;
  }

  // ==========================================
  // PHASE 4: TRANSCENDENCE - Light revelation
  // ==========================================

  vec3 phaseTranscendence(vec2 uv, float t) {
    vec3 col = vec3(0.008, 0.008, 0.02);

    float expansion = smoothstep(0.0, 2.0, t);

    // Expanding light sphere
    float lightRadius = expansion * 2.5;
    float dist = length(uv);

    // Core brightness
    float coreBrightness = smoothstep(lightRadius, 0.0, dist);

    // Light color transition: cyan → gold → white
    vec3 lightColor;
    if (expansion < 0.5) {
      lightColor = mix(vec3(0.0, 0.8, 1.0), vec3(1.0, 0.85, 0.0), expansion * 2.0);
    } else {
      lightColor = mix(vec3(1.0, 0.85, 0.0), vec3(1.0, 0.99, 0.97), (expansion - 0.5) * 2.0);
    }

    col = mix(col, lightColor, coreBrightness * pow(expansion, 0.5));

    // God rays emanating from center
    float angle = atan(uv.y, uv.x);
    float rays = 0.0;
    for (float i = 0.0; i < 12.0; i++) {
      float rayAngle = i * TAU / 12.0 + t * 0.2;
      float rayWidth = 0.15;
      float rayDiff = abs(mod(angle - rayAngle + PI, TAU) - PI);
      rays += smoothstep(rayWidth, 0.0, rayDiff) * exp(-dist * 1.5);
    }
    col += lightColor * rays * expansion * 0.4;

    // Edge glow ring
    float ringDist = abs(dist - lightRadius);
    float ring = smoothstep(0.15, 0.0, ringDist) * (1.0 - expansion * 0.3);
    col += vec3(0.0, 0.9, 1.0) * ring;

    // Particle burst
    if (expansion > 0.3) {
      float burstPhase = (expansion - 0.3) / 0.7;
      for (float i = 0.0; i < 30.0; i++) {
        float pAngle = i * TAU / 30.0 + t * 0.5;
        float pDist = burstPhase * (1.5 + 0.5 * sin(i * 7.0));
        vec2 pPos = vec2(cos(pAngle), sin(pAngle)) * pDist;

        float particleDist = length(uv - pPos);
        float particle = exp(-particleDist * 30.0) * (1.0 - burstPhase * 0.5);

        vec3 pColor = mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 0.9, 0.6), sin(i) * 0.5 + 0.5);
        col += pColor * particle * 0.3;
      }
    }

    return col;
  }

  // ==========================================
  // BLOOM APPROXIMATION
  // ==========================================

  vec3 applyBloom(vec3 col, vec2 uv, float t, float phase) {
    // Sample surrounding areas for glow
    float bloomStrength = 0.0;
    vec3 bloomColor = vec3(0.0);

    for (float i = 0.0; i < 8.0; i++) {
      float angle = i * TAU / 8.0;
      for (float r = 1.0; r <= 3.0; r++) {
        vec2 offset = vec2(cos(angle), sin(angle)) * r * 0.02;
        vec2 sampleUV = uv + offset;

        vec3 sampleCol;
        if (phase < 1.0) {
          sampleCol = phaseVoid(sampleUV, t);
        } else if (phase < 2.0) {
          sampleCol = mix(phaseVoid(sampleUV, t), phaseEmergence(sampleUV, t - 3.0), phase - 1.0);
        } else if (phase < 3.0) {
          sampleCol = mix(phaseEmergence(sampleUV, t - 3.0), phasePortal(sampleUV, t - 6.0), phase - 2.0);
        } else {
          sampleCol = mix(phasePortal(sampleUV, t - 6.0), phaseTranscendence(sampleUV, t - 9.0), min(phase - 3.0, 1.0));
        }

        float brightness = dot(sampleCol, vec3(0.2126, 0.7152, 0.0722));
        bloomColor += sampleCol * brightness;
        bloomStrength += brightness;
      }
    }

    bloomColor /= 24.0;
    return col + bloomColor * 0.3;
  }

  // ==========================================
  // MAIN
  // ==========================================

  void main() {
    vec2 uv = (gl_FragCoord.xy - uResolution.xy * 0.5) / min(uResolution.x, uResolution.y);

    float t = uTime;
    vec3 col;

    // Phase-based rendering with smooth transitions
    if (uPhase < 1.0) {
      col = phaseVoid(uv, t);
    } else if (uPhase < 2.0) {
      float blend = smoothstep(0.0, 1.0, uPhase - 1.0);
      col = mix(phaseVoid(uv, t), phaseEmergence(uv, t - 3.0), blend);
    } else if (uPhase < 3.0) {
      float blend = smoothstep(0.0, 1.0, uPhase - 2.0);
      col = mix(phaseEmergence(uv, t - 3.0), phasePortal(uv, t - 6.0), blend);
    } else if (uPhase < 4.0) {
      float blend = smoothstep(0.0, 1.0, uPhase - 3.0);
      col = mix(phasePortal(uv, t - 6.0), phaseTranscendence(uv, t - 9.0), blend);
    } else {
      col = phaseTranscendence(uv, t - 9.0);
    }

    // Apply bloom for enhanced glow
    col = applyBloom(col, uv, t, uPhase);

    // Final transition fade
    col = mix(col, vec3(0.0), uTransition);

    // Vignette
    float vignette = 1.0 - smoothstep(0.5, 1.8, length(uv));
    col *= vignette;

    // Film grain for cinematic quality
    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + t) * 43758.5453);
    col += (grain - 0.5) * 0.02;

    // Tone mapping
    col = col / (1.0 + col);

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
  const [textContent, setTextContent] = useState('');
  const [textOpacity, setTextOpacity] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  // Evocative text sequence - hints at features without explaining
  const textSequence = [
    { time: 2, text: 'Where futures take shape', duration: 2.5 },
    { time: 5.5, text: 'Explore realms of possibility', duration: 2.5, hint: 'explore' },
    { time: 9, text: 'Discover stories yet untold', duration: 2.5, hint: 'articles' },
    { time: 12.5, text: 'Your journey begins', duration: 2.5 },
  ];

  // Feature hint icons that appear subtly
  const [activeHint, setActiveHint] = useState<string | null>(null);

  // Total duration: 16 seconds for generous loading buffer
  const PHASE_DURATION = 3.5;
  const TOTAL_DURATION = 16;

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
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

    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader error:', gl.getShaderInfoLog(fs));
      return;
    }

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    programRef.current = program;

    // Fullscreen quad
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

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

      // Update phase (4 phases over duration)
      const currentPhase = Math.min(elapsed / PHASE_DURATION, 4.5);
      setPhase(currentPhase);

      // Text sequencing with feature hints
      let activeText = '';
      let opacity = 0;
      let hint: string | null = null;
      for (const seq of textSequence) {
        if (elapsed >= seq.time && elapsed < seq.time + seq.duration) {
          activeText = seq.text;
          hint = (seq as any).hint || null;
          const textProgress = (elapsed - seq.time) / seq.duration;
          // Fade in first 20%, full 60%, fade out last 20%
          if (textProgress < 0.2) {
            opacity = textProgress / 0.2;
          } else if (textProgress > 0.8) {
            opacity = (1 - textProgress) / 0.2;
          } else {
            opacity = 1;
          }
          break;
        }
      }
      setTextContent(activeText);
      setTextOpacity(opacity);
      setShowText(opacity > 0);
      setActiveHint(hint);

      // Fade out at end
      if (elapsed > TOTAL_DURATION - 2) {
        setFadeOut(true);
      }

      onProgressUpdate?.(progress);

      if (elapsed >= TOTAL_DURATION) {
        onComplete();
        return;
      }

      // Resize handling
      const dpr = Math.min(window.devicePixelRatio, 2);
      const width = window.innerWidth * dpr;
      const height = window.innerHeight * dpr;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      // Update uniforms
      gl.uniform1f(gl.getUniformLocation(program, 'uTime'), elapsed);
      gl.uniform1f(gl.getUniformLocation(program, 'uPhase'), currentPhase);
      gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), width, height);
      gl.uniform1f(gl.getUniformLocation(program, 'uTransition'),
        fadeOut ? Math.min((elapsed - (TOTAL_DURATION - 2)) / 2, 1) : 0
      );

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

      {/* Cinematic text overlay with feature hints */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          gap: 24,
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            fontSize: 'clamp(18px, 3vw, 32px)',
            fontWeight: 300,
            color: 'rgba(255, 255, 255, 0.95)',
            letterSpacing: '0.12em',
            textAlign: 'center',
            opacity: textOpacity,
            transform: `translateY(${15 - textOpacity * 15}px)`,
            transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            textShadow: '0 0 40px rgba(0, 212, 255, 0.4), 0 0 80px rgba(0, 0, 0, 0.8)',
            maxWidth: '80vw',
          }}
        >
          {textContent}
        </div>

        {/* Feature hint icons - appear with relevant text */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            opacity: activeHint ? textOpacity * 0.7 : 0,
            transform: `translateY(${activeHint ? 0 : 20}px)`,
            transition: 'all 0.6s ease-out',
          }}
        >
          {/* Explore icon */}
          <div
            style={{
              opacity: activeHint === 'explore' ? 1 : 0.3,
              transform: `scale(${activeHint === 'explore' ? 1.1 : 1})`,
              transition: 'all 0.4s ease',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(0, 212, 255, 0.8)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="rgba(0, 212, 255, 0.3)" />
            </svg>
          </div>

          {/* Articles icon */}
          <div
            style={{
              opacity: activeHint === 'articles' ? 1 : 0.3,
              transform: `scale(${activeHint === 'articles' ? 1.1 : 1})`,
              transition: 'all 0.4s ease',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 215, 0, 0.8)" strokeWidth="1.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" fill="rgba(255, 215, 0, 0.1)" />
              <line x1="8" y1="7" x2="16" y2="7" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </div>

          {/* Terminal/Game icon */}
          <div
            style={{
              opacity: activeHint === 'terminal' ? 1 : 0.3,
              transform: `scale(${activeHint === 'terminal' ? 1.1 : 1})`,
              transition: 'all 0.4s ease',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(0, 255, 100, 0.7)" strokeWidth="1.5">
              <rect x="2" y="4" width="20" height="16" rx="2" fill="rgba(0, 255, 100, 0.05)" />
              <polyline points="6 9 10 12 6 15" />
              <line x1="12" y1="15" x2="18" y2="15" />
            </svg>
          </div>
        </div>
      </div>

      {/* Subtle corner hints showing awaiting features */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: phase > 2 ? 0.4 : 0,
          transition: 'opacity 1s ease',
          pointerEvents: 'none',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(0, 212, 255, 0.6)" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l2 2" />
        </svg>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.4)',
          letterSpacing: '0.1em',
        }}>
          360° WORLD AWAITS
        </span>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: phase > 3 ? 0.4 : 0,
          transition: 'opacity 1s ease',
          pointerEvents: 'none',
        }}
      >
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.4)',
          letterSpacing: '0.1em',
        }}>
          AI RESEARCH UNLOCKED
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 215, 0, 0.6)" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      {/* Skip button */}
      <button
        onClick={handleSkip}
        style={{
          position: 'absolute',
          bottom: 40,
          right: 40,
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 6,
          padding: '12px 24px',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '11px',
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontWeight: 500,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'all 0.4s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.4)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
          e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
        }}
      >
        Skip Intro
      </button>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'rgba(255, 255, 255, 0.05)',
        }}
      >
        <div
          style={{
            width: `${(phase / 4.5) * 100}%`,
            height: '100%',
            background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.9), rgba(255, 215, 0, 0.9))',
            boxShadow: '0 0 20px rgba(0, 212, 255, 0.5)',
            transition: 'width 0.1s linear',
          }}
        />
      </div>
    </div>
  );
}
