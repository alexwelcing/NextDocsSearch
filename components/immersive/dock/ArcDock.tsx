// The ARC Terminal: a camera-anchored diegetic console. Springs up from its holster when
// summoned (Tab key or the summon chip), CRT blips on, six physical keys switch surfaces.
// It controls only in-scene state — every "navigation" is a modal or a world change. On narrow
// (portrait) views the console shrinks in place to stay inside the frame — see fit.ts.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { CameraAnchor, LeashedAnchor } from './CameraAnchor'
import { DockChassis, BODY_W, BODY_H } from './DockChassis'
import { CrtScreen, SCREEN_W } from './CrtScreen'
import { DockKey, KEY_W, stopLook } from './DockKey'
import { WindfoilText } from '../text/WindfoilText'
import { ArchiveTab } from './tabs/ArchiveTab'
import { SearchTab } from './tabs/SearchTab'
import { ShipTab } from './tabs/ShipTab'
import { WorldsTab } from './tabs/WorldsTab'
import { DataTab } from './tabs/DataTab'
import { GameTab } from './tabs/GameTab'
import { useImmersiveStore, type DockTab } from '@/stores/immersiveStore'
import { playSound, setHum } from '@/lib/immersive/audio'
import { ARC, FONT, rgba } from '@/lib/immersive/theme'
import { fitScale } from '@/lib/immersive/fit'

const TABS: { id: DockTab; label: string }[] = [
  { id: 'archive', label: 'ARCV' },
  { id: 'search', label: 'FIND' },
  { id: 'ship', label: 'SHIP' },
  { id: 'worlds', label: 'WRLD' },
  { id: 'data', label: 'DATA' },
  { id: 'game', label: 'GAME' },
]

const SHOWN_POS = new THREE.Vector3(0, -0.31, -0.85)
const SHOWN_ROT = -0.42
const HIDDEN_POS = new THREE.Vector3(0, -1.05, -0.75)
const HIDDEN_ROT = -1.1

const CONTENT_W = SCREEN_W - 0.04

// Fit envelope for the presented console: chassis plus side grips, and the tilt that brings its
// bottom edge (the key row) nearer the eye than the anchor point — those corners clip first.
const FIT_W = BODY_W + 0.02
const FIT_NEAR = (BODY_H / 2) * Math.sin(-SHOWN_ROT)

export function ArcDock() {
  const dockOpen = useImmersiveStore((s) => s.dockOpen)
  const setDockOpen = useImmersiveStore((s) => s.setDockOpen)
  const dockTab = useImmersiveStore((s) => s.dockTab)
  const setDockTab = useImmersiveStore((s) => s.setDockTab)
  const modal = useImmersiveStore((s) => s.modal)
  const bootPhase = useImmersiveStore((s) => s.bootPhase)

  const rig = useRef<THREE.Group>(null)
  const [powered, setPowered] = useState(false)
  const [busy] = useState(false)

  // Global keys: Tab toggles the dock; 1-6 jump straight to a surface; Esc closes.
  useEffect(() => {
    if (bootPhase !== 'ready') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === '`') {
        e.preventDefault()
        playSound(dockOpen ? 'close' : 'open')
        setDockOpen(!dockOpen)
        return
      }
      if (modal) return // modal owns Escape and shortcuts while open
      if (e.key === 'Escape' && dockOpen) {
        playSound('close')
        setDockOpen(false)
        return
      }
      const n = parseInt(e.key, 10)
      // Text-entry surfaces own digits (years and numbered queries), even when
      // their hidden touch input is not focused.
      if (dockOpen && dockTab !== 'search' && dockTab !== 'ship' && n >= 1 && n <= TABS.length) {
        playSound('tab')
        setDockTab(TABS[n - 1].id)
      }
      if (!dockOpen && e.key === '/') {
        e.preventDefault()
        playSound('open')
        setDockTab('search')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bootPhase, dockOpen, dockTab, modal, setDockOpen, setDockTab])

  // CRT power follows the spring with a beat of delay each way.
  useEffect(() => {
    const t = setTimeout(() => setPowered(dockOpen), dockOpen ? 260 : 0)
    setHum(dockOpen)
    return () => clearTimeout(t)
  }, [dockOpen])

  useFrame((state, delta) => {
    const g = rig.current
    if (!g) return
    const k = 1 - Math.exp(-(dockOpen ? 9 : 7) * delta)
    g.position.lerp(dockOpen ? SHOWN_POS : HIDDEN_POS, k)
    const targetRot = dockOpen ? SHOWN_ROT : HIDDEN_ROT
    g.rotation.x += (targetRot - g.rotation.x) * k
    // Scaled about the rig's own origin, so the console keeps its place below gaze and only
    // narrows. Per frame: tracks resize/rotation and the wheel-zoom fov.
    const cam = state.camera as THREE.PerspectiveCamera
    g.scale.setScalar(
      fitScale({
        vFov: cam.fov,
        aspect: cam.aspect,
        distance: -SHOWN_POS.z,
        width: FIT_W,
        nearOffset: FIT_NEAR,
      })
    )
  })

  const tabActive = (id: DockTab) => dockOpen && powered && dockTab === id && !modal

  const keysRow = useMemo(() => {
    const gap = 0.012
    const total = TABS.length * KEY_W + (TABS.length - 1) * gap
    return TABS.map((t, i) => ({
      ...t,
      x: -total / 2 + KEY_W / 2 + i * (KEY_W + gap),
    }))
  }, [])

  if (bootPhase !== 'ready') return null

  return (
    <>
      {/* summon chip — visible while holstered; hard camera-lock so it always sits at gaze */}
      {!dockOpen && (
        <CameraAnchor stiffness={16}>
          <group position={[0, -0.42, -0.9]} rotation={[-0.5, 0, 0]}>
            <mesh
              onPointerDown={(e) => {
                stopLook(e)
                playSound('open')
                setDockOpen(true)
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto'
              }}
            >
              <planeGeometry args={[0.24, 0.06]} />
              <meshBasicMaterial color={ARC.chassisDark} transparent opacity={0.85} />
            </mesh>
            <WindfoilText
              font={FONT.display}
              fontSize={0.028}
              color={rgba(ARC.green, 0.9)}
              anchorX="center"
              anchorY="middle"
              position={[0, 0, 0.001]}
            >
              ^ ARC [TAB]
            </WindfoilText>
          </group>
        </CameraAnchor>
      )}

      {/* dock rig — lazy-follow: world-anchored in yaw within a deadband (a console you glanced
          down at stays put in the room), pitch spring-follows so it never strands out of reach.
          Summoning recenters it to the current gaze. */}
      <LeashedAnchor recenterOn={dockOpen}>
        <group ref={rig} position={HIDDEN_POS.toArray()} rotation={[HIDDEN_ROT, 0, 0]}>
          <DockChassis activity={busy} />

          {/* screen sits in the bezel */}
          <group position={[0, 0.045, 0.008]}>
            <CrtScreen powered={powered}>
              {powered && dockTab === 'archive' && (
                <ArchiveTab active={tabActive('archive')} width={CONTENT_W} />
              )}
              {powered && dockTab === 'search' && (
                <SearchTab active={tabActive('search')} width={CONTENT_W} />
              )}
              {powered && dockTab === 'ship' && (
                <ShipTab active={tabActive('ship')} width={CONTENT_W} />
              )}
              {powered && dockTab === 'worlds' && (
                <WorldsTab active={tabActive('worlds')} width={CONTENT_W} />
              )}
              {powered && dockTab === 'data' && (
                <DataTab active={tabActive('data')} width={CONTENT_W} />
              )}
              {powered && dockTab === 'game' && (
                <GameTab active={tabActive('game')} width={CONTENT_W} />
              )}
            </CrtScreen>
          </group>

          {/* key row */}
          <group position={[0, -BODY_H / 2 + 0.075, 0.012]}>
            {keysRow.map((t) => (
              <group key={t.id} position={[t.x, 0, 0]}>
                <DockKey
                  label={t.label}
                  active={dockTab === t.id}
                  onPress={() => setDockTab(t.id)}
                />
              </group>
            ))}
          </group>

          {/* stow handle */}
          <mesh
            position={[BODY_W / 2 - 0.03, BODY_H / 2 - 0.028, 0.002]}
            onPointerDown={(e) => {
              stopLook(e)
              playSound('close')
              setDockOpen(false)
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto'
            }}
          >
            <planeGeometry args={[0.036, 0.036]} />
            <meshBasicMaterial color={ARC.chassisDark} />
          </mesh>
          <WindfoilText
            font={FONT.display}
            fontSize={0.024}
            color={rgba(ARC.red, 0.85)}
            anchorX="center"
            anchorY="middle"
            position={[BODY_W / 2 - 0.03, BODY_H / 2 - 0.028, 0.003]}
            renderOrder={20}
          >
            v
          </WindfoilText>
        </group>
      </LeashedAnchor>
    </>
  )
}
