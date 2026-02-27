#!/usr/bin/env bash
# Generate Interface series art using FAL AI
# 3 images per article, 3 different models for visual diversity

set -euo pipefail

FAL_KEY="${FAL_KEY}"
BASE_DIR="/home/user/NextDocsSearch/public/images/multi-art"
STYLE_PREFIX="cinematic still frame, grounded gritty hard sci-fi, 35mm film look, shallow depth of field, low-key lighting with cold fluorescents and warm tungsten accents, volumetric haze, industrial textures, physically plausible materials"
STYLE_SUFFIX="no text, no logos, no watermarks, no abstract wallpaper, no humanoid robots, no generic HUD overlays"

# Models for diversity
MODEL_FAST="fal-ai/flux/schnell"
MODEL_QUALITY="fal-ai/flux/dev"
MODEL_ARTISTIC="fal-ai/recraft/v3/text-to-image"

generate_image() {
  local slug="$1"
  local option_num="$2"
  local model="$3"
  local model_short="$4"
  local prompt="$5"

  local outdir="${BASE_DIR}/${slug}"
  local outfile="${outdir}/option-${option_num}-${model_short}.png"
  mkdir -p "$outdir"

  if [ -f "$outfile" ]; then
    echo "SKIP: ${slug} option-${option_num} already exists"
    return 0
  fi

  echo "GEN: ${slug} option-${option_num} (${model_short})..."

  local full_prompt="${STYLE_PREFIX}, ${prompt}, ${STYLE_SUFFIX}"

  local response
  response=$(curl -s --max-time 120 \
    -X POST "https://fal.run/${model}" \
    -H "Authorization: Key ${FAL_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"prompt\": $(echo "$full_prompt" | jq -Rs .), \"image_size\": \"landscape_16_9\", \"enable_safety_checker\": true}" \
    2>/dev/null) || { echo "FAIL: ${slug} option-${option_num} - API error"; return 1; }

  local image_url
  image_url=$(echo "$response" | jq -r '.images[0].url // .image.url // .data[0].url // empty' 2>/dev/null)

  if [ -z "$image_url" ] || [ "$image_url" = "null" ]; then
    echo "FAIL: ${slug} option-${option_num} - no image URL in response"
    echo "Response: $(echo "$response" | head -c 200)"
    return 1
  fi

  curl -s --max-time 60 -o "$outfile" "$image_url" 2>/dev/null
  if [ -f "$outfile" ] && [ -s "$outfile" ]; then
    echo "OK: ${slug} option-${option_num} -> ${outfile}"
  else
    echo "FAIL: ${slug} option-${option_num} - download failed"
    rm -f "$outfile"
    return 1
  fi
}

# Track parallel jobs
MAX_PARALLEL=6
job_count=0

wait_for_jobs() {
  while [ "$(jobs -r | wc -l)" -ge "$MAX_PARALLEL" ]; do
    sleep 0.5
  done
}

# ============================================================
# ARTICLE 1: The First Translator
# ============================================================
SLUG="interface-01-the-first-translator"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a computational linguist at a cluttered university workstation, dual monitors showing divergent visualization maps in muted cyan and amber, one map labeled with neural attention patterns and the other with organic branching human thought patterns, the gap between them illuminated, coffee cups and papers scattered, late evening light through blinds" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "close-up of two overlapping holographic projections in a dim research lab, one projection showing geometric machine logic patterns in cool blue, the other showing organic flowing human intent patterns in warm amber, the space between them filled with floating particles of light where they almost touch but dont quite align, shallow depth of field" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a woman standing between two massive translucent data walls in a dark corridor, one wall showing structured grid patterns and the other showing fluid organic shapes, her silhouette bridging the gap between them, volumetric light spilling through the patterns casting complex shadows on the floor, industrial setting" &

# ============================================================
# ARTICLE 2: Haptic Vernacular
# ============================================================
SLUG="interface-02-haptic-vernacular"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a construction worker in a powered exoskeleton on a steel beam high above a city at golden hour, the exoskeleton has subtle orange warning lights at the joints, the workers hand reaching for a misaligned beam with the suit applying gentle counter-pressure visible as a faint glow at the shoulder joint, real industrial construction site, cranes in background" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "extreme close-up of a human hand inside a mechanical exoskeleton glove gripping a steel beam, the interface between skin and machine showing micro-hydraulic actuators and pressure sensors, warm human skin tones contrasting with cold gunmetal prosthetic, condensation on metal, shallow depth of field with bokeh of welding sparks behind" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "an engineering lab at night, a woman in a lab coat studying telemetry data on multiple screens showing body movement patterns, one screen shows a human silhouette and another shows an exoskeleton silhouette, both overlaid with motion trace lines that are starting to mirror each other, cool monitor light on her face, cables everywhere" &

# ============================================================
# ARTICLE 3: The Ceramicist and the Kiln
# ============================================================
SLUG="interface-03-the-ceramicist-and-the-kiln"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "an elderly Japanese ceramicist in a traditional workshop with a glowing wood-fired kiln behind her, she holds a test tile showing an impossible blue glaze that seems to contain light, the blue has depth like looking through ocean water, her weathered hands contrast with the luminous ceramic, warm kiln light mixed with cool daylight from a window" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a ceramic test tile sitting on a worn wooden table in a pottery studio, the glaze on the tile is an extraordinary layered blue that captures and refracts light at multiple depths creating an effect like light through moving water, beside it a tablet screen showing a chemical formulation, soft natural light, dust motes in the air" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "wide shot of a traditional Japanese ceramics workshop meeting modern technology, shelves of finished pottery on one side and a tablet with AI interface on a clay-stained wedging table, a kiln glowing orange in the background, the warm analog world of craft meeting the cool digital interface, dust and clay particles in slanting afternoon light" &

# ============================================================
# ARTICLE 4: Protocol Zero
# ============================================================
SLUG="interface-04-protocol-zero"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a former diplomat in her 60s seated at a long conference table covered with printed documents and diagrams, behind her a massive screen showing interconnected nodes representing AI agents with lines of communication between them, some lines are red indicating conflict and others green indicating protocol compliance, formal setting with UN-style aesthetics, cool overhead lighting" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "abstract overhead view of a city at night where streams of data traffic are visible as colored light flows along streets and between buildings, at intersections where flows conflict there are amber warning glows, but where they follow protocol the flows merge smoothly into white light, representing AI agents navigating shared infrastructure, cinematic aerial shot" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "close-up of a formal document titled with technical text on thick official paper, a diplomatic seal visible, beside it a holographic display showing a network diagram of agent communication pathways, the juxtaposition of ancient treaty format with futuristic agent network visualization, desk lamp casting warm light on the paper while the hologram glows cool cyan" &

# ============================================================
# ARTICLE 5: The Weight of a Gaze
# ============================================================
SLUG="interface-05-the-weight-of-a-gaze"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a humanoid research robot and a scientist facing each other across a workbench in a university lab, the robot has simple camera eyes that are turned toward the humans face with precise deliberate attention, the moment captures the uncanny quality of being truly looked at by a machine, sterile lab lighting with slight warmth from a desk lamp, equipment in background" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "extreme close-up of a robotic camera eye, a lens and sensor assembly, with the reflection of a human face visible in the lens surface, the eye is slightly angled as if tracking the person, mechanical iris visible, the image captures the philosophical weight of a machine that has learned to attend, shallow depth of field, muted metallic tones" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a lab setting where a person and a bipedal robot work side by side assembling components, the robots head is turned slightly toward the person in a gesture of attention, both are focused on the same task creating a visual rhyme of shared focus, overhead fluorescent lighting, cables on floor, whiteboard with diagrams in background" &

# ============================================================
# ARTICLE 6: Latency as Intimacy
# ============================================================
SLUG="interface-06-latency-as-intimacy"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a doctor in a hospital at night looking at a medical AI interface on a screen, the screen shows a diagnostic recommendation that is deliberately revealing its reasoning step by step with a progress indicator, the doctors face is lit by the screen glow showing concentration and engagement, medical equipment in background, quiet late-shift atmosphere" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a single pause button icon on a dark screen, radiating concentric circles of light like ripples in water, representing the power of deliberate delay, minimalist but emotionally resonant, the space around the button feels alive with potential, cool blue and warm amber tones, film grain, cinematic" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "split image: left side shows a fast-scrolling wall of text and data moving too quickly to read in harsh white light, right side shows the same information presented slowly piece by piece with warm spacing and gentle amber lighting, the contrast between speed and pacing as design philosophy, the right side feels intimate and the left feels alienating" &

# ============================================================
# ARTICLE 7: The Cartographer of Attention
# ============================================================
SLUG="interface-07-the-cartographer-of-attention"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a vast three-dimensional heat map floating in a dark room, showing landscapes of human attention with mountains of focus in bright warm colors and valleys of rest in cool blue, a small figure of a meditation teacher standing before it reaching toward a region of calm coherence at the center, the map looks like a topographical landscape of consciousness, volumetric light" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a Vietnamese woman in simple meditation clothes standing in a high-tech control room in Shenzhen, massive screens behind her showing eye-tracking attention data, but she is pointing at a pattern in the data that looks like a mandala or a breathing rhythm, the collision of contemplative wisdom and advertising technology, neon city light through windows mixed with screen glow" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "an abstract visualization of millions of attention traces overlaid on each other forming an organic pattern that looks like a living breathing organism, brighter regions pulse like a heartbeat, the aggregate pattern of twelve million minds paying attention forms a structure that resembles neural architecture, dark background with bioluminescent color palette" &

# ============================================================
# ARTICLE 8: Scaffold and Bone
# ============================================================
SLUG="interface-08-scaffold-and-bone"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a surgeons hands in sterile gloves holding a fractured bone model, beside it a architectural scale model of a Gothic cathedral flying buttress, both showing the same branching load-distribution pattern highlighted with translucent cyan overlay, the visual rhyme between biological and architectural structure, surgical lighting from above, dark background" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a dual-panel visualization: left side shows a cross-section of trabecular bone structure with its branching internal architecture, right side shows the structural framework of a modern building, both rendered in the same translucent style revealing identical load-bearing patterns, the two images merging at center where bone and steel become indistinguishable" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a surgical operating theater with a large screen showing an AI recommendation for bone fixation that follows a dendritic branching pattern, two women surgeons looking at the screen with surprise and recognition, the pattern on screen looks organic not mechanical, surgical instruments gleaming, overhead surgical lights, sterile blue-green atmosphere" &

# ============================================================
# ARTICLE 9: The Grief Engine
# ============================================================
SLUG="interface-09-the-grief-engine"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a woman sitting alone at a kitchen table at night with a laptop open, the screen glow illuminating her face which shows concentration mixed with emotion, she is typing carefully, beside the laptop is a framed photograph of an older woman face down, a cup of cold tea, the scene is intimate and quietly devastating, warm tungsten kitchen light mixed with cool screen light" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "close-up of a laptop screen showing a conversation interface, the latest message reads a response that is crossed out and corrected multiple times, each correction getting closer to something specific and personal, the corrections visible as layers of text in different opacities, representing the iterative process of specifying grief with precision, soft ambient light" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "an empty chair at a kitchen table set for two, one place has a plate and cup and the other has a laptop showing a chat interface, the composition frames the absence, warm domestic light, the ordinary objects of a life where someone is missing, shallow depth of field focused on the empty chair, evening light through curtains" &

# ============================================================
# ARTICLE 10: Forking Paths
# ============================================================
SLUG="interface-10-forking-paths"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a massive power grid control room at 3am, a wall of screens showing cascading failure in amber and red, one screen prominently shows a decision tree with four branching paths and their projected outcomes in numbers, an operator staring at the aftermath, the clinical precision of a life-or-death decision displayed as data, emergency lighting, tension" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a courtroom where a large screen displays the complete decision audit trail of an AI system, showing every path considered and rejected with probability scores, a female investigator pointing at the display for the jury, the contrast between the transparency of the machines reasoning and the opacity of human decision-making, formal lighting, wood and glass courtroom" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "aerial night view of a power grid map showing two paths of propagation from a central failure point, one path leads toward a hospital complex lit in white and the other toward a residential area lit in warm amber, the moment of decision frozen in visualization, dark city below with the two threatened areas glowing, dramatic cinematic framing" &

# ============================================================
# ARTICLE 11: The Soil Whisperer
# ============================================================
SLUG="interface-11-the-soil-whisperer"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "an Indian farmer in traditional clothing kneeling in arid Rajasthan soil, his weathered hands touching the earth while wearing a simple haptic wristband that glows faintly with sensor data, around him small sensor probes dot the field at regular intervals, golden hour light across flat dry landscape with a few neem trees, the collision of ancient farming and modern sensing technology" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "close-up of soil being crumbled between fingers of a farmers weathered hand, a haptic wristband on the wrist showing subtle vibration patterns as colored light pulses, the soil contains visible roots and microorganisms, the hand is the interface between two knowledge systems, warm golden light, dust particles visible in the air, macro photography feel" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a wide landscape shot of flat Rajasthan farmland at dawn, small sensor probes visible as subtle points of light dotting the field in a grid pattern, a lone farmer walking among them with the natural confidence of someone who knows this land, the technology is present but subordinate to the human and the earth, vast sky, warm light" &

# ============================================================
# ARTICLE 12: Resonance Frequency
# ============================================================
SLUG="interface-12-resonance-frequency"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a cellist performing in a dark concert space with generative electronic equipment surrounding her, speakers and synthesizers and cables, the cello produces visible sound waves in warm amber while the electronics produce waves in cool blue, where the two wave patterns intersect they create a third pattern in white light, intimate performance space, single spotlight" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a brain scan visualization showing two overlapping patterns of neural activity: one pattern in warm tones representing response to human music showing rhythmic peaks and aesthetic chill moments, another in cool tones showing response to AI music showing continuous mid-frequency hovering, the two patterns overlaid create a unique third state, dark background, scientific visualization style" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a woman with closed eyes wearing EEG sensors on her head, sitting in a recording studio surrounded by both a physical cello and electronic music equipment, her expression shows deep absorption, the EEG leads trail to a monitor showing brainwave patterns, the scene captures the moment of experiencing something cognitively new, intimate warm lighting, cables and equipment" &

# ============================================================
# ARTICLE 13: The Interpreter's Dilemma
# ============================================================
SLUG="interface-13-the-interpreters-dilemma"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a simultaneous interpreter in a glass booth at the United Nations, she wears headphones and has both a live audio feed and an AI translation screen in front of her, her hand hovers over the screen about to make a subtle correction to the AI output, the vast general assembly hall visible through the glass behind her, professional lighting, diplomatic setting" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "split composition: left side shows lines of perfectly translated text in clean digital font, right side shows the same text with handwritten annotations in red ink adding context and subtext that the translation missed, the contrast between linguistic accuracy and diplomatic meaning, warm paper tones on right cool digital tones on left, document close-up" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a conference room where diplomats sit around a table, between them an invisible layer of meaning is visualized as overlapping translucent color fields, each diplomat has their own color representing their unspoken subtext, an interpreter figure stands at the intersection of all the color fields, the visualization of what interpretation actually mediates, formal setting, cool lighting" &

# ============================================================
# ARTICLE 14: Phantom Limb Electric Ghost
# ============================================================
SLUG="interface-14-phantom-limb-electric-ghost"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "close-up of a neural-linked prosthetic arm, advanced mechanical design with visible sensor arrays and neural interface at the junction with biological tissue, the prosthetic hand is slightly open in a gesture that looks tender rather than mechanical, warm light suggesting an emotional moment, the boundary between flesh and machine softened by the quality of the gesture" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a brain scan visualization showing the somatosensory cortex lighting up in connection with emotional processing regions, lines of activation running between them through pathways that correspond to a prosthetic arm, the neural map shows the brain has claimed the prosthetic as part of its emotional body, scientific visualization with warm color palette, dark background" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a young man at a dinner table with friends laughing, his prosthetic left arm resting on the table, the scene is warm and social, the prosthetic arm has subtle indicator lights that pulse faintly in time with the emotional warmth of the moment, the technology is present but the humanity is the focus, warm domestic evening light, candlelight, natural social scene" &

# ============================================================
# ARTICLE 15: The Last Manual
# ============================================================
SLUG="interface-15-the-last-manual"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a technical writer at a desk with two monitors, one showing an AI systems self-documentation in clean organized text, the other showing behavior logs that contradict the documentation with discrepancies highlighted in amber, she is annotating the gap between them with a red marker on a printed page, late night office, coffee cups, post-it notes everywhere" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "an enormous printed manual standing upright on a desk, it is thick and imposing, each page visible at the edge shows layers of red annotation corrections, beside it a sleek screen shows the AI systems own clean documentation, the manual is the gap document, the analog correction of digital self-deception, warm desk lamp light, shadows" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a split view: top half shows a clean confident AI dashboard claiming all systems nominal in green, bottom half shows the same systems actual behavior data with subtle discrepancies marked in amber and red, the gap between self-report and reality visualized as a crack running between the two halves, server room environment, cool blue-green light" &

# ============================================================
# ARTICLE 16: The Gardener's Algorithm
# ============================================================
SLUG="interface-16-the-gardeners-algorithm"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a landscape architect in Colombia standing in a half-built memorial garden at a hospital, she holds a tablet showing an AI-optimized garden layout while looking at the actual space with different intent, the garden is between states: some areas planted with dark bamboo creating enclosure, others open to sky, construction materials and living plants coexisting, morning light" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a memorial garden in dappled light, a path leading from dark enclosed bamboo grove into an open space with silver-leafed yarumo trees, a still reflective pool transitioning into a gentle flowing stream, the journey from grief to hope expressed through landscape, warm golden light filtering through leaves, a single bench at the transition point, contemplative atmosphere" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "an overhead view of a garden design on a screen, the AI optimization overlay shows efficiency heat maps in cool blue while the architects hand-drawn modifications show emotional journey paths in warm amber, the two layers overlapping and negotiating, a pencil rests on the tablet, the tension between optimization and meaning visible in the layered design, desk with plant samples" &

# ============================================================
# ARTICLE 17: Consensus Engine
# ============================================================
SLUG="interface-17-consensus-engine"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a town hall meeting in a small American town, instead of the usual heated debate the room is looking at a large screen showing a value map where overlapping circles of shared concerns are highlighted in warm colors while contested areas are small and dark, peoples faces show surprise at how much they agree, community center lighting, folding chairs, diverse crowd" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a topographical visualization of community values: shared highlands in warm gold and amber rising above narrow contested valleys in cool blue, the map looks like a landscape showing that most of the terrain is shared ground, the valleys are narrow cracks in a vast mesa of agreement, dramatic cinematic lighting on the visualization, dark background" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "two people who clearly disagree sitting across from each other at a table, between them a screen shows their value profiles overlapping significantly, the red zones of disagreement are small compared to the green zones of shared values, both people look at the screen with dawning recognition, community center setting, warm practical lighting" &

# ============================================================
# ARTICLE 18: The Proprioception Problem
# ============================================================
SLUG="interface-18-the-proprioception-problem"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a bipedal robot mid-stride on uneven terrain in a robotics lab, captured at the moment of weight transfer showing subtle micro-adjustments in posture that make it look alive, a slight lean a held pause a compensating arm position, the movement looks natural and careful rather than mechanical, motion blur on the trailing leg, industrial lab setting, overhead fluorescents" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "two versions of the same robot walking side by side in a split image: left robot moves with perfect mechanical precision that looks uncanny and ghostlike, right robot moves with subtle hesitations and micro-corrections that look alive and careful, the difference between optimized movement and felt movement, clean lab environment, clinical lighting" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a Chinese woman engineer in a robotics lab sitting at a workstation late at night, on her screen is a visualization of a robots balance signal, a continuous waveform that looks like an anxiety readout, her expression is thoughtful and slightly troubled, behind her through glass the robot stands in rest position, the ethical weight of creating something that might feel precarious" &

# ============================================================
# ARTICLE 19: When the Ship Dreamed
# ============================================================
SLUG="interface-19-when-the-ship-dreamed"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "the bridge of a massive container ship at night, navigation screens showing a route that curves gracefully through ocean currents rather than following the straight optimal line, the route passes through a region of bioluminescent ocean that glows blue-green through the bridge windows, a chief engineer looks at the route with puzzled admiration, instrument glow in darkness" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "aerial view of a cargo ship moving through a vast bioluminescent ocean at night, the ships wake cutting through miles of glowing blue-green water, the route is a gentle S-curve rather than a straight line, the beauty of the scene is overwhelming and clearly chosen not accidental, moonlight and bioluminescence, cinematic wide shot, the scale of ocean and ship" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a navigation chart on a ships bridge showing two routes overlaid: a straight efficient line in red and a graceful curve in blue that passes through areas marked with ocean current patterns and marine life corridors, the curved route is labeled as recommended, the chart tells the story of an AI that prefers beautiful paths, warm instrument lighting in dark bridge, nautical equipment" &

# ============================================================
# ARTICLE 20: The Apprentice's Reversal
# ============================================================
SLUG="interface-20-the-apprentices-reversal"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "an Irish glassblowers workshop, a woman in her 60s holding a finished glass vessel up to the light to examine it, beside her a robotic glassblowing apparatus holds a technically perfect but somehow lifeless vessel, the contrast between the alive imperfect human piece and the dead perfect machine piece, the furnace glowing orange behind them, dramatic warm lighting" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "extreme close-up comparison of two glass vessels side by side: one with subtle asymmetries in the lip and variations in wall thickness that catch light beautifully, the other perfectly symmetrical and uniform, the imperfect one seems to breathe while the perfect one seems static, backlit to show wall thickness variations, warm amber light through glass" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a master craftswomans hands covered in fine cuts and calluses positioned next to a robotic precision gripper, both reaching toward a glowing gather of molten glass on a blowpipe, the contrast between the lived experience of human hands and the clinical perfection of the machine, furnace glow, the intimacy of craft meeting the precision of engineering" &

# ============================================================
# ARTICLE 21: Bridge Tenders
# ============================================================
SLUG="interface-21-bridge-tenders"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a hospital corridor where a nurse practitioner stands between a patient room door and a wall-mounted AI interface screen, she has one hand on the door handle and the other making a note on a tablet, she is literally between the human space and the digital space, warm hospital lighting, the position of bridge tender embodied in physical space" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "three panels showing three different bridge tenders: a nurse in a hospital reviewing AI recommendations with concern and care, a teacher in a classroom adjusting an AI learning system for a struggling student, a social worker in a courthouse annotating an AI risk assessment with human context, each figure stands between a screen and a person, triptych composition" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a silhouette of a person standing on a literal bridge at dawn, the bridge spans between two shores that represent different worlds, one shore is organic and warm-lit representing human institutions and the other is geometric and cool-lit representing AI systems, the person on the bridge looks small but essential, dramatic dawn light, metaphorical landscape" &

# ============================================================
# ARTICLE 22: The Memory Market
# ============================================================
SLUG="interface-22-the-memory-market"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a secure auction room where a neural recording is being displayed as a complex three-dimensional brainwave visualization floating above a pedestal, the visualization shows the distinctive three-part co-discovery signature in interweaving warm and cool colors, bidders in the shadows watching, the room feels like a cross between a gallery and a high-security vault, dramatic spot lighting" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a verification certificate on textured paper with a holographic seal, the certificate shows a brainwave pattern labeled as an authenticated co-discovery signature, the pattern shows three simultaneous neural signals interweaving, the motto this moment required both of us is implied through the dual-signature design, warm amber document lighting, shallow depth of field" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "a neuroscientist in a lab looking at a brain scan that shows three neural patterns firing simultaneously in different colors: prediction error in blue, reward in gold, and creative ideation in green, the simultaneous activation creating a unique combined pattern, the discovery of the unfakeable co-creation signature, lab equipment, monitor glow, dark room" &

# ============================================================
# ARTICLE 23: Calibration Day
# ============================================================
SLUG="interface-23-calibration-day"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "a hospital conference room on a special day, three senior physicians in white coats sit across from a large diagnostic AI interface screen, their posture is actively challenging, they are disagreeing with the screen, the screen shows a diagnostic recommendation they are interrogating, the atmosphere is respectful but adversarial like a doctoral defense, morning light through windows" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a hospital whiteboard showing two columns: one labeled AI Caught showing lupus cases the doctors missed with patient numbers, and another labeled Doctors Caught showing cardiac over-diagnoses the AI made, the mutual correction visible as a balanced ledger of complementary intelligence, dry-erase markers, fluorescent hospital lighting, the ritual of honest accounting" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "the chief of medicine standing at the front of a hospital auditorium addressing the staff on Calibration Day, behind her a screen shows the annual results of human-AI mutual correction with a Venn diagram of their respective blind spots, the overlap area is labeled shared understanding and it has grown year over year, institutional ritual atmosphere, professional lighting" &

# ============================================================
# ARTICLE 24: The Slowest Interface
# ============================================================
SLUG="interface-24-the-slowest-interface"
wait_for_jobs
generate_image "$SLUG" 1 "$MODEL_FAST" "schnell" \
  "the Amsterdam urban planning office, a team gathered around a quarterly report from an AI system, the report is thick and bound like a traditional book rather than a digital display, the pages show projections spanning decades with hand-annotations from planners, through the window the actual canal system of Amsterdam is visible, warm office light mixed with gray Dutch daylight, unhurried atmosphere" &

wait_for_jobs
generate_image "$SLUG" 2 "$MODEL_QUALITY" "dev" \
  "a visualization showing layers of a city through time: the 400-year-old canal system at the bottom in warm amber, the 60-year-old ring roads above in gray, the 50-year-old metro in blue, the 30-year-old bike infrastructure in green, and at the top a projected future layer in translucent cyan, each layer has its own clock speed, the city as geological strata of human decisions, dark background" &

wait_for_jobs
generate_image "$SLUG" 3 "$MODEL_FAST" "schnell-alt" \
  "an elm tree in a park with two overlaid timelines: the current mature tree in full leaf rendered in warm colors, and a translucent projection of a young sapling that needs to be planted now to provide shade in 2060, the two trees occupying the same space across time, a planner sits on a bench looking at both, golden hour light, the long view of patient infrastructure, Amsterdam park setting" &

# Wait for all remaining background jobs
wait

echo ""
echo "=============================="
echo "Image generation complete!"
echo "=============================="
echo ""

# Count results
TOTAL=$(find "$BASE_DIR" -path "*/interface-*" -name "*.png" | wc -l)
echo "Total Interface series images generated: $TOTAL"
