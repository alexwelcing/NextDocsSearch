import { Box } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Controllers, Interactive, VRButton, XR } from '@react-three/xr'
import React, { ComponentProps } from 'react'

export function Button(props: ComponentProps<typeof Box>) {
  const [hover, setHover] = React.useState(false)
  const [color, setColor] = React.useState(0x123456)

  interface ChangeSceneButtonProps {
    onChange: () => void;
  }

 function ChangeSceneButton({ onChange }: ChangeSceneButtonProps) {
    const [hover, setHover] = React.useState(false);
    const [color, setColor] = React.useState(0x123456);

    return (
      <Interactive
        onSelect={() => {
          onChange();
          setColor((Math.random() * 0xffffff) | 0);
        }}
        onHover={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <Box args={[0.4, 0.1, 0.1]} scale={hover ? 1.5 : 1}>
          <meshStandardMaterial color={color} />
        </Box>
      </Interactive>
    );
  }
}

export default ChangeSceneButton