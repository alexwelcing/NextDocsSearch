/**
 * VectorNode — Article node in the vector space
 *
 * Thin wrapper around NodeRenderer that maps article metadata
 * + search hit score to the generic node's state system.
 */

import React, { useMemo } from 'react'
import * as THREE from 'three'
import { NodeRenderer, type NodeState } from '../primitives'
import { polarityColor } from '@/lib/3d/layoutAlgorithms'
import type { VectorArticle } from './types'

export interface VectorNodeProps {
  article: VectorArticle
  position: [number, number, number]
  hitScore: number
  isSelected: boolean
  onSelect: () => void
}

export default function VectorNode({
  article,
  position,
  hitScore,
  isSelected,
  onSelect,
}: VectorNodeProps) {
  const color = useMemo(
    () => new THREE.Color(polarityColor(article.polarity ?? 0)),
    [article.polarity]
  )

  const state: NodeState = isSelected
    ? 'selected'
    : hitScore > 0
      ? 'highlight'
      : 'idle'

  const sublabel =
    hitScore > 0 ? `relevance: ${Math.round(hitScore * 100)}%` : undefined

  return (
    <NodeRenderer
      position={position}
      color={color}
      state={state}
      highlightIntensity={hitScore}
      label={article.title}
      sublabel={sublabel}
      onClick={onSelect}
    />
  )
}
