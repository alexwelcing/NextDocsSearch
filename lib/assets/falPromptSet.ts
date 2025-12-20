export type AssetCategory = 'audio' | 'image' | 'model'

export interface AssetPrompt {
  id: string
  label: string
  category: AssetCategory
  prompt: string
  notes?: string
  outputPath: string
  falModel: string
  params: Record<string, string | number | boolean | string[]>
}

export const assetPromptSet: AssetPrompt[] = [
  {
    id: 'ambient-loop-01',
    label: 'Ambient music loop',
    category: 'audio',
    prompt:
      'Seamless 60-second ambient sci-fi loop. Ethereal pads, soft sub-bass, distant chimes, slow evolving textures. No hard transients, no drums, no melody lead. Calm, exploratory, weightless. Designed to loop perfectly.',
    notes: 'Target -16 LUFS, 48kHz WAV. Loopable without clicks.',
    outputPath: 'public/assets/audio/ambient-loop-01.wav',
    falModel: 'fal-ai/musicgen',
    params: {
      duration: 60,
      loop: true,
    },
  },
  {
    id: 'ui-chirps-pack',
    label: 'Interaction chirps (SFX pack)',
    category: 'audio',
    prompt:
      'Pack of short UI interaction chirps: confirm, hover, error, warning, unlock, and cancel. Clean futuristic synth blips, 80-250ms each, subtle stereo width, no reverb tails.',
    notes: 'Export as separate files if model supports stems; otherwise render as sequential 6-sfx bundle.',
    outputPath: 'public/assets/audio/ui-chirps-pack.wav',
    falModel: 'fal-ai/musicgen',
    params: {
      duration: 8,
      loop: false,
    },
  },
  {
    id: 'mission-unlock-stinger',
    label: 'Mission unlock stinger',
    category: 'audio',
    prompt:
      'Short 2.5-second mission unlock stinger. Rising synth swell, bright harmonic ping, subtle whoosh, triumphant but restrained. Clean tail that ends quickly.',
    notes: 'Target -12 LUFS, 48kHz WAV.',
    outputPath: 'public/assets/audio/mission-unlock-stinger.wav',
    falModel: 'fal-ai/musicgen',
    params: {
      duration: 3,
      loop: false,
    },
  },
  {
    id: 'chapter-icon-01',
    label: 'Chapter icon 1 - Genesis',
    category: 'image',
    prompt:
      'Futuristic chapter icon, “Genesis”: crystalline seed core floating in a halo ring, minimal sci-fi glyph style, teal/cyan glow, dark navy background, clean vector-like shading, no text.',
    outputPath: 'public/assets/ui/chapter-icon-01-genesis.png',
    falModel: 'fal-ai/flux/schnell',
    params: {
      width: 1024,
      height: 1024,
      guidance_scale: 3.5,
    },
  },
  {
    id: 'chapter-icon-02',
    label: 'Chapter icon 2 - Discovery',
    category: 'image',
    prompt:
      'Futuristic chapter icon, “Discovery”: holographic radar sweep over a stylized planet grid, minimal sci-fi glyph style, cyan/emerald glow, dark navy background, clean vector-like shading, no text.',
    outputPath: 'public/assets/ui/chapter-icon-02-discovery.png',
    falModel: 'fal-ai/flux/schnell',
    params: {
      width: 1024,
      height: 1024,
      guidance_scale: 3.5,
    },
  },
  {
    id: 'chapter-icon-03',
    label: 'Chapter icon 3 - Nexus',
    category: 'image',
    prompt:
      'Futuristic chapter icon, “Nexus”: interlocking nodes forming a hexagonal lattice, minimal sci-fi glyph style, violet/blue glow, dark navy background, clean vector-like shading, no text.',
    outputPath: 'public/assets/ui/chapter-icon-03-nexus.png',
    falModel: 'fal-ai/flux/schnell',
    params: {
      width: 1024,
      height: 1024,
      guidance_scale: 3.5,
    },
  },
  {
    id: 'chapter-icon-04',
    label: 'Chapter icon 4 - Eclipse',
    category: 'image',
    prompt:
      'Futuristic chapter icon, “Eclipse”: crescent shadow over a luminous orb with micro-circuit etching, minimal sci-fi glyph style, magenta/blue glow, dark navy background, clean vector-like shading, no text.',
    outputPath: 'public/assets/ui/chapter-icon-04-eclipse.png',
    falModel: 'fal-ai/flux/schnell',
    params: {
      width: 1024,
      height: 1024,
      guidance_scale: 3.5,
    },
  },
  {
    id: 'chapter-icon-05',
    label: 'Chapter icon 5 - Ascension',
    category: 'image',
    prompt:
      'Futuristic chapter icon, “Ascension”: stylized upward arc with radiant starburst core, minimal sci-fi glyph style, gold/cyan glow, dark navy background, clean vector-like shading, no text.',
    outputPath: 'public/assets/ui/chapter-icon-05-ascension.png',
    falModel: 'fal-ai/flux/schnell',
    params: {
      width: 1024,
      height: 1024,
      guidance_scale: 3.5,
    },
  },
  {
    id: 'mission-card-background',
    label: 'Mission card background',
    category: 'image',
    prompt:
      'Futuristic mission card background: dark navy base with subtle gradient, soft holographic grid lines, faint circuit traces, and gentle nebula haze. Minimal, high-tech, no text or icons. 16:9 aspect.',
    outputPath: 'public/assets/ui/mission-card-background.png',
    falModel: 'fal-ai/flux/schnell',
    params: {
      width: 1920,
      height: 1080,
      guidance_scale: 3.5,
    },
  },
  {
    id: 'artifact-model-optional',
    label: 'Optional 3D artifact model',
    category: 'model',
    prompt:
      'A floating ancient-futurist artifact: a faceted obsidian prism with glowing cyan runes, subtle gold filigree, and a levitating core. Centered, clean topology, game-ready.',
    notes: 'Optional. Use if a 3D model endpoint is configured.',
    outputPath: 'public/assets/models/artifact-01.glb',
    falModel: 'fal-ai/tripo3d',
    params: {
      format: 'glb',
    },
  },
]
