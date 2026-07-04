// Compatibility mode for browsers without WebGPU: a CRT-styled banner over the page's
// server-rendered content, which stays fully visible and readable (this is also what
// non-rendering crawlers experience — the whole SEO surface).

export function TerminalFallback() {
  return (
    <div className="arc-fallback-banner" role="note">
      <div className="arc-fallback-banner__title">ARC TERMINAL — COMPATIBILITY MODE</div>
      <div className="arc-fallback-banner__body">
        The immersive 360 archive requires WebGPU (Chrome, Edge, or Safari 26+). You are reading
        the flat feed below — every record is here, just without the room around it.
      </div>
    </div>
  )
}
