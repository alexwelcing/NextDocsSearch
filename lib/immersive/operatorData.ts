// Structured content for the in-scene operator terminal UI.
// Copy is sourced from pages/about.tsx, pages/current-work.tsx, and pages/pitch.tsx.
// This file is standalone data — no imports, no runtime dependencies.

export interface PanelBlock {
  kind: 'heading' | 'paragraph' | 'item'
  text: string
  meta?: string // e.g. dates, role, company for 'item' blocks
}

export interface OperatorPanel {
  id: 'about' | 'work' | 'pitch'
  title: string
  blocks: PanelBlock[]
}

export const ABOUT_PANEL: OperatorPanel = {
  id: 'about',
  title: 'OPERATOR DOSSIER',
  blocks: [
    { kind: 'heading', text: 'IDENTITY' },
    {
      kind: 'item',
      text: 'Alex Welcing',
      meta: 'Northeast AI product leader — New York, NY — currently at ALM',
    },
    {
      kind: 'paragraph',
      text: '15 years of experience shipping AI features, enterprise SaaS platforms, and regulated product systems across New York and the Northeast. Currently at ALM, an integrated media company serving the legal and commercial real estate sectors.',
    },
    {
      kind: 'paragraph',
      text: 'Background spans both technical development and marketing strategy, with a track record of translating complex customer needs into measurable outcomes. Hands-on experience building secure SaaS platforms, optimizing data pipelines, and launching AI-driven features in regulated industries.',
    },
    { kind: 'heading', text: 'EXPERIENCE LOG' },
    {
      kind: 'item',
      text: 'Steer product strategy and delivery for an integrated media company providing specialized business information to the legal and commercial real estate sectors. Translate complex customer needs into measurable outcomes.',
      meta: 'Product Manager — ALM — Jan 2024 - Present',
    },
    {
      kind: 'item',
      text: 'Launched cutting-edge SaaS platforms and immersive VR capabilities. Optimized data pipelines with Google Analytics 4 integration. Enabled real-time 3D rendering across mobile, headset, and desktop.',
      meta: 'Product Manager — Obsess — Previous',
    },
    {
      kind: 'item',
      text: 'Built a secure client SaaS platform for legal and regulatory analysis. Implemented AI-driven document scanning capabilities. Developed knowledge/training portal that delivered strong ROI.',
      meta: 'Developer — Manatt, Phelps & Phillips, LLP — Previous',
    },
    {
      kind: 'item',
      text: 'Drove business development in artificial intelligence and built NLP-powered interactive content partnerships.',
      meta: 'Developer — Arkadium — Previous',
    },
    { kind: 'heading', text: 'EXPERTISE MATRIX' },
    {
      kind: 'item',
      text: 'Product strategy, platform development, and scaling B2B solutions.',
      meta: 'SaaS Platforms',
    },
    {
      kind: 'item',
      text: 'Immersive experiences, real-time rendering across mobile/headset/desktop.',
      meta: 'VR & 3D',
    },
    {
      kind: 'item',
      text: 'Pipeline optimization, GA4 integration, data-driven product decisions.',
      meta: 'Data & Analytics',
    },
    {
      kind: 'item',
      text: 'Secure client platforms, regulatory analysis tools, AI-driven document processing.',
      meta: 'Legal Tech',
    },
    { kind: 'heading', text: 'EDUCATION' },
    {
      kind: 'item',
      text: 'Combined technical development expertise with marketing strategy and business fundamentals.',
      meta: 'BS in Marketing — Naveen Jindal School of Management, UT Dallas',
    },
    { kind: 'heading', text: 'TECHNICAL BACKGROUND' },
    {
      kind: 'paragraph',
      text: '15 years across product, coding, software development, and AI-enabled platform work — hands-on technical depth applied to product leadership. This site itself is built with Next.js, React Three Fiber, and AI integrations.',
    },
    {
      kind: 'item',
      text: 'React, TypeScript, Node.js, Python, Next.js, Three.js, SQL, AWS',
      meta: 'Stack',
    },
    { kind: 'heading', text: 'CONTACT' },
    {
      kind: 'item',
      text: 'alexwelcing@gmail.com',
      meta: 'Email',
    },
    {
      kind: 'item',
      text: 'linkedin.com/in/alexwelcing · github.com/alexwelcing',
      meta: 'Links',
    },
  ],
}

export const WORK_PANEL: OperatorPanel = {
  id: 'work',
  title: 'ACTIVE RESEARCH THREADS',
  blocks: [
    { kind: 'heading', text: 'PREMISE' },
    {
      kind: 'paragraph',
      text: "Four threads, one shared premise: the interesting problems in AI right now aren't inside the model — they're in the coordination layer around it. Between providers. Between the agent and the person authorizing it. Between the model's confidence and the human's trust. Between the simulation and the experiment. The gap between what a model can do and what it can do for you is where I spend my time.",
    },
    { kind: 'heading', text: 'THREAD 01 — MULTI-PROVIDER COORDINATION' },
    {
      kind: 'paragraph',
      text: 'No single model provider runs a 48-hour research job well. Claude has the reasoning, Gemini has the context window, local models have the rate-limit headroom, a specialized model has the domain knowledge. The actual research workflow inevitably crosses provider boundaries, and every crossing today is a manual handoff — copy a transcript, paste it into the next interface, re-explain the goal, hope the next model catches the thread.',
    },
    {
      kind: 'paragraph',
      text: 'The Hermitage is my attempt to do that coordination programmatically: a dedicated VM running an Agent Manager UI that dispatches tasks to Claude, Gemini, and local models based on which one is best for the subtask, and a Covenant dashboard that tracks which agent is holding which piece of state.',
    },
    {
      kind: 'paragraph',
      text: 'The interesting technical question is not which model is smartest. It is: how does state — memory, open questions, partial conclusions, sources, corrections — survive a handoff between providers that do not know about each other? Whoever builds that layer cleanly gets to run research jobs the scale of a small lab out of a single laptop.',
    },
    { kind: 'heading', text: 'THREAD 02 — AGENT AUTHENTICATION & SECURITY' },
    {
      kind: 'paragraph',
      text: 'Existing auth was built assuming a human is at the endpoint. OAuth screens, SMS 2FA, click-approve-on-your-phone — the consent ceremony is sized to a single human action. Agents break that in both directions: they need credentials to do useful work, and they need to prove to third parties that they are acting inside a scope the user authorized.',
    },
    {
      kind: 'paragraph',
      text: 'My first startup, LBR, was identity and access work; the agent problems now are the same category one abstraction layer up. I run my personal agents on a Compute Engine VM via Chrome Remote Desktop to sidestep credential delegation — the agent acts through my actual logged-in browser. That is not a solution; it is evidence the tooling is bad enough that operating a remote desktop is the least-bad option.',
    },
    {
      kind: 'paragraph',
      text: 'Watching for: scoped, revocable, time-bounded credentials built for agents — tokens that say "this agent can read my Gmail for the next 4 hours, cannot send, cannot delete, and emits an audit trail." That primitive does not exist yet, and it unlocks agent-to-agent delegation, marketplaces, and third-party integrations without collapsing into trust bankruptcy the first time an agent gets prompt-injected.',
    },
    { kind: 'heading', text: 'THREAD 03 — UX DEVELOPMENT WITH AI' },
    {
      kind: 'paragraph',
      text: 'Most AI UX today is a chat box wrapped around a model. That is not design; it is exposure. Real design shows up in the moments the chat box handles badly: when the model is uncertain and does not say so, when the user wants to interrupt and there is no way, when the answer is partially right and there is no tool for correction, when trust is violated and there is no recovery path.',
    },
    {
      kind: 'paragraph',
      text: 'Trust calibration is the through-line — the UX problem I kept hitting at Manatt. Lawyers needed document-AI outputs to be useful and distrustable in the right proportion. Too confident, and they stopped reading critically; too hedged, and they stopped using it. The interface has to carry signals the model itself does not know how to emit.',
    },
    {
      kind: 'paragraph',
      text: 'The interactive layer on the home page pokes at an adjacent shape: what if the narrative context for AI-generated content were spatial? What if the reader could walk around inside the essay instead of scrolling past it? Not a claim these are the answer — a claim that the chat-box default deserves actual competition.',
    },
    { kind: 'heading', text: 'THREAD 04 — MATERIALS SCIENCE & MOLECULAR DYNAMICS' },
    {
      kind: 'paragraph',
      text: 'Current build: glimPSE — a WebGPU-powered web app for LAMMPS molecular dynamics visualization. Drag a dump file into the browser, first frame renders in under two seconds, rotate around millions of atoms at 60fps, export a 4K publication image or an MP4 without installing anything. The field today is OVITO (desktop, paid-per-seat), VMD (1990s-era UI that can explode to 220GB of RAM on a 4GB trajectory), and 50-line matplotlib scripts that only produce 2D plots. Nobody else has built a WebGPU-native molecular visualization tool for materials science.',
    },
    {
      kind: 'paragraph',
      text: 'glimPSE is the wedge for glim — a longer-horizon open-source platform meant to unify DFT (VASP-compatible plane-wave PAW), classical and reactive molecular dynamics (LAMMPS-compatible), and an ML interatomic potential pipeline into one stack. Current research tooling is a chain of specialized command-line programs with incompatible file formats, duplicated UIs, and paywalls at the quality-matters boundary — the same coordination-layer meta-problem as thread 01.',
    },
    {
      kind: 'paragraph',
      text: 'The materials-science coordination loop is tangible: a DFT simulation produces training data for an ML potential, which enables a much larger MD simulation, which reveals a structural motif worth refining with more DFT. Nothing in that loop has to be hand-wired by a grad student, and nothing about visualization has to cost per-seat per-year.',
    },
    {
      kind: 'item',
      text: 'Live at lupine.science; code, product plan, and research notes public at github.com/alexwelcing/lupine.',
      meta: 'glimPSE / glim',
    },
  ],
}

export const PITCH_PANEL: OperatorPanel = {
  id: 'pitch',
  title: 'TRANSMISSION: THE PITCH',
  blocks: [
    { kind: 'heading', text: 'STATUS: OPEN TO THE NEXT THING' },
    {
      kind: 'paragraph',
      text: 'AI product and engineering, shipped behind evals. A working surface, not a deck — built with the same primitives the AI infra world ships on: retrieval, traces, telemetry, and the patience to put a real eval gate in front of them.',
    },
    { kind: 'heading', text: 'FOUR PILLARS' },
    {
      kind: 'item',
      text: 'Reproducible eval suites, regression gates, and the discipline to ship behind them.',
      meta: 'Evals & quality',
    },
    {
      kind: 'item',
      text: 'Vector search, chunking, recall metrics — the parts of LLM systems that quietly decide outcomes.',
      meta: 'Retrieval & RAG',
    },
    {
      kind: 'item',
      text: 'Tracing, telemetry, and the feedback loops that turn model behavior into product signal.',
      meta: 'Observability',
    },
    {
      kind: 'item',
      text: 'Translating fuzzy AI capability into roadmaps, runbooks, and risks a team can actually decide on.',
      meta: 'Product judgment',
    },
    { kind: 'heading', text: 'LIVE ON THIS SITE' },
    {
      kind: 'item',
      text: 'A deep essay archive with semantic search and article-aware answer surfaces.',
      meta: 'Explore the archive — /articles',
    },
    {
      kind: 'item',
      text: 'OpenAI embeddings + Supabase pgvector across 300+ articles, with streaming answers.',
      meta: 'Semantic search this site — /articles',
    },
    {
      kind: 'item',
      text: 'React Three Fiber, physics, post-processing — a real-time UI surface, not a screenshot.',
      meta: 'Step into the 3D scene — /',
    },
    { kind: 'heading', text: 'CLOSING SIGNAL' },
    {
      kind: 'paragraph',
      text: "Building something where evals and retrieval matter? I'd rather sit with your roadmap for an hour than send a deck. If you're hiring for AI product, applied AI, evals, or platform work — let's talk.",
    },
    {
      kind: 'item',
      text: 'alexwelcing@gmail.com · linkedin.com/in/alexwelcing · github.com/alexwelcing',
      meta: 'Contact',
    },
  ],
}

export const OPERATOR_PANELS: Record<'about' | 'work' | 'pitch', OperatorPanel> = {
  about: ABOUT_PANEL,
  work: WORK_PANEL,
  pitch: PITCH_PANEL,
}
