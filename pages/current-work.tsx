// Current work: crawlable HTML for the four active research threads.

import Head from 'next/head'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site-url'

export default function CurrentWorkPage() {
  const url = `${SITE_URL}/current-work`
  const title = 'Work — Alex Welcing'
  const description =
    'Four research areas: coordination across model providers, agent authentication and security, UX development with AI, and materials science and molecular dynamics.'
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={`${SITE_URL}/social-preview.png`} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <main className="arc-feed">
        <nav aria-label="Breadcrumb">
          <Link href="/">Alex Welcing</Link> / Work
        </nav>
        <header>
          <h1>Work</h1>
          <p>
            Four threads, one shared premise: the interesting problems in AI right now aren&apos;t
            inside the model — they&apos;re in the coordination layer around it. Between providers.
            Between the agent and the person authorizing it. Between the model&apos;s confidence
            and the human&apos;s trust. Between the simulation and the experiment. The gap between
            what a model can do and what it can do <em>for you</em> is where I spend my time.
          </p>
        </header>
        <section>
          <h2>Coordination across model providers for long-running research</h2>
          <p>
            No single model provider runs a 48-hour research job well. Claude has the reasoning,
            Gemini has the context window, local models have the rate-limit headroom, a specialized
            model has the domain knowledge. The actual research workflow inevitably crosses
            provider boundaries, and every crossing today is a manual handoff — copy a transcript,
            paste it into the next interface, re-explain the goal, hope the next model catches the
            thread.
          </p>
          <p>
            My research work at Lupine Science is done with AI coding and research agents under
            rules that live in code. What those rules cover, and where the data goes, is written up
            in{' '}
            <a href="https://github.com/alexwelcing/lupine-rhizo/blob/main/docs/ai-and-data.md">
              How we use AI agents and handle data
            </a>
            .
          </p>
          <p>
            The interesting technical question isn&apos;t &ldquo;which model is smartest.&rdquo;
            It&apos;s: how does state — memory, open questions, partial conclusions, sources,
            corrections — survive a handoff between providers that don&apos;t know about each
            other? Whoever builds that layer cleanly gets to run research jobs the scale of a small
            lab out of a single laptop.
          </p>
        </section>
        <section>
          <h2>User and agent authentication and security</h2>
          <p>
            Existing auth was built assuming a human is at the endpoint. OAuth screens, SMS 2FA,
            &ldquo;click approve on your phone&rdquo; — the consent ceremony is sized to match a
            single human action. Agents break that in both directions: they need credentials to do
            useful work, and they need to prove to third parties that they&apos;re acting inside a
            scope the user authorized.
          </p>
          <p>
            My first startup, LBR, was identity and access work. The problems I hit with agents now
            are the same category, one abstraction layer up.
          </p>
          <p>
            What I&apos;m watching for: scoped, revocable, time-bounded credentials built for
            agents instead of humans. Tokens that say &ldquo;this agent can read my Gmail for the
            next 4 hours, cannot send, cannot delete, and emits an audit trail I can review.&rdquo;
            That primitive doesn&apos;t exist yet, and it&apos;s the thing that unlocks everything
            downstream — agent-to-agent delegation, marketplaces, third-party agent integrations —
            without the whole system collapsing into a trust bankruptcy the first time an agent
            gets prompt-injected.
          </p>
        </section>
        <section>
          <h2>UX development with AI</h2>
          <p>
            Most AI UX today is a chat box wrapped around a model. That&apos;s not design;
            it&apos;s exposure. Real design shows up in the moments the chat box handles badly:
            when the model is uncertain and doesn&apos;t say so, when the user wants to interrupt
            and there&apos;s no way, when the answer is partially right and the interface offers no
            tool for correction, when trust is violated and there&apos;s no recovery path.
          </p>
          <p>
            Trust calibration is the through-line. I wrote about it in{' '}
            <Link href="/articles/trust-calibration-ai-ux">trust-calibration-ai-ux</Link> because
            it&apos;s the UX problem I kept hitting at Manatt — lawyers needed document-AI outputs
            to be <em>useful</em> and <em>distrustable in the right proportion</em>. Too confident,
            and they stopped reading critically; too hedged, and they stopped using it. The
            interface has to carry signals the model itself doesn&apos;t know how to emit.
          </p>
          <p>
            The <Link href="/">immersive layer on this site</Link> is me poking at an adjacent
            shape: what if the narrative context for AI-generated content were spatial? What if the
            reader could walk around inside the essay instead of scrolling past it? Not a claim
            these are the answer — a claim that the chat-box default deserves actual competition.
          </p>
        </section>
        <section>
          <h2>Materials science and molecular dynamics</h2>
          <p>
            I founded <a href="https://lupine.science">Lupine Science</a>, an early-stage research
            company. Lupine Science measures where machine-learned models of atoms go wrong,
            against published references and pass/fail gates set in advance, and publishes every
            verdict, failures included. Nothing it has published is peer-reviewed yet.
          </p>
          <p>
            The browser viewer I described here as glimPSE is now{' '}
            <a href="https://lupi.live">LUPI</a>: it opens structures and LAMMPS dump files in a
            WebGPU-capable browser with no installation. The usual alternatives are OVITO (desktop,
            paid-per-seat for the features researchers actually need for papers), VMD (a
            1990s-era desktop UI), and 50-line matplotlib scripts that only produce 2D plots.
          </p>
          <p>
            <strong>glim</strong> is a longer-horizon open-source platform
            meant to unify DFT (VASP-compatible plane-wave PAW), classical and reactive molecular
            dynamics (LAMMPS-compatible), and an ML interatomic potential pipeline into one stack.
            The current research tooling landscape is a chain of specialized command-line programs
            with incompatible file formats, duplicated UIs, and paywalls at the quality-matters
            boundary. It&apos;s the same meta-problem from the first section: the capability
            already exists; the coordination layer around it is missing.
          </p>
          <p>
            The materials-science version of the coordination problem is especially tangible — a
            DFT simulation produces training data for an ML potential, which enables a much larger
            MD simulation, which reveals a structural motif worth refining with more DFT. Nothing
            about that loop has to be hand-wired by a grad student, and nothing about the
            visualization layer has to cost per-seat per-year. Lupine Science&apos;s program
            record, code and evidence are public in the{' '}
            <a href="https://github.com/alexwelcing/lupine">lupine repo</a>.
          </p>
        </section>
        <section>
          <h2>Connect</h2>
          <p>
            Interested in any of these threads? Reach me at{' '}
            <a href="mailto:alexwelcing@gmail.com">alexwelcing@gmail.com</a>, on{' '}
            <a href="https://www.linkedin.com/in/alexwelcing">LinkedIn</a>, or{' '}
            <a href="https://github.com/alexwelcing">GitHub</a>. Or browse the{' '}
            <Link href="/articles">archive of essays and fiction</Link>.
          </p>
        </section>
      </main>
    </>
  )
}
