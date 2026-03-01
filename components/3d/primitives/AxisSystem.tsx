/**
 * AxisSystem — N-axis semantic coordinate system
 *
 * Renders labeled axis lines, endpoint labels, and an optional grid floor.
 * Fully configurable — define any number of axes with custom names, colors,
 * and orientations.
 */

import React from 'react'
import { Text, Billboard } from '@react-three/drei'

export interface AxisDefinition {
  /** Axis label (for debug, not rendered unless as endpoint labels) */
  name: string
  /** World-space direction vector (will be normalized) */
  direction: [number, number, number]
  /** Total length of the axis */
  length: number
  /** Axis color */
  color: string
  /** Label at the negative end */
  labelStart: string
  /** Label at the positive end */
  labelEnd: string
  /** Offset from origin for axis positioning */
  offset?: [number, number, number]
}

export interface AxisSystemProps {
  axes: AxisDefinition[]
  /** Grid floor at y=-14 */
  grid?: boolean
  gridSize?: number
  gridDivisions?: number
  gridColor?: string
  gridSubColor?: string
  labelFontSize?: number
}

/** Default axes for polarity + horizon semantic space */
export const SEMANTIC_AXES: AxisDefinition[] = [
  {
    name: 'polarity',
    direction: [1, 0, 0],
    length: 30,
    color: '#ff4466',
    labelStart: 'CATASTROPHIC',
    labelEnd: 'POSITIVE',
    offset: [0, -14, 0],
  },
  {
    name: 'horizon',
    direction: [0, 1, 0],
    length: 28,
    color: '#4488ff',
    labelStart: 'NEAR-TERM',
    labelEnd: 'FAR FUTURE',
    offset: [-16, 0, 0],
  },
]

function AxisLine({
  axis,
  labelFontSize = 0.4,
}: {
  axis: AxisDefinition
  labelFontSize?: number
}) {
  const [dx, dy, dz] = axis.direction
  const offset = axis.offset ?? [0, 0, 0]
  const halfLen = axis.length / 2

  // Compute box dimensions — thin along non-axis directions
  const boxArgs: [number, number, number] = [
    dx !== 0 ? axis.length : 0.02,
    dy !== 0 ? axis.length : 0.02,
    dz !== 0 ? axis.length : 0.02,
  ]

  // Label positions at ends
  const startPos: [number, number, number] = [
    offset[0] + dx * -halfLen - (dx === 0 ? 0 : 1),
    offset[1] + dy * -halfLen - (dy === 0 ? 0 : 0.5) + 0.5,
    offset[2] + dz * -halfLen,
  ]
  const endPos: [number, number, number] = [
    offset[0] + dx * halfLen + (dx === 0 ? 0 : 1),
    offset[1] + dy * halfLen + (dy === 0 ? 0 : 0.5) + 0.5,
    offset[2] + dz * halfLen,
  ]

  // Determine anchor based on direction
  const startAnchor = dx !== 0 ? 'right' : 'center'
  const endAnchor = dx !== 0 ? 'left' : 'center'

  // End label color — use green for positive polarity direction
  const endColor = axis.name === 'polarity' ? '#00ffcc' : axis.color

  return (
    <group position={offset}>
      <mesh>
        <boxGeometry args={boxArgs} />
        <meshBasicMaterial color={axis.color} transparent opacity={0.15} />
      </mesh>
      <Billboard position={[startPos[0] - offset[0], startPos[1] - offset[1], startPos[2] - offset[2]]}>
        <Text
          fontSize={labelFontSize}
          color={axis.color}
          anchorX={startAnchor as 'left' | 'right' | 'center'}
          outlineWidth={0.01}
          outlineColor="#000"
        >
          {axis.labelStart}
        </Text>
      </Billboard>
      <Billboard position={[endPos[0] - offset[0], endPos[1] - offset[1], endPos[2] - offset[2]]}>
        <Text
          fontSize={labelFontSize}
          color={endColor}
          anchorX={endAnchor as 'left' | 'right' | 'center'}
          outlineWidth={0.01}
          outlineColor="#000"
        >
          {axis.labelEnd}
        </Text>
      </Billboard>
    </group>
  )
}

export default function AxisSystem({
  axes,
  grid = true,
  gridSize = 40,
  gridDivisions = 20,
  gridColor = '#222233',
  gridSubColor = '#111122',
  labelFontSize,
}: AxisSystemProps) {
  return (
    <group>
      {axes.map((axis) => (
        <AxisLine key={axis.name} axis={axis} labelFontSize={labelFontSize} />
      ))}
      {grid && (
        <gridHelper
          args={[gridSize, gridDivisions, gridColor, gridSubColor]}
          position={[0, -14, 0]}
        />
      )}
    </group>
  )
}
