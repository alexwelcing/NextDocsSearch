/**
 * VectorSpaceExplorer — Orchestrator for the 3D knowledge-space visualization
 *
 * Composes the vector-space sub-components:
 *   - AxisSystem  (semantic grid + labels)
 *   - VectorNode  (per-article interactive orbs)
 *   - VectorConnections (search-result relationship lines)
 *   - SearchPulse (expanding ring feedback on query)
 *   - VectorCamera (smooth fly-to on search centroid)
 *
 * All positioning is delegated to layoutAlgorithms.computePositions().
 */

import React, { useMemo } from 'react'
import * as THREE from 'three'
import { AxisSystem, SEMANTIC_AXES } from '../primitives'
import { computePositions, type LayoutName } from '@/lib/3d/layoutAlgorithms'
import VectorNode from './VectorNode'
import VectorConnections from './VectorConnections'
import SearchPulse from './SearchPulse'
import VectorCamera from './VectorCamera'
import type { VectorSpaceExplorerProps } from './types'

export default function VectorSpaceExplorer({
  articles,
  searchResults = [],
  onArticleSelect,
  selectedArticleId,
  cameraTarget,
  isSearching = false,
}: VectorSpaceExplorerProps) {
  // Compute positions via the layout registry
  const positions = useMemo(
    () => computePositions(articles, 'semantic-axes' as LayoutName),
    [articles]
  )

  // Normalize hit scores to 0-1 range
  const hitScores = useMemo(() => {
    const map = new Map<string, number>()
    if (searchResults.length === 0) return map
    const maxScore = Math.max(...searchResults.map((r) => r.score))
    searchResults.forEach((r) => {
      if (r.slug) map.set(r.slug, maxScore > 0 ? r.score / maxScore : 0)
    })
    return map
  }, [searchResults])

  // Centroid of search results for camera + pulse targeting
  const searchCentroid = useMemo<[number, number, number] | null>(() => {
    const hits = searchResults.filter((r) => r.slug && positions.has(r.slug))
    if (hits.length === 0) return null

    let x = 0,
      y = 0,
      z = 0
    hits.forEach((h) => {
      const p = positions.get(h.slug)!
      x += p[0]
      y += p[1]
      z += p[2]
    })
    return [x / hits.length, y / hits.length, z / hits.length]
  }, [searchResults, positions])

  const effectiveTarget = cameraTarget ?? searchCentroid

  return (
    <group>
      {/* Semantic axis labels + grid */}
      <AxisSystem axes={SEMANTIC_AXES} />

      {/* Ambient scene lighting */}
      <ambientLight intensity={0.15} color="#334466" />
      <pointLight position={[20, 20, 20]} intensity={0.4} color="#88aaff" />
      <pointLight position={[-20, -10, -20]} intensity={0.2} color="#ff8866" />

      {/* Article nodes */}
      {articles.map((article) => {
        const pos = positions.get(article.id)
        if (!pos) return null
        return (
          <VectorNode
            key={article.id}
            article={article}
            position={pos}
            hitScore={hitScores.get(article.id) ?? 0}
            isSelected={selectedArticleId === article.id}
            onSelect={() => onArticleSelect?.(article)}
          />
        )
      })}

      {/* Search result connections */}
      {searchResults.length > 1 && (
        <VectorConnections positions={positions} searchResults={searchResults} />
      )}

      {/* Search pulse animation */}
      {effectiveTarget && <SearchPulse center={effectiveTarget} active={isSearching} />}

      {/* Camera animation */}
      <VectorCamera target={effectiveTarget} isActive={searchResults.length > 0} />
    </group>
  )
}
