// Recovery screen for a mid-session GPU device loss (driver reset, OOM, tab backgrounded on
// mobile long enough for the OS to reclaim the GPU). WebGPURenderer.onDeviceLost fires this —
// see ImmersiveCanvas's gl factory. A fresh device requires a fresh renderer, and the simplest
// reliable way to get one in this architecture is a full reload.

export function DeviceLostScreen() {
  return (
    <div className="arc-boot" role="alertdialog" aria-live="assertive">
      <div className="arc-boot__inner">
        <div className="arc-boot__line">CONNECTION TO GRAPHICS DEVICE LOST</div>
        <div className="arc-boot__line">{' '}</div>
        <div className="arc-boot__line">POSSIBLE CAUSES: DRIVER RESET · GPU RECLAIMED · OUT OF MEMORY</div>
        <div className="arc-boot__line">{' '}</div>
        <button className="arc-lost__button" onClick={() => window.location.reload()}>
          ↻ RECONNECT
        </button>
      </div>
      <div className="arc-crt-overlay" aria-hidden />
    </div>
  )
}
