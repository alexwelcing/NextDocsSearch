/**
 * GPU Particle Shaders - High-performance GLSL shaders
 *
 * All particle computation happens on the GPU for maximum performance.
 * Supports: position animation, color gradients, size variation, opacity fade.
 */

export const particleVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uSpeed;
  uniform float uSpread;

  attribute float aScale;
  attribute float aPhase;
  attribute vec3 aVelocity;

  varying float vAlpha;
  varying float vPhase;

  void main() {
    vPhase = aPhase;

    // Animated position with noise-like movement
    vec3 pos = position;
    float t = uTime * uSpeed + aPhase * 6.28318;

    pos.x += sin(t * 0.7 + aPhase * 3.0) * uSpread * 0.3;
    pos.y += cos(t * 0.5 + aPhase * 2.0) * uSpread * 0.2;
    pos.z += sin(t * 0.3 + aPhase * 4.0) * uSpread * 0.3;

    // Pulsing alpha based on phase
    vAlpha = 0.4 + 0.6 * (0.5 + 0.5 * sin(t * 2.0));

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    // Size attenuation for depth
    gl_PointSize = uSize * aScale * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const particleFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uTime;

  varying float vAlpha;
  varying float vPhase;

  void main() {
    // Soft circular particle
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);

    if (dist > 0.5) discard;

    // Soft edge falloff
    float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;

    // Color gradient based on phase
    vec3 color = mix(uColor, uColor2, vPhase);

    // Add subtle glow
    float glow = exp(-dist * 4.0) * 0.5;
    color += glow * uColor;

    gl_FragColor = vec4(color, alpha);
  }
`;

// Cosmic orb shader - for central energy effect
export const orbVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const orbFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uIntensity;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  // Simplex noise approximation
  float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.543))) * 43758.5453);
  }

  void main() {
    // Fresnel effect for edge glow
    vec3 viewDir = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);

    // Animated energy pattern
    float pattern = sin(vPosition.x * 10.0 + uTime * 2.0)
                  * sin(vPosition.y * 10.0 + uTime * 1.5)
                  * sin(vPosition.z * 10.0 + uTime * 1.8);
    pattern = pattern * 0.5 + 0.5;

    // Combine colors
    vec3 color = mix(uColor1, uColor2, pattern);
    color += fresnel * uColor2 * 2.0;

    // Core brightness
    float core = 1.0 - length(vPosition) * 0.3;
    color *= core * uIntensity;

    // Alpha for blending
    float alpha = 0.8 + fresnel * 0.2;

    gl_FragColor = vec4(color, alpha);
  }
`;

// Laser beam shader
export const laserVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const laserFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;

  varying vec2 vUv;

  void main() {
    // Core beam brightness
    float core = 1.0 - abs(vUv.y - 0.5) * 2.0;
    core = pow(core, 2.0);

    // Animated pulse
    float pulse = 0.8 + 0.2 * sin(uTime * 20.0 - vUv.x * 10.0);

    // Edge glow
    float glow = exp(-abs(vUv.y - 0.5) * 8.0);

    vec3 color = uColor * (core + glow * 0.5) * pulse * uIntensity;
    float alpha = (core * 0.8 + glow * 0.4) * pulse;

    gl_FragColor = vec4(color, alpha);
  }
`;
