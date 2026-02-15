import { describe, it, expect } from 'vitest';
import { determineBestMode, isSplatOptedIn } from './SceneBackground';

describe('SceneBackground mode selection', () => {
  const assets = {
    environment: '/world/test.spz',
    fallbackPanorama: '/world/test.png',
  };

  it('requires explicit splat opt-in', () => {
    expect(determineBestMode(assets, true, 'high', false)).toBe('panorama');
    expect(determineBestMode(assets, true, 'high', true)).toBe('splat');
  });

  it('parses splat opt-in query flag', () => {
    expect(isSplatOptedIn('?splats=on')).toBe(true);
    expect(isSplatOptedIn('?splats=off')).toBe(false);
    expect(isSplatOptedIn('')).toBe(false);
  });
});
