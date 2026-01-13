/**
 * useResponsive - Centralized responsive breakpoint detection
 *
 * Provides consistent device detection and breakpoint handling
 * across the entire application.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

// Breakpoint definitions (matching Tailwind defaults)
export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export interface DeviceCapabilities {
  memory: number;        // Device memory in GB
  cores: number;         // CPU cores
  maxTextureSize: number; // WebGL max texture size
  touchPoints: number;   // Max touch points
  pixelRatio: number;    // Device pixel ratio
}

export interface ResponsiveState {
  // Breakpoint states
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;

  // Device detection
  isTouchDevice: boolean;
  isLandscape: boolean;
  hasNotch: boolean;

  // Performance tier
  performanceTier: 'low' | 'medium' | 'high' | 'ultra';
  capabilities: DeviceCapabilities;

  // Safe areas for notched devices
  safeAreaInsets: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

// Detect if device has a notch (iPhone X+, etc.)
function detectNotch(): boolean {
  if (typeof window === 'undefined') return false;

  const root = document.documentElement;
  const safeTop = parseInt(getComputedStyle(root).getPropertyValue('--sat') || '0', 10);

  // Also check for CSS environment variables support
  const hasEnvSupport = CSS.supports('padding-top: env(safe-area-inset-top)');

  return safeTop > 20 || (hasEnvSupport && window.innerHeight > 800 && window.innerWidth < 500);
}

// Detect device capabilities
function detectCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return { memory: 8, cores: 8, maxTextureSize: 8192, touchPoints: 0, pixelRatio: 1 };
  }

  const nav = navigator as Navigator & { deviceMemory?: number };

  // WebGL capabilities
  let maxTextureSize = 4096;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && 'getParameter' in gl) {
      maxTextureSize = (gl as WebGLRenderingContext).getParameter(
        (gl as WebGLRenderingContext).MAX_TEXTURE_SIZE
      );
    }
  } catch (e) {
    // WebGL not available
  }

  return {
    memory: nav.deviceMemory ?? 8,
    cores: navigator.hardwareConcurrency ?? 8,
    maxTextureSize,
    touchPoints: navigator.maxTouchPoints ?? 0,
    pixelRatio: window.devicePixelRatio ?? 1,
  };
}

// Calculate performance tier based on capabilities
function calculatePerformanceTier(caps: DeviceCapabilities): 'low' | 'medium' | 'high' | 'ultra' {
  const score =
    (caps.memory >= 8 ? 3 : caps.memory >= 4 ? 2 : 1) +
    (caps.cores >= 8 ? 3 : caps.cores >= 4 ? 2 : 1) +
    (caps.maxTextureSize >= 8192 ? 3 : caps.maxTextureSize >= 4096 ? 2 : 1);

  if (score >= 8) return 'ultra';
  if (score >= 6) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

// Get current breakpoint from width
function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

// Get safe area insets
function getSafeAreaInsets() {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const style = getComputedStyle(document.documentElement);

  return {
    top: parseInt(style.getPropertyValue('--sat') || '0', 10),
    right: parseInt(style.getPropertyValue('--sar') || '0', 10),
    bottom: parseInt(style.getPropertyValue('--sab') || '0', 10),
    left: parseInt(style.getPropertyValue('--sal') || '0', 10),
  };
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        breakpoint: 'lg',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isTouchDevice: false,
        isLandscape: true,
        hasNotch: false,
        performanceTier: 'high',
        capabilities: { memory: 8, cores: 8, maxTextureSize: 8192, touchPoints: 0, pixelRatio: 1 },
        safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const capabilities = detectCapabilities();
    const breakpoint = getBreakpoint(width);

    return {
      width,
      height,
      breakpoint,
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      isTouchDevice: capabilities.touchPoints > 0 || 'ontouchstart' in window,
      isLandscape: width > height,
      hasNotch: detectNotch(),
      performanceTier: calculatePerformanceTier(capabilities),
      capabilities,
      safeAreaInsets: getSafeAreaInsets(),
    };
  });

  const updateState = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const capabilities = detectCapabilities();
    const breakpoint = getBreakpoint(width);

    setState({
      width,
      height,
      breakpoint,
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
      isTouchDevice: capabilities.touchPoints > 0 || 'ontouchstart' in window,
      isLandscape: width > height,
      hasNotch: detectNotch(),
      performanceTier: calculatePerformanceTier(capabilities),
      capabilities,
      safeAreaInsets: getSafeAreaInsets(),
    });
  }, []);

  useEffect(() => {
    updateState();

    window.addEventListener('resize', updateState);
    window.addEventListener('orientationchange', updateState);

    return () => {
      window.removeEventListener('resize', updateState);
      window.removeEventListener('orientationchange', updateState);
    };
  }, [updateState]);

  return state;
}

// Hook to check if above a specific breakpoint
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  const { width } = useResponsive();
  return width >= BREAKPOINTS[breakpoint];
}

// Hook for media query matching
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Hook for reduced motion preference
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

// Hook for dark mode preference
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

export default useResponsive;
