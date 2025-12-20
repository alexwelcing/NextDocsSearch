import { useEffect, useState } from 'react';

interface PerfPreferences {
  prefersReducedMotion: boolean;
  prefersReducedData: boolean;
}

const getMediaPreference = (query: string) => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia(query).matches;
};

const getReducedDataPreference = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData) || getMediaPreference('(prefers-reduced-data: reduce)');
};

export function usePerfPreferences(): PerfPreferences {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => getMediaPreference('(prefers-reduced-motion: reduce)'));
  const [prefersReducedData, setPrefersReducedData] = useState(() => getReducedDataPreference());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const dataQuery = window.matchMedia('(prefers-reduced-data: reduce)');

    const handleMotionChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    const handleDataChange = () => {
      setPrefersReducedData(getReducedDataPreference());
    };

    motionQuery.addEventListener('change', handleMotionChange);
    dataQuery.addEventListener('change', handleDataChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      dataQuery.removeEventListener('change', handleDataChange);
    };
  }, []);

  return { prefersReducedMotion, prefersReducedData };
}
