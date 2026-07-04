// Shared screen chrome: title bar with divider, and the bottom hint line every tab shows.

import { WindfoilText } from '../../text/WindfoilText'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'
import { SCREEN_H } from '../CrtScreen'

export function ScreenHeader({ title, right, width }: { title: string; right?: string; width: number }) {
  return (
    <group>
      <WindfoilText font={FONT.display} fontSize={TYPE.header} color={rgba(ARC.greenBright)}>
        {title}
      </WindfoilText>
      {right && (
        <WindfoilText
          font={FONT.mono}
          fontSize={TYPE.small}
          color={rgba(ARC.greenDim)}
          anchorX="right"
          position={[width, -0.006, 0]}
        >
          {right}
        </WindfoilText>
      )}
      <mesh position={[width / 2, -0.037, 0]}>
        <planeGeometry args={[width, 0.0016]} />
        <meshBasicMaterial color={ARC.greenDim} />
      </mesh>
    </group>
  )
}

export function ScreenHints({ text, width }: { text: string; width: number }) {
  return (
    <WindfoilText
      font={FONT.mono}
      fontSize={TYPE.micro}
      color={rgba(ARC.greenDim)}
      anchorX="center"
      position={[width / 2, -(SCREEN_H - 0.052), 0]}
    >
      {text}
    </WindfoilText>
  )
}
