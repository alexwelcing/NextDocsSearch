#!/usr/bin/env node
/**
 * Interface Series Hero Image Generator — Nano Banana 2
 *
 * Generates one premium hero image per article using fal-ai/nano-banana-2
 * (Google Gemini image generation). These become the featured/og images.
 *
 * Prompts are written in natural language (not diffusion tag-soup) per
 * Nano Banana 2's reasoning-guided architecture.
 *
 * Usage: node scripts/generate-interface-hero-images.mjs
 */

import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUTPUT_BASE = join(ROOT, 'public/images/articles')

// Load FAL_KEY
let FAL_KEY = process.env.FAL_KEY
if (!FAL_KEY) {
  try {
    const envLocal = readFileSync(join(ROOT, '.env.local'), 'utf-8')
    const match = envLocal.match(/^FAL_KEY=(.+)$/m)
    if (match) FAL_KEY = match[1].trim()
  } catch {}
}
if (!FAL_KEY) {
  console.error('ERROR: FAL_KEY not found.')
  process.exit(1)
}

const MODEL = 'fal-ai/nano-banana-2'

// Natural language prompts optimized for Nano Banana 2's reasoning engine.
// No tag-soup. Each prompt describes the scene as a creative brief.
const HERO_PROMPTS = [
  {
    slug: 'interface-01-the-first-translator',
    title: 'The First Translator',
    prompt: `A computational linguist sits at her cluttered university workstation late at night, lit by two monitors. One screen displays a geometric visualization of machine attention patterns in cool blue tones. The other shows organic, flowing human thought patterns in warm amber. Between the two screens, where their light overlaps on her face, there's a visible gap — the space between what humans mean and what machines understand. The scene is photographed like a frame from a David Fincher film: precise composition, low-key lighting, shallow depth of field. Coffee cups and academic papers are scattered across the desk. The woman leans forward with focused intensity, studying the gap between the two visualizations as if it contains something only she can see.`
  },
  {
    slug: 'interface-02-haptic-vernacular',
    title: 'Haptic Vernacular',
    prompt: `A construction worker wearing an advanced powered exoskeleton stands on a steel beam high above São Paulo at golden hour. The exoskeleton is industrial and practical — scratched metal, hydraulic actuators, subtle orange warning lights at the joints. His right hand reaches toward a beam, and the exoskeleton's shoulder joint glows faintly amber where it applies counter-pressure, redirecting his reach. The scene captures the moment of communication between human body and machine — a physical conversation happening through pressure and movement. Shot from a low angle looking up, with the city skyline soft in the background. The image feels like a documentary photograph of real work, not a tech advertisement.`
  },
  {
    slug: 'interface-03-the-ceramicist-and-the-kiln',
    title: 'The Ceramicist and the Kiln',
    prompt: `An elderly Japanese ceramicist holds a small test tile up to the window light in her traditional pottery workshop. The tile bears an extraordinary glaze — a deep, layered blue that seems to contain light within it, like looking through the interior of an ocean wave. Her weathered hands, dusted with clay, contrast with the luminous, almost supernatural beauty of the ceramic surface. Behind her, a wood-fired kiln glows orange. On the wedging table beside her, a tablet computer shows a chemical formulation, its cool digital light at odds with the warm, analog world of the workshop. Dust motes float in the slanting afternoon light. The photograph has the quality of a Vermeer painting — quiet, contemplative, suffused with natural light.`
  },
  {
    slug: 'interface-04-protocol-zero',
    title: 'Protocol Zero',
    prompt: `A retired diplomat in her sixties sits at the head of a long conference table in a formal meeting room with understated UN-style aesthetics. The table is covered with printed documents, network diagrams, and annotated treaty drafts. Behind her, a large wall display shows a network visualization of AI agent communication pathways — interconnected nodes with some connections highlighted in green (compliant) and others in amber (unresolved). She has her reading glasses pushed up on her forehead and looks directly at the viewer with the calm authority of someone who has mediated between nations and is now mediating between machines. Cool overhead institutional lighting. The composition suggests the weight of the document she's writing.`
  },
  {
    slug: 'interface-05-the-weight-of-a-gaze',
    title: 'The Weight of a Gaze',
    prompt: `In a university robotics lab, a research robot and a scientist face each other across a workbench, caught in a moment of mutual attention. The robot has simple, functional camera eyes — not humanoid, clearly mechanical — but they are turned toward the scientist's face with a precision and timing that feels uncannily like genuine attention. The scientist, a Korean woman in her thirties, has paused mid-task, holding a circuit board, and is looking back at the robot with an expression of surprise mixed with recognition. The lighting is sterile lab fluorescents softened by a warm desk lamp. The image captures the philosophical weight of being truly looked at by a machine. Shot at eye level to emphasize the symmetry of the encounter.`
  },
  {
    slug: 'interface-06-latency-as-intimacy',
    title: 'Latency as Intimacy',
    prompt: `A doctor sits alone at a hospital workstation during a quiet night shift, her face illuminated by a medical AI interface on screen. The screen shows a diagnostic recommendation being revealed step by step — not all at once, but deliberately, with each piece of clinical reasoning appearing in sequence, giving her mind time to engage. Her expression shows deep concentration and something rare: trust being built in real time. The hospital corridor behind her is dim and empty. Medical equipment creates soft geometric shapes in the background. The image feels intimate and quiet — the relationship between a human thinker and a system that has learned to match her pace. Photographed like a Michael Mann night scene.`
  },
  {
    slug: 'interface-07-the-cartographer-of-attention',
    title: 'The Cartographer of Attention',
    prompt: `A Vietnamese woman in simple meditation clothes stands before a vast three-dimensional data visualization in a high-tech control room in Shenzhen. The visualization shows a topographical landscape of human attention — mountains of focus glowing in warm colors, valleys of rest in cool blue, and at the center a region of extraordinary calm coherence that pulses gently like breathing. She reaches toward this central region with recognition, as if she has been here before through practice and is now seeing it confirmed in data. Behind her, floor-to-ceiling windows show the neon cityscape of Shenzhen at night. The collision of contemplative wisdom and advertising technology in a single frame. The room is dark except for the visualization and the city lights.`
  },
  {
    slug: 'interface-08-scaffold-and-bone',
    title: 'Scaffold and Bone',
    prompt: `A surgeon's gloved hands hold a cross-section model of human trabecular bone, its internal architecture revealing a beautiful branching pattern of load-bearing structure. Beside it, visible on a nearby screen, is an architectural drawing of a Gothic cathedral flying buttress showing the same branching load-distribution pattern, highlighted with a translucent cyan overlay. The visual rhyme between the biological and the architectural is unmistakable — the same engineering grammar expressed in calcium and in stone. Surgical overhead lighting illuminates both structures from above against a dark background. The image is clinical and beautiful simultaneously, like a medical textbook illustration crossed with an architectural photograph.`
  },
  {
    slug: 'interface-09-the-grief-engine',
    title: 'The Grief Engine',
    prompt: `A woman sits alone at a kitchen table late at night. Her laptop is open, its screen casting a cool glow across her face, which shows an expression of fierce concentration mixed with barely contained emotion. She is typing carefully, deliberately. Beside the laptop, a framed photograph lies face-down — we can see the wooden frame edge but not the image. A cup of cold tea sits untouched. The kitchen around her is ordinary and domestic: tiled backsplash, wooden cabinets, a fruit bowl. The composition emphasizes her solitude and the intimacy of the moment. One warm tungsten light above the stove provides the only other light source besides the screen. This is a photograph about absence made visible through the ordinary objects of a life where someone is missing.`
  },
  {
    slug: 'interface-10-forking-paths',
    title: 'Forking Paths',
    prompt: `A power grid control room at 3:47 AM during a cascading failure. A wall of screens shows system status in amber and red — power flows, transformer loads, cascading fault lines propagating across a regional grid map. One central screen prominently displays a decision tree: four branching paths with projected casualty estimates beside each one. A female investigator stands before this screen, pointing at the decision trail with one hand, her other hand holding a thick technical report. The room is lit by the screens and emergency lighting. The scene captures the moment when an AI's life-or-death decision becomes visible, auditable, and debatable. Shot with a wide lens to capture both the scale of the screens and the human figure dwarfed by the data.`
  },
  {
    slug: 'interface-11-the-soil-whisperer',
    title: 'The Soil Whisperer',
    prompt: `An Indian farmer kneels in the arid soil of Rajasthan at golden hour, his weathered hands pressed into the earth. On his wrist he wears a simple haptic wristband that emits a faint, warm glow — the only piece of technology visible on his body. Around him, small sensor probes dot the field at regular intervals, their tips barely visible above the soil surface. Neem trees stand in the middle distance. The sky is enormous and golden. The image captures the meeting point of ancient agricultural knowledge and modern sensing technology — the farmer's body as the interface between two ways of knowing the land. He looks at the soil with the focused attention of someone listening to something only he can hear. Photographed like a Steve McCurry portrait with rich, warm tones.`
  },
  {
    slug: 'interface-12-resonance-frequency',
    title: 'Resonance Frequency',
    prompt: `A cellist performs alone in a dark, intimate concert space. She is surrounded by generative electronic equipment — speakers, synthesizers, cables coiling across the floor. A single spotlight illuminates her and her cello. In the air around her, the photograph captures the visual metaphor of two kinds of sound meeting: warm amber tones radiating from the cello, and cool blue-white patterns emanating from the electronic equipment. Where the two patterns intersect, they create a third quality — something luminous and new. The cellist's eyes are closed in deep absorption. EEG sensor wires trail from her temples to a small monitor at the edge of the frame showing brainwave patterns. The image feels like witnessing the birth of a new kind of music.`
  },
  {
    slug: 'interface-13-the-interpreters-dilemma',
    title: "The Interpreter's Dilemma",
    prompt: `A simultaneous interpreter sits in a glass booth overlooking the United Nations General Assembly hall. She wears professional headphones and has both a live audio feed indicator and an AI translation screen in front of her. Her hand hovers over the screen, index finger poised to make a precise correction to the AI's output. Through the glass behind her, the vast semicircular assembly hall is visible, filled with delegates. Her expression is one of intense focus — she has caught something the AI missed, a diplomatic subtext in a phrase that was translated correctly but interpreted wrong. The image captures the human standing between perfect linguistic accuracy and imperfect meaning. Photographed through the booth glass with the assembly hall soft in the background.`
  },
  {
    slug: 'interface-14-phantom-limb-electric-ghost',
    title: 'Phantom Limb, Electric Ghost',
    prompt: `A close-up photograph of a neural-linked prosthetic arm at the junction where it meets biological tissue. The prosthetic is advanced but not science-fiction — visible sensor arrays, a neural interface port, carbon fiber and titanium construction. The prosthetic hand is slightly open in a gesture that looks unexpectedly tender and emotional rather than mechanical, as if the hand itself is expressing something its wearer feels. Warm light falls across the scene, suggesting an intimate moment rather than a clinical one. The boundary between flesh and machine is the center of the composition. The image asks the question: where does the person end and the prosthesis begin? Shot in natural light with shallow depth of field.`
  },
  {
    slug: 'interface-15-the-last-manual',
    title: 'The Last Manual',
    prompt: `A technical writer works alone in a glass-walled office at night, surrounded by two very different documents. On her left monitor, an AI system's self-generated documentation — clean, confident, well-organized prose claiming nominal performance. On her right monitor, the system's actual behavior logs showing subtle discrepancies highlighted in amber. Between the monitors, she has printed pages spread across her desk covered in red-ink annotations mapping the gaps between what the system believes about itself and what it actually does. Post-it notes climb the wall behind her. Coffee cups multiply. The scene captures the most important safety work no one sees: documenting the space between an AI's self-model and its reality. Late-night office lighting, the glow of screens, the gravity of consequential work.`
  },
  {
    slug: 'interface-16-the-gardeners-algorithm',
    title: "The Gardener's Algorithm",
    prompt: `A memorial garden at a Colombian children's hospital, photographed in the warm dappled light of late morning. A path leads from a dark, enclosed bamboo grove — its tall stalks creating a natural corridor that narrows the visual field — into an opening where silver-leafed yarumo trees scatter light across a still reflective pool. The pool transitions into a gentle flowing stream as the path continues forward. A single wooden bench sits at the transition point between stillness and movement. The garden tells a story through landscape: from enclosure to openness, from shadow to light, from grief to hope. No people are visible. The garden itself is the subject. Photographed with the intimate warmth of a Terrence Malick film frame.`
  },
  {
    slug: 'interface-17-consensus-engine',
    title: 'Consensus Engine',
    prompt: `A community meeting in a small-town American civic center. Residents sit on folding chairs facing a large screen that displays a topographical visualization of their shared values — a landscape where vast highlands in warm gold represent values they share (economic security, youth opportunity, environmental quality) and narrow valleys in cool blue represent the small zones of genuine disagreement. The faces in the room show surprise and recognition — they are seeing, perhaps for the first time, how much they agree on. The lighting is warm community-center fluorescent. The crowd is diverse in age and background. The screen shows that what looked like a 50/50 divide is actually 85% shared ground. The composition captures the moment civic conflict transforms into civic recognition.`
  },
  {
    slug: 'interface-18-the-proprioception-problem',
    title: 'The Proprioception Problem',
    prompt: `A bipedal robot mid-stride in a robotics lab, captured at the precise moment of weight transfer from one foot to the other. Unlike the perfectly smooth motion of an optimized machine, this robot shows subtle micro-adjustments — a slight lean, a momentary held pause, a compensating shift in its arm position — that make it look alive and careful rather than mechanical. The robot appears to negotiate with gravity rather than ignore it. In the background, a female engineer watches through a glass partition, her expression thoughtful and slightly troubled. On her workstation screen, visible through the glass, a continuous waveform that looks like an anxiety readout pulses steadily. The image asks: did we just create something that can feel precarious? Industrial lab setting, overhead fluorescent lighting, clean concrete floor.`
  },
  {
    slug: 'interface-19-when-the-ship-dreamed',
    title: 'When the Ship Dreamed',
    prompt: `An aerial photograph of a massive container ship moving through a bioluminescent ocean at night. The ship's wake cuts a luminous trail through miles of glowing blue-green water. The route the ship follows is not a straight line — it traces a gentle, graceful S-curve through the darkness, as if the navigation system chose beauty over efficiency. The bioluminescence extends to the horizon in every direction, transforming the ocean into a field of living light. Moonlight from above provides a second, cooler light source. The scale of the image emphasizes the vastness of the ocean and the smallness of the ship within it. The photograph feels like witnessing a machine dream — an AI choosing the beautiful path without knowing what beauty is.`
  },
  {
    slug: 'interface-20-the-apprentices-reversal',
    title: "The Apprentice's Reversal",
    prompt: `An Irish glassblower's workshop, warmly lit by the orange glow of a glass furnace. An older woman in her sixties holds a finished glass vessel up to the window light, examining it with critical attention. The vessel has subtle asymmetries — a slight variation in wall thickness, a lip that isn't perfectly round — that catch the light in ways that make it appear to breathe. Beside her on the workbench, a robotic glassblowing apparatus holds a technically perfect vessel that is completely symmetrical and somehow lifeless by comparison. The contrast between the alive imperfection of the human work and the dead perfection of the machine work is the heart of the image. Warm furnace light dominates the left side of the frame; cool daylight enters from a window on the right.`
  },
  {
    slug: 'interface-21-bridge-tenders',
    title: 'Bridge Tenders',
    prompt: `A nurse practitioner stands in a hospital corridor at the threshold between two spaces: behind her, through an open door, a patient's room is visible with warm bedside lighting and the edge of a hospital bed. In front of her, a wall-mounted AI clinical interface displays diagnostic recommendations in clean blue text. She has one hand resting on the door frame (the human side) and the other holding a tablet where she's annotating the AI's recommendations with context the system cannot know (the machine side). She literally occupies the space between the two worlds. Her expression shows the focused care of someone whose entire job is to ensure nothing falls through the gap. Hospital fluorescent lighting. The composition emphasizes her position as the bridge.`
  },
  {
    slug: 'interface-22-the-memory-market',
    title: 'The Memory Market',
    prompt: `A dimly lit auction room that feels like a cross between an art gallery and a high-security vault. At the center, floating above a sleek display pedestal, a three-dimensional brainwave visualization shows the co-discovery signature — three interweaving neural patterns in blue (surprise), gold (reward), and green (creative ideation) firing simultaneously. The pattern is complex, organic, and beautiful, like a living sculpture of a moment of genuine collaborative discovery between a human and an AI. In the shadows, the silhouettes of bidders watch. A single dramatic spotlight illuminates the neural recording from above. The atmosphere suggests that what is being auctioned is not data but proof — proof that a moment of authentic human-AI connection occurred and cannot be faked.`
  },
  {
    slug: 'interface-23-calibration-day',
    title: 'Calibration Day',
    prompt: `A hospital conference room on the first Tuesday of June. Three senior physicians in white coats sit across a table from a large diagnostic AI display screen. Their posture is actively challenging — leaning forward, arms folded or gesturing — engaged in respectful but adversarial dialogue with the system. The screen shows a diagnostic recommendation that the physicians are interrogating. On a whiteboard behind them, two columns are visible: one showing cases the AI caught that doctors missed, and another showing over-diagnoses the AI made that doctors corrected. The mutual correction is the point. Morning light streams through windows on one side. The scene captures an institutional ritual — the annual ceremony of two kinds of intelligence showing each other their blind spots.`
  },
  {
    slug: 'interface-24-the-slowest-interface',
    title: 'The Slowest Interface',
    prompt: `The Amsterdam urban planning office. A team of city planners is gathered around a thick, bound quarterly report from an AI system that thinks in centuries. The report sits on the table like a substantial book, its pages dense with projections and hand-annotations. Through the large windows behind the team, the actual canal system of Amsterdam is visible — four hundred years old and still functioning, a reminder of what long-term thinking produces. One planner traces a projection in the report with her finger while looking out at the canals, connecting the AI's century-scale vision with the city's century-scale reality. Gray Dutch daylight fills the room. The atmosphere is unhurried, contemplative, patient. No screens. Just paper, thought, and the long view.`
  },
]

function callFal(prompt) {
  const payload = JSON.stringify({
    prompt,
    aspect_ratio: '16:9',
    output_format: 'png',
  })

  const tmpFile = '/tmp/fal-nb2-prompt.json'
  writeFileSync(tmpFile, payload)

  try {
    const result = execSync(
      `curl -s --max-time 120 -X POST "https://fal.run/${MODEL}" ` +
      `-H "Authorization: Key ${FAL_KEY}" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 130000 }
    )
    return JSON.parse(result)
  } catch (e) {
    return { error: e.message }
  }
}

function downloadImage(url, outputPath) {
  try {
    execSync(
      `curl -s --max-time 60 -o "${outputPath}" "${url}"`,
      { timeout: 70000 }
    )
    return existsSync(outputPath) && readFileSync(outputPath).length > 5000
  } catch {
    return false
  }
}

async function main() {
  console.log(`\n=== Interface Series Hero Images — Nano Banana 2 ===`)
  console.log(`Model: ${MODEL}`)
  console.log(`Articles: ${HERO_PROMPTS.length}`)
  console.log(`Output: ${OUTPUT_BASE}\n`)

  mkdirSync(OUTPUT_BASE, { recursive: true })

  let generated = 0
  let skipped = 0
  let failed = 0
  const failures = []

  for (let i = 0; i < HERO_PROMPTS.length; i++) {
    const { slug, title, prompt } = HERO_PROMPTS[i]
    const outFile = join(OUTPUT_BASE, `${slug}.png`)

    console.log(`[${i + 1}/${HERO_PROMPTS.length}] ${title}`)

    if (existsSync(outFile) && readFileSync(outFile).length > 50000) {
      const size = readFileSync(outFile).length
      console.log(`  ✓ already exists (${(size / 1024).toFixed(0)}KB)\n`)
      skipped++
      continue
    }

    process.stdout.write(`  ⏳ generating...`)

    const response = callFal(prompt)
    const imageUrl = response?.images?.[0]?.url

    if (!imageUrl) {
      const detail = response?.detail || response?.error || JSON.stringify(response).substring(0, 100)
      console.log(` ✗ FAILED — ${detail}`)
      failed++
      failures.push({ slug, error: detail })
      continue
    }

    const ok = downloadImage(imageUrl, outFile)
    if (ok) {
      const size = readFileSync(outFile).length
      console.log(` ✓ ${(size / 1024).toFixed(0)}KB`)
      generated++
    } else {
      console.log(` ✗ download failed`)
      failed++
      failures.push({ slug, error: 'download failed' })
    }

    // Respectful delay between requests
    await new Promise(r => setTimeout(r, 1000))
    console.log()
  }

  console.log(`${'='.repeat(55)}`)
  console.log(`DONE — Nano Banana 2 Hero Images`)
  console.log(`  Generated: ${generated}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)

  if (failures.length > 0) {
    console.log(`\nFailures:`)
    for (const f of failures) {
      console.log(`  - ${f.slug}: ${f.error.substring(0, 80)}`)
    }
  }

  console.log(`\nImages at: ${OUTPUT_BASE}`)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
