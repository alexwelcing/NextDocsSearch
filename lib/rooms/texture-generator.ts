/**
 * Advanced Procedural Texture Generator
 * Creates high-quality PBR textures (albedo, normal, roughness, metallic)
 */

import * as THREE from 'three';

export interface PBRTextureSet {
  albedo: THREE.CanvasTexture;
  normal?: THREE.CanvasTexture;
  roughness?: THREE.CanvasTexture;
  metallic?: THREE.CanvasTexture;
  emissive?: THREE.CanvasTexture;
}

// =============================================================================
// NOISE GENERATION
// =============================================================================

class SimplexNoise {
  private perm: number[];
  
  constructor(seed: number = Math.random()) {
    this.perm = new Array(512);
    const p = new Array(256).fill(0).map((_, i) => i);
    
    // Shuffle with seed
    let random = seed;
    for (let i = 255; i > 0; i--) {
      random = (random * 9301 + 49297) % 233280;
      const j = Math.floor((random / 233280) * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }
  
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  noise2D(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    
    let n0, n1, n2;
    
    let s = (x + y) * F2;
    let i = Math.floor(x + s);
    let j = Math.floor(y + s);
    let t = (i + j) * G2;
    
    let X0 = i - t;
    let Y0 = j - t;
    let x0 = x - X0;
    let y0 = y - Y0;
    
    let i1, j1;
    if (x0 > y0) {
      i1 = 1; j1 = 0;
    } else {
      i1 = 0; j1 = 1;
    }
    
    let x1 = x0 - i1 + G2;
    let y1 = y0 - j1 + G2;
    let x2 = x0 - 1 + 2 * G2;
    let y2 = y0 - 1 + 2 * G2;
    
    let ii = i & 255;
    let jj = j & 255;
    
    let gi0 = this.perm[ii + this.perm[jj]];
    let gi1 = this.perm[ii + i1 + this.perm[jj + j1]];
    let gi2 = this.perm[ii + 1 + this.perm[jj + 1]];
    
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * this.grad(gi0, x0, y0);
    }
    
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * this.grad(gi1, x1, y1);
    }
    
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * this.grad(gi2, x2, y2);
    }
    
    return 70 * (n0 + n1 + n2);
  }
  
  // Fractal Brownian Motion for more natural noise
  fbm(x: number, y: number, octaves: number = 4, persistence: number = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    
    return total / maxValue;
  }
}

// =============================================================================
// TEXTURE GENERATORS
// =============================================================================

export function createConcreteTexture(
  size: number = 512,
  baseColor: string = '#808080',
  roughness: number = 0.9
): PBRTextureSet {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Base color
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  
  const noise = new SimplexNoise(12345);
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  
  // Parse base color
  const baseR = parseInt(baseColor.slice(1, 3), 16);
  const baseG = parseInt(baseColor.slice(3, 5), 16);
  const baseB = parseInt(baseColor.slice(5, 7), 16);
  
  // Generate noise pattern
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      
      // Multiple noise frequencies for aggregate pattern
      const n1 = noise.fbm(x * 0.02, y * 0.02, 6, 0.5);
      const n2 = noise.fbm(x * 0.05, y * 0.05, 4, 0.4);
      const n3 = noise.noise2D(x * 0.1, y * 0.1);
      
      // Combine for aggregate effect
      const aggregate = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
      
      // Add cracks
      const crackNoise = noise.fbm(x * 0.03, y * 0.03, 3, 0.6);
      const crack = crackNoise > 0.7 ? (crackNoise - 0.7) * 3 : 0;
      
      // Variation
      const variation = (aggregate * 40) - (crack * 60);
      
      data[i] = Math.max(0, Math.min(255, baseR + variation));
      data[i + 1] = Math.max(0, Math.min(255, baseG + variation));
      data[i + 2] = Math.max(0, Math.min(255, baseB + variation));
      data[i + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  // Create normal map from height
  const normalCanvas = createNormalMapFromHeight(canvas, noise);
  
  // Create roughness map
  const roughnessCanvas = createRoughnessMap(size, noise, roughness);
  
  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  
  const normal = new THREE.CanvasTexture(normalCanvas);
  normal.wrapS = THREE.RepeatWrapping;
  normal.wrapT = THREE.RepeatWrapping;
  
  const roughnessTex = new THREE.CanvasTexture(roughnessCanvas);
  roughnessTex.wrapS = THREE.RepeatWrapping;
  roughnessTex.wrapT = THREE.RepeatWrapping;
  
  return { albedo, normal, roughness: roughnessTex };
}

export function createMetalTexture(
  size: number = 512,
  type: 'brushed' | 'polished' | 'rusted' | 'scratched' = 'brushed',
  baseColor: string = '#888888'
): PBRTextureSet {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Parse base color
  const baseR = parseInt(baseColor.slice(1, 3), 16);
  const baseG = parseInt(baseColor.slice(3, 5), 16);
  const baseB = parseInt(baseColor.slice(5, 7), 16);
  
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  
  const noise = new SimplexNoise(54321);
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  
  if (type === 'brushed') {
    // Brushed metal - horizontal streaks
    for (let y = 0; y < size; y++) {
      const streak = noise.fbm(y * 0.01, 0, 3, 0.5) * 30;
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const detail = noise.noise2D(x * 0.1, y * 0.1) * 10;
        const variation = streak + detail;
        
        data[i] = Math.max(0, Math.min(255, baseR + variation));
        data[i + 1] = Math.max(0, Math.min(255, baseG + variation));
        data[i + 2] = Math.max(0, Math.min(255, baseB + variation));
      }
    }
  } else if (type === 'scratched') {
    // Scratched metal
    for (let i = 0; i < data.length; i += 4) {
      const n = noise.fbm((i / 4) % size * 0.05, Math.floor((i / 4) / size) * 0.05, 4, 0.5);
      const scratch = Math.random() > 0.98 ? -40 : 0;
      const variation = n * 20 + scratch;
      
      data[i] = Math.max(0, Math.min(255, baseR + variation));
      data[i + 1] = Math.max(0, Math.min(255, baseG + variation));
      data[i + 2] = Math.max(0, Math.min(255, baseB + variation));
    }
  } else if (type === 'rusted') {
    // Rusty metal with orange/brown patches
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const rustMask = noise.fbm(x * 0.02, y * 0.02, 5, 0.6);
        const isRust = rustMask > 0.3;
        
        if (isRust) {
          // Rust color
          const rustIntensity = (rustMask - 0.3) / 0.7;
          data[i] = Math.min(255, 160 + rustIntensity * 60 + noise.noise2D(x * 0.1, y * 0.1) * 20);
          data[i + 1] = Math.min(255, 80 + rustIntensity * 40);
          data[i + 2] = Math.min(255, 30 + rustIntensity * 20);
        } else {
          // Metal
          const variation = noise.noise2D(x * 0.1, y * 0.1) * 15;
          data[i] = Math.max(0, Math.min(255, baseR + variation));
          data[i + 1] = Math.max(0, Math.min(255, baseG + variation));
          data[i + 2] = Math.max(0, Math.min(255, baseB + variation));
        }
      }
    }
  } else {
    // Polished - subtle variations
    for (let i = 0; i < data.length; i += 4) {
      const n = noise.fbm((i / 4) % size * 0.02, Math.floor((i / 4) / size) * 0.02, 3, 0.5);
      const variation = n * 10;
      
      data[i] = Math.max(0, Math.min(255, baseR + variation));
      data[i + 1] = Math.max(0, Math.min(255, baseG + variation));
      data[i + 2] = Math.max(0, Math.min(255, baseB + variation));
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  // Create normal and roughness maps
  const normalCanvas = createNormalMapFromHeight(canvas, noise);
  
  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  
  const normal = new THREE.CanvasTexture(normalCanvas);
  normal.wrapS = THREE.RepeatWrapping;
  normal.wrapT = THREE.RepeatWrapping;
  
  return { albedo, normal };
}

export function createWoodTexture(
  size: number = 512,
  type: 'oak' | 'pine' | 'dark' | 'bamboo' = 'oak'
): PBRTextureSet {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Base colors for different wood types
  const woodColors = {
    oak: { r: 194, g: 150, b: 96 },
    pine: { r: 226, g: 194, b: 134 },
    dark: { r: 92, g: 64, b: 51 },
    bamboo: { r: 218, g: 186, b: 120 }
  };
  
  const base = woodColors[type];
  
  // Fill with base color
  ctx.fillStyle = `rgb(${base.r}, ${base.g}, ${base.b})`;
  ctx.fillRect(0, 0, size, size);
  
  const noise = new SimplexNoise(98765);
  
  // Draw grain
  ctx.globalCompositeOperation = 'multiply';
  
  for (let i = 0; i < 100; i++) {
    const y = (i / 100) * size;
    const grainWidth = 2 + Math.random() * 3;
    
    ctx.beginPath();
    ctx.moveTo(0, y);
    
    for (let x = 0; x <= size; x += 10) {
      const wobble = noise.noise2D(x * 0.01, y * 0.01) * 5;
      ctx.lineTo(x, y + wobble);
    }
    
    const darkness = 0.7 + Math.random() * 0.2;
    ctx.strokeStyle = `rgba(60, 40, 20, ${darkness * 0.3})`;
    ctx.lineWidth = grainWidth;
    ctx.stroke();
  }
  
  // Add knots
  const numKnots = 3 + Math.floor(Math.random() * 3);
  for (let k = 0; k < numKnots; k++) {
    const kx = Math.random() * size;
    const ky = Math.random() * size;
    const kr = 10 + Math.random() * 20;
    
    ctx.beginPath();
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
      const r = kr + noise.noise2D(Math.cos(angle) * 2, Math.sin(angle) * 2) * 5;
      const x = kx + Math.cos(angle) * r;
      const y = ky + Math.sin(angle) * r * 2; // Oval shape
      if (angle === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(40, 25, 15, 0.4)';
    ctx.fill();
  }
  
  ctx.globalCompositeOperation = 'source-over';
  
  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  
  return { albedo };
}

export function createHolographicTexture(
  size: number = 512,
  color1: string = '#00ffff',
  color2: string = '#ff00ff'
): PBRTextureSet {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Parse colors
  const c1 = {
    r: parseInt(color1.slice(1, 3), 16),
    g: parseInt(color1.slice(3, 5), 16),
    b: parseInt(color1.slice(5, 7), 16)
  };
  const c2 = {
    r: parseInt(color2.slice(1, 3), 16),
    g: parseInt(color2.slice(3, 5), 16),
    b: parseInt(color2.slice(5, 7), 16)
  };
  
  const noise = new SimplexNoise(11111);
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      
      // Interference pattern
      const interference = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5 + 0.5;
      const noiseVal = noise.fbm(x * 0.02, y * 0.02, 3, 0.5);
      
      const mix = (interference + noiseVal) / 2;
      
      data[i] = Math.floor(c1.r * (1 - mix) + c2.r * mix);
      data[i + 1] = Math.floor(c1.g * (1 - mix) + c2.g * mix);
      data[i + 2] = Math.floor(c1.b * (1 - mix) + c2.b * mix);
      data[i + 3] = 180; // Semi-transparent
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  // Add scanlines
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  for (let y = 0; y < size; y += 4) {
    ctx.fillRect(0, y, size, 1);
  }
  
  // Add hex grid pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  const hexSize = 20;
  
  for (let y = 0; y < size; y += hexSize * 1.5) {
    for (let x = 0; x < size; x += hexSize * 2) {
      const offset = (y / (hexSize * 1.5)) % 2 === 0 ? 0 : hexSize;
      drawHexagon(ctx, x + offset, y, hexSize);
    }
  }
  
  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  
  return { albedo };
}

export function createCircuitTexture(
  size: number = 512,
  baseColor: string = '#1a1a2e',
  traceColor: string = '#00d4ff'
): PBRTextureSet {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Background
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  
  // Circuit traces
  ctx.strokeStyle = traceColor;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  const gridSize = 32;
  const nodes: { x: number; y: number }[] = [];
  
  // Create grid of nodes
  for (let y = gridSize; y < size; y += gridSize) {
    for (let x = gridSize; x < size; x += gridSize) {
      if (Math.random() > 0.3) {
        nodes.push({ x, y });
      }
    }
  }
  
  // Draw traces between nodes
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    
    // Connect to nearby nodes
    for (let j = i + 1; j < nodes.length; j++) {
      const other = nodes[j];
      const dist = Math.hypot(node.x - other.x, node.y - other.y);
      
      if (dist < gridSize * 1.5 && Math.random() > 0.5) {
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        
        // Manhattan routing
        if (Math.random() > 0.5) {
          ctx.lineTo(other.x, node.y);
          ctx.lineTo(other.x, other.y);
        } else {
          ctx.lineTo(node.x, other.y);
          ctx.lineTo(other.x, other.y);
        }
        
        ctx.stroke();
      }
    }
    
    // Draw component at node
    ctx.fillStyle = traceColor;
    ctx.beginPath();
    ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Add glow effect
  ctx.globalCompositeOperation = 'screen';
  ctx.shadowColor = traceColor;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'source-over';
  
  const albedo = new THREE.CanvasTexture(canvas);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  
  return { albedo };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const hx = x + size * Math.cos(angle);
    const hy = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.stroke();
}

function createNormalMapFromHeight(
  heightCanvas: HTMLCanvasElement,
  noise: SimplexNoise
): HTMLCanvasElement {
  const size = heightCanvas.width;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      
      // Calculate normal from height gradient
      const heightL = noise.fbm((x - 1) * 0.05, y * 0.05, 4, 0.5);
      const heightR = noise.fbm((x + 1) * 0.05, y * 0.05, 4, 0.5);
      const heightD = noise.fbm(x * 0.05, (y - 1) * 0.05, 4, 0.5);
      const heightU = noise.fbm(x * 0.05, (y + 1) * 0.05, 4, 0.5);
      
      const normalX = (heightL - heightR) * 0.5 + 0.5;
      const normalY = (heightD - heightU) * 0.5 + 0.5;
      const normalZ = 1;
      
      data[i] = Math.floor(normalX * 255);     // R
      data[i + 1] = Math.floor(normalY * 255); // G
      data[i + 2] = Math.floor(normalZ * 255); // B
      data[i + 3] = 255;                       // A
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function createRoughnessMap(
  size: number,
  noise: SimplexNoise,
  baseRoughness: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = noise.fbm(x * 0.03, y * 0.03, 4, 0.5);
      const roughness = Math.floor((baseRoughness + n * 0.2) * 255);
      
      data[i] = roughness;
      data[i + 1] = roughness;
      data[i + 2] = roughness;
      data[i + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// =============================================================================
// TEXTURE CACHE
// =============================================================================

const textureSetCache = new Map<string, PBRTextureSet>();

export function getCachedTextureSet(
  type: string,
  generator: () => PBRTextureSet
): PBRTextureSet {
  if (textureSetCache.has(type)) {
    return textureSetCache.get(type)!;
  }
  
  const textures = generator();
  textureSetCache.set(type, textures);
  return textures;
}

export function clearTextureCache(): void {
  textureSetCache.clear();
}
