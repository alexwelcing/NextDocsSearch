import React, { useMemo } from 'react';
import { useTrimesh } from '@react-three/cannon';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

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

  const mergedData = useMemo(() => {
    const vertices: number[] = [];
    const indices: number[] = [];
    let indexOffset = 0;
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
        const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
        const positionAttr = nonIndexed.getAttribute('position');
        const positionArray = Array.from(positionAttr.array as Iterable<number>);

        vertices.push(...positionArray);

        const vertexCount = positionArray.length / 3;
        for (let i = 0; i < vertexCount; i += 1) {
          indices.push(indexOffset + i);
        }

        indexOffset += vertexCount;
      }
    });

    if (vertices.length === 0) {
      return null;
    }

    return { vertices, indices };
  }, [scene, position, rotation, scale]);

  const [colliderRef] = useTrimesh(() => {
    if (!mergedData) {
      return { args: [[], []] };
    }

    return {
      type: 'Static',
      args: [mergedData.vertices, mergedData.indices],
    };
  }, [mergedData]);

  if (!mergedData) {
    return null;
  }

  const debugGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(mergedData.vertices, 3),
    );
    geometry.setIndex(mergedData.indices);
    return geometry;
  }, [mergedData]);

  return (
    <mesh ref={colliderRef} visible={debug} geometry={debugGeometry}>
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
