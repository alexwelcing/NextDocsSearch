// In-scene film viewer: the record's companion MP4 on a VideoTexture panel with play/pause and
// a scrub bar. Falls back to a plain message if the texture path fails.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRouter } from 'next/router'
import * as THREE from 'three/webgpu'
import { ModalShell, MODAL_PAD, MODAL_W, stopLook } from './ModalShell'
import { WindfoilText } from '../text/WindfoilText'
import { closeModal, openModal } from '@/lib/immersive/navigation'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'

const VIDEO_W = MODAL_W - MODAL_PAD * 2
const VIDEO_H = VIDEO_W * (9 / 16) * 0.82

export function VideoModal({ slug }: { slug: string }) {
  const router = useRouter()
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [failed, setFailed] = useState(false)
  const barRef = useRef<THREE.Mesh>(null)

  const { video, texture } = useMemo(() => {
    if (typeof document === 'undefined') return { video: null, texture: null }
    const el = document.createElement('video')
    el.src = `/images/article-videos/${slug}.mp4`
    el.crossOrigin = 'anonymous'
    el.loop = true
    el.playsInline = true
    el.preload = 'auto'
    const tex = new THREE.VideoTexture(el)
    tex.colorSpace = THREE.SRGBColorSpace
    return { video: el, texture: tex }
  }, [slug])

  useEffect(() => {
    if (!video) return
    const onErr = () => setFailed(true)
    video.addEventListener('error', onErr)
    return () => {
      video.removeEventListener('error', onErr)
      video.pause()
      video.src = ''
      texture?.dispose()
    }
  }, [video, texture])

  useFrame(() => {
    if (video && video.duration > 0) setProgress(video.currentTime / video.duration)
    if (barRef.current) {
      barRef.current.scale.x = Math.max(progress, 0.001)
      barRef.current.position.x = (VIDEO_W * Math.max(progress, 0.001)) / 2
    }
  })

  const toggle = () => {
    if (!video) return
    playSound('key')
    if (video.paused) {
      void video.play().catch(() => setFailed(true))
      setPlaying(true)
    } else {
      video.pause()
      setPlaying(false)
    }
  }

  const close = () => closeModal(router)
  const titleFromSlug = slug.replace(/-/g, ' ')

  return (
    <ModalShell
      title={titleFromSlug}
      meta="FILM RECORD"
      hints="CLICK FRAME PLAY/PAUSE · ESC CLOSE"
      onClose={close}
    >
      {failed ? (
        <WindfoilText font={FONT.mono} fontSize={TYPE.body} color={rgba(ARC.red)} position={[0, -0.1, 0]}>
          FILM REEL MISSING OR UNREADABLE
        </WindfoilText>
      ) : (
        <group position={[VIDEO_W / 2, -VIDEO_H / 2 - 0.02, 0]}>
          <mesh
            onPointerDown={(e) => {
              stopLook(e)
              toggle()
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto'
            }}
          >
            <planeGeometry args={[VIDEO_W, VIDEO_H]} />
            {texture ? (
              <meshBasicMaterial map={texture} toneMapped={false} />
            ) : (
              <meshBasicMaterial color="#000000" />
            )}
          </mesh>
          {!playing && (
            <WindfoilText
              font={FONT.display}
              fontSize={0.09}
              color={rgba(ARC.greenBright, 0.95)}
              anchorX="center"
              anchorY="middle"
              position={[0, 0, 0.002]}
              renderOrder={12}
            >
              ▶
            </WindfoilText>
          )}
          {/* scrub bar */}
          <group position={[-VIDEO_W / 2, -VIDEO_H / 2 - 0.03, 0]}>
            <mesh position={[VIDEO_W / 2, 0, 0]}>
              <planeGeometry args={[VIDEO_W, 0.012]} />
              <meshBasicMaterial color={ARC.greenFaint} />
            </mesh>
            <mesh ref={barRef} position={[0, 0, 0.0005]} scale={[0.001, 1, 1]}>
              <planeGeometry args={[1, 0.012]} />
              <meshBasicMaterial color={ARC.green} />
            </mesh>
          </group>
        </group>
      )}
      {/* read the record */}
      <group position={[0.14, -VIDEO_H - 0.115, 0]}>
        <mesh
          onPointerDown={(e) => {
            stopLook(e)
            playSound('confirm')
            openModal(router, { type: 'article', slug })
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto'
          }}
        >
          <planeGeometry args={[0.28, 0.05]} />
          <meshBasicMaterial color={ARC.greenFaint} />
        </mesh>
        <WindfoilText
          font={FONT.display}
          fontSize={0.028}
          color={rgba(ARC.amber)}
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.001]}
        >
          ≡ READ RECORD
        </WindfoilText>
      </group>
    </ModalShell>
  )
}
