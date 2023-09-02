import * as THREE from 'three';

function TabletBackground() {
    const geometry = new THREE.planeBufferGeometry(8, 12);

    return (
      <mesh position={[0, 0, -1]} geometry={geometry}>
        <meshStandardMaterial attach="material" color="grey" />
      </mesh>
    );
  }