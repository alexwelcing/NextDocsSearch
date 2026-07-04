// Keyboard routing for the active dock tab. Handler returns true to consume the event.

import { useEffect, useRef } from 'react'

export function useTabKeys(active: boolean, handler: (e: KeyboardEvent) => boolean | void): void {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!active) return
    const on = (e: KeyboardEvent) => {
      if (ref.current(e)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [active])
}
