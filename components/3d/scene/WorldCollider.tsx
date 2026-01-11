import React, { useMemo } from 'react';
import { useTrimesh } from '@react-three/cannon';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';

interface WorldColliderProps {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  debug?: boolean;
}

const WorldCollider: React.FC<WorldColliderProps> = ({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  debug = false,
}) => {
  const { scene } = useGLTF(url);

  const mergedGeometry = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const transformMatrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotation[0], rotation[1], rotation[2]),
    );
    transformMatrix.compose(
      new THREE.Vector3(position[0], position[1], position[2]),
      quaternion,
      new THREE.Vector3(scale[0], scale[1], scale[2]),
    );

    scene.updateMatrixWorld(true);

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const geometry = mesh.geometry.clone();
        const worldMatrix = new THREE.Matrix4().copy(mesh.matrixWorld);
        worldMatrix.premultiply(transformMatrix);
        geometry.applyMatrix4(worldMatrix);
        geometries.push(geometry);
      }
    });

    if (geometries.length === 0) {
      return null;
    }

    return BufferGeometryUtils.mergeGeometries(geometries, false);
  }, [scene, position, rotation, scale]);

  const [colliderRef] = useTrimesh(() => {
    if (!mergedGeometry) {
      return { args: [[], []] };
    }

    const positionAttr = mergedGeometry.getAttribute('position');
    const vertices = Array.from(positionAttr.array as Iterable<number>);
    const indices = mergedGeometry.index
      ? Array.from(mergedGeometry.index.array as Iterable<number>)
      : Array.from({ length: vertices.length / 3 }, (_, i) => i);

    return {
      type: 'Static',
      args: [vertices, indices],
    };
  }, [mergedGeometry]);

  if (!mergedGeometry) {
    return null;
  }

  return (
    <mesh ref={colliderRef} visible={debug} geometry={mergedGeometry}>
      {debug && (
        <meshStandardMaterial
          color="#ff00ff"
          wireframe
          transparent
          opacity={0.35}
        />
      )}
    </mesh>
  );
};

export default WorldCollider;
