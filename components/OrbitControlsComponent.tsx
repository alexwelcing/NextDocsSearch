import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as THREE from 'three';

type OrbitControlsProps = {
    camera: THREE.Camera;
};

const OrbitControlsComponent = React.forwardRef<OrbitControls, OrbitControlsProps>(
  (props, ref) => {
    const { camera } = props;
    const controls = useRef<OrbitControls | null>(null);

    useEffect(() => {
      if (controls.current) {
        controls.current.target.set(0, 0, 0);
        controls.current.update();
      }
    }, [camera]);

    useFrame(() => {
      if (controls.current) {
        controls.current.update();
      }
    });

    return null;  // This component doesn't render any JSX
  }
);

OrbitControlsComponent.displayName = 'OrbitControlsComponent';

export default OrbitControlsComponent;
