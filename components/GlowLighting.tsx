import React from 'react';

interface GlowLightingProps {
  color: string;
  intensity: number;
  distance: number;
}

const GlowLighting: React.FC<GlowLightingProps> = ({ color, intensity, distance }) => {
  return (
    <pointLight color={color} intensity={intensity} distance={distance} />
  );
};

export default GlowLighting;
