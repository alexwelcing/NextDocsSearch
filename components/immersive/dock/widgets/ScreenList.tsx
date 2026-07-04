// Paginated selectable list for the CRT screen: fixed rows per page (authentic terminal
// behavior — no smooth scrolling on a 1970s tube), selection cursor, hover, meta column.

import { Fragment } from 'react'
import { WindfoilText } from '../../text/WindfoilText'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'
import { stopLook } from '../DockKey'
import type { ThreeEvent } from '@react-three/fiber'

export interface ScreenListItem {
  id: string
  primary: string
  meta?: string
}

export const LIST_ROW_H = 0.037

export function ScreenList({
  items,
  selected,
  onSelect,
  onActivate,
  width,
  rows = 6,
  y = 0,
}: {
  items: ScreenListItem[]
  selected: number
  onSelect: (index: number) => void
  onActivate: (index: number) => void
  width: number
  rows?: number
  /** top edge (local y, negative = down from screen origin) */
  y?: number
}) {
  const page = Math.floor(selected / rows)
  const start = page * rows
  const visible = items.slice(start, start + rows)

  return (
    <group position={[0, y, 0]}>
      {visible.map((item, i) => {
        const index = start + i
        const isSel = index === selected
        const rowY = -i * LIST_ROW_H
        // Desktop ergonomics: hover moves the cursor, one click opens. The old select-then-
        // activate double-click was a keyboard idiom leaking into the pointer path — with a
        // mouse the row you're pointing at IS the selection, so clicking should just commit.
        const handleDown = (e: ThreeEvent<PointerEvent>) => {
          stopLook(e)
          if (!isSel) onSelect(index) // touch has no hover — sync selection on the way in
          onActivate(index)
        }
        return (
          <Fragment key={item.id}>
            {isSel && (
              <mesh position={[width / 2, rowY - LIST_ROW_H / 2 + 0.004, -0.0005]}>
                <planeGeometry args={[width + 0.01, LIST_ROW_H - 0.004]} />
                <meshBasicMaterial color={ARC.greenFaint} transparent opacity={0.9} />
              </mesh>
            )}
            {/* row hitbox — drawn never, raycast always */}
            <mesh
              position={[width / 2, rowY - LIST_ROW_H / 2 + 0.004, 0.0002]}
              onPointerDown={handleDown}
              onPointerOver={(e) => {
                e.stopPropagation()
                if (!isSel) onSelect(index)
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto'
              }}
            >
              <planeGeometry args={[width + 0.01, LIST_ROW_H]} />
              <meshBasicMaterial colorWrite={false} depthWrite={false} transparent />
            </mesh>
            <WindfoilText
              font={FONT.mono}
              fontSize={TYPE.row}
              color={isSel ? rgba(ARC.greenBright) : rgba(ARC.green, 0.9)}
              position={[isSel ? 0.018 : 0.004, rowY, 0.0002]}
              maxWidth={width - (item.meta ? 0.13 : 0.02)}
              maxLines={1}
            >
              {(isSel ? '▶ ' : '') + item.primary}
            </WindfoilText>
            {item.meta && (
              <WindfoilText
                font={FONT.mono}
                fontSize={TYPE.small}
                color={rgba(ARC.greenDim)}
                anchorX="right"
                position={[width, rowY - 0.003, 0.0002]}
                maxLines={1}
              >
                {item.meta}
              </WindfoilText>
            )}
          </Fragment>
        )
      })}
      {items.length > rows && (
        <WindfoilText
          font={FONT.mono}
          fontSize={TYPE.micro}
          color={rgba(ARC.greenDim)}
          anchorX="right"
          position={[width, -rows * LIST_ROW_H - 0.004, 0.0002]}
        >
          {`PAGE ${page + 1}/${Math.max(1, Math.ceil(items.length / rows))}`}
        </WindfoilText>
      )}
    </group>
  )
}
