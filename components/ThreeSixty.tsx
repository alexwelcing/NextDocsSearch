import React, { useMemo, useState, useEffect } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { TextureLoader } from 'three'
import * as THREE from 'three'
import { OrbitControls, Html } from '@react-three/drei'
import { VRButton, XR, Controllers, Hands, useXR } from '@react-three/xr'
import styled from '../node_modules/styled-components'

const StyledButton = styled.button`
  padding: 8px 8px;
  background: #de7ea2;
  border: 3px solid #6a6699;
  opacity: 80%;
  color: white;
  cursor: pointer;
  font-size: 24px;
  border-radius: 10px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: scale(1.05);
    background: #941947;
    opacity: 80%;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.6);
  }

  &:active {
    transform: scale(0.95);
  }
`

interface BackgroundSphereProps {
  imageUrl: string
}

function BackgroundSphere({ imageUrl }: BackgroundSphereProps) {
  const texture = useLoader(TextureLoader, imageUrl)
  const geometry = useMemo(() => new THREE.SphereGeometry(15, 32, 16), [])

  if (Array.isArray(texture)) {
    console.error('Loaded multiple textures, but expected a single one.')
    return null
  }

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        attach="material"
        map={texture}
        side={THREE.BackSide} // Important: Render the inside of the sphere
      />
    </mesh>
  )
}

interface ThreeSixtyProps {
  currentImage: string
  isDialogOpen: boolean
  onChangeImage: () => void
}

function ThreeSixty({ currentImage, isDialogOpen, onChangeImage }: ThreeSixtyProps) {
  return (
    <>
      <VRButton enterOnly={false} exitOnly={false} />
      <Canvas>
        <XR>
          <Controllers />
          <Hands />
          <BackgroundSphere
            key={isDialogOpen ? 'dialogOpen' : currentImage}
            imageUrl={currentImage}
          />
          <OrbitControls enableZoom={false} />
          <Html position={[28, -4, -9]} center>
            <StyledButton onClick={onChangeImage}>Next destination?</StyledButton>
          </Html>
        </XR>
      </Canvas>
    </>
  )
}

export default ThreeSixty
