import React, { useState } from 'react';

interface LightControlProps {
  initialColor?: string;
  initialIntensity?: number;
}

const LightControl: React.FC<LightControlProps> = ({ initialColor = "#ffffff", initialIntensity = 1 }) => {
  const [color, setColor] = useState<string>(initialColor);
  const [intensity, setIntensity] = useState<number>(initialIntensity);
  const [pointLightIntensity, setPointLightIntensity] = useState<number>(1.5);

  return (
    <>
      <ambientLight color={color} intensity={intensity} />
      <pointLight position={[0, 20, 10]} intensity={pointLightIntensity} />

      <div style={{ position: 'absolute', bottom: '10px', left: '10px' }}>
        <label>
          Ambient Light Color:
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label>
          Ambient Light Intensity:
          <input type="range" min="0" max="2" step="0.1" value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
        </label>
        <label>
          Point Light Intensity:
          <input type="range" min="0" max="3" step="0.1" value={pointLightIntensity} onChange={(e) => setPointLightIntensity(Number(e.target.value))} />
        </label>
      </div>
    </>
  );
}

export default LightControl;
