// Curated world definitions for the 360 scene: an equirect panorama plus the lighting and
// atmosphere that sell it. The dock's WORLDS tab pages through this registry.

export interface WorldDef {
  id: string
  name: string
  /** One-line dock description (windfoil text — keep it terminal-terse). */
  blurb: string
  panorama: string
  /** Scene lighting tint + intensity applied over the panorama. */
  ambient: { color: string; intensity: number }
  key: { color: string; intensity: number; position: [number, number, number] }
  /** Atmosphere particle tint (phosphor drift). */
  particles: { color: string; count: number }
  /** Subtle auto-rotation speed for idle drift, radians/second. */
  drift: number
  /** Aerial-perspective density 0..1 (0 = hard vacuum, 1 = thick air). Drives the scene
   *  fogNode range and the atmosphere motes' depth fade. */
  haze: number
}

export const WORLDS: WorldDef[] = [
  {
    id: 'the-stacks',
    name: 'THE STACKS',
    blurb: 'the archive itself. every record you can see is real.',
    panorama: '/background/the-stacks.jpg',
    ambient: { color: '#a8ffc4', intensity: 0.55 },
    key: { color: '#c8ffd8', intensity: 0.85, position: [0, 9, -2] },
    particles: { color: '#70ff8f', count: 320 },
    drift: 0.003,
    haze: 0.35,
  },
  {
    id: 'the-overlook',
    name: 'THE OVERLOOK',
    blurb: 'brass observation deck. two moons over a patient sea.',
    panorama: '/background/the-overlook.jpg',
    ambient: { color: '#ffd9b0', intensity: 0.8 },
    key: { color: '#ffb877', intensity: 1.15, position: [0, 4, -8] },
    particles: { color: '#ffd9a8', count: 160 },
    drift: 0.003,
    haze: 0.5,
  },
  {
    id: 'signal-garden',
    name: 'SIGNAL GARDEN',
    blurb: 'bioluminescent flora under the antenna field. listen.',
    panorama: '/background/signal-garden.jpg',
    ambient: { color: '#7fd8e8', intensity: 0.55 },
    key: { color: '#66e8ff', intensity: 0.8, position: [-4, 8, 3] },
    particles: { color: '#7fefff', count: 380 },
    drift: 0.005,
    haze: 0.7,
  },
  {
    id: 'high-orbit',
    name: 'HIGH ORBIT',
    blurb: 'ring station corridor. the gas giant does not care.',
    panorama: '/background/high-orbit.jpg',
    ambient: { color: '#d8e8ff', intensity: 0.85 },
    key: { color: '#aac8ff', intensity: 1.0, position: [6, 3, -5] },
    particles: { color: '#bcd8ff', count: 220 },
    drift: 0.004,
    haze: 0.05,
  },
  {
    id: 'atrium',
    name: 'THE ATRIUM',
    blurb: 'default habitat. warm light, tall glass.',
    panorama: '/background/start.jpg',
    ambient: { color: '#fff4e0', intensity: 0.9 },
    key: { color: '#ffd9a0', intensity: 1.2, position: [5, 8, 2] },
    particles: { color: '#ffe9b0', count: 220 },
    drift: 0.004,
    haze: 0.3,
  },
  {
    id: 'deep-space',
    name: 'DEEP FIELD',
    blurb: 'hard vacuum. the archive looks better with starlight.',
    panorama: '/background/space.jpg',
    ambient: { color: '#8090ff', intensity: 0.5 },
    key: { color: '#b0c4ff', intensity: 0.9, position: [-6, 4, -3] },
    particles: { color: '#9db8ff', count: 340 },
    drift: 0.006,
    haze: 0.0,
  },
  {
    id: 'signal-station',
    name: 'SIGNAL STATION',
    blurb: 'orbital relay. all channels open.',
    panorama: '/background/scifi1.jpg',
    ambient: { color: '#a0f0ff', intensity: 0.7 },
    key: { color: '#7ce8ff', intensity: 1.1, position: [4, 6, -4] },
    particles: { color: '#7ce8ff', count: 260 },
    drift: 0.005,
    haze: 0.15,
  },
  {
    id: 'undercroft',
    name: 'THE UNDERCROFT',
    blurb: 'cave system. good acoustics for long reads.',
    panorama: '/background/cave.jpg',
    ambient: { color: '#5a748c', intensity: 0.6 },
    key: { color: '#8fb8d8', intensity: 0.8, position: [0, 10, 0] },
    particles: { color: '#9adfff', count: 180 },
    drift: 0.003,
    haze: 0.8,
  },
  {
    id: 'night-train',
    name: 'NIGHT TRAIN',
    blurb: 'in transit. destination classified.',
    panorama: '/background/train.jpg',
    ambient: { color: '#ffd0b8', intensity: 0.75 },
    key: { color: '#ffb890', intensity: 1.0, position: [-3, 5, 4] },
    particles: { color: '#ffcf9e', count: 160 },
    drift: 0.004,
    haze: 0.4,
  },
  {
    id: 'meridian',
    name: 'MERIDIAN',
    blurb: 'high desert horizon. dry air, long sightlines.',
    panorama: '/background/bg2.jpg',
    ambient: { color: '#fff0d8', intensity: 0.95 },
    key: { color: '#ffe2ad', intensity: 1.15, position: [8, 7, 0] },
    particles: { color: '#ffedc2', count: 140 },
    drift: 0.004,
    haze: 0.25,
  },
  {
    id: 'verdant',
    name: 'VERDANT',
    blurb: 'green world. photosynthesis as a service.',
    panorama: '/background/bg5.jpg',
    ambient: { color: '#dcffe0', intensity: 0.85 },
    key: { color: '#c2ffc8', intensity: 1.0, position: [2, 9, 3] },
    particles: { color: '#baffc4', count: 240 },
    drift: 0.004,
    haze: 0.6,
  },
  {
    id: 'ember',
    name: 'EMBER GATE',
    blurb: 'volcanic exterior. keep the dock hatch sealed.',
    panorama: '/background/bg8.jpg',
    ambient: { color: '#ffc4a0', intensity: 0.7 },
    key: { color: '#ff9a60', intensity: 1.25, position: [-5, 6, -2] },
    particles: { color: '#ffb083', count: 300 },
    drift: 0.005,
    haze: 0.75,
  },
]

export const DEFAULT_WORLD_ID = WORLDS[0].id

export function worldById(id: string): WorldDef {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0]
}
