import React, { useCallback, useEffect, useRef, useState } from 'react';

type AudioStatus = 'playing' | 'paused' | 'blocked';

interface AmbientAudioProps {
  enabled: boolean;
  volume: number;
  onStatusChange?: (status: AudioStatus) => void;
}

const AmbientAudio: React.FC<AmbientAudioProps> = ({ enabled, volume, onStatusChange }) => {
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const [blocked, setBlocked] = useState(false);

  const stopAudio = useCallback(() => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
    }
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
    onStatusChange?.('paused');
  }, [onStatusChange]);

  const attemptPlay = useCallback(async () => {
    try {
      if (!contextRef.current) {
        contextRef.current = new AudioContext();
      }
      const context = contextRef.current;
      await context.resume();

      if (!gainRef.current) {
        gainRef.current = context.createGain();
        gainRef.current.gain.value = volume;
        gainRef.current.connect(context.destination);
      }

      if (!oscillatorRef.current) {
        const oscillator = context.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = 220;
        oscillator.connect(gainRef.current);
        oscillator.start();
        oscillatorRef.current = oscillator;
      }

      setBlocked(false);
      onStatusChange?.('playing');
    } catch (error) {
      setBlocked(true);
      onStatusChange?.('blocked');
    }
  }, [onStatusChange, volume]);

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!enabled) {
      stopAudio();
      return;
    }
    attemptPlay();
  }, [attemptPlay, enabled, stopAudio]);

  useEffect(() => {
    if (!blocked || !enabled) return;
    const handleUnlock = () => {
      attemptPlay();
    };
    window.addEventListener('pointerdown', handleUnlock, { once: true });
    window.addEventListener('keydown', handleUnlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, [attemptPlay, blocked, enabled]);

  useEffect(() => {
    return () => {
      stopAudio();
      if (contextRef.current) {
        contextRef.current.close();
        contextRef.current = null;
      }
    };
  }, [stopAudio]);

  return null;
};

export default AmbientAudio;
