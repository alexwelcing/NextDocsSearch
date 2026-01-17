'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface CosmicPowerState {
  isUnlocked: boolean;
  isActive: boolean;
  clickRadiusMultiplier: number;
  laserEnabled: boolean;
  particleBoost: number;
  comboBoostMultiplier: number;
}

interface CosmicPowerContextValue extends CosmicPowerState {
  activatePower: () => void;
  deactivatePower: () => void;
  togglePower: () => void;
}

const COSMIC_POWER_STORAGE_KEY = 'nextdocs_cosmic_power_unlocked';
const COSMIC_POWER_ACTIVE_KEY = 'nextdocs_cosmic_power_active';

const defaultState: CosmicPowerState = {
  isUnlocked: false,
  isActive: false,
  clickRadiusMultiplier: 1,
  laserEnabled: false,
  particleBoost: 1,
  comboBoostMultiplier: 1,
};

const unlockedState: CosmicPowerState = {
  isUnlocked: true,
  isActive: true,
  clickRadiusMultiplier: 2.5, // 2.5x bigger click radius!
  laserEnabled: true,
  particleBoost: 3, // 3x more particles
  comboBoostMultiplier: 1.5, // 50% more combo bonus
};

const CosmicPowerContext = createContext<CosmicPowerContextValue | null>(null);

export function CosmicPowerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CosmicPowerState>(defaultState);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isUnlocked = localStorage.getItem(COSMIC_POWER_STORAGE_KEY) === 'true';
    const wasActive = localStorage.getItem(COSMIC_POWER_ACTIVE_KEY) !== 'false'; // Default to active if unlocked

    if (isUnlocked) {
      setState({
        ...unlockedState,
        isActive: wasActive,
        // Only apply bonuses if active
        clickRadiusMultiplier: wasActive ? unlockedState.clickRadiusMultiplier : 1,
        laserEnabled: wasActive,
        particleBoost: wasActive ? unlockedState.particleBoost : 1,
        comboBoostMultiplier: wasActive ? unlockedState.comboBoostMultiplier : 1,
      });
    }
  }, []);

  // Persist active state
  useEffect(() => {
    if (typeof window === 'undefined' || !state.isUnlocked) return;
    localStorage.setItem(COSMIC_POWER_ACTIVE_KEY, state.isActive ? 'true' : 'false');
  }, [state.isActive, state.isUnlocked]);

  const activatePower = useCallback(() => {
    setState(prev => {
      if (!prev.isUnlocked) return prev;
      return {
        ...unlockedState,
        isActive: true,
      };
    });
  }, []);

  const deactivatePower = useCallback(() => {
    setState(prev => {
      if (!prev.isUnlocked) return prev;
      return {
        ...prev,
        isActive: false,
        clickRadiusMultiplier: 1,
        laserEnabled: false,
        particleBoost: 1,
        comboBoostMultiplier: 1,
      };
    });
  }, []);

  const togglePower = useCallback(() => {
    setState(prev => {
      if (!prev.isUnlocked) return prev;
      const newActive = !prev.isActive;
      return {
        ...unlockedState,
        isActive: newActive,
        clickRadiusMultiplier: newActive ? unlockedState.clickRadiusMultiplier : 1,
        laserEnabled: newActive,
        particleBoost: newActive ? unlockedState.particleBoost : 1,
        comboBoostMultiplier: newActive ? unlockedState.comboBoostMultiplier : 1,
      };
    });
  }, []);

  return (
    <CosmicPowerContext.Provider
      value={{
        ...state,
        activatePower,
        deactivatePower,
        togglePower,
      }}
    >
      {children}
    </CosmicPowerContext.Provider>
  );
}

export function useCosmicPower() {
  const context = useContext(CosmicPowerContext);
  if (!context) {
    // Return default values if not wrapped in provider (for compatibility)
    return {
      ...defaultState,
      activatePower: () => {},
      deactivatePower: () => {},
      togglePower: () => {},
    };
  }
  return context;
}

export { CosmicPowerContext };
