// Hidden DOM input for in-scene text fields. Desktop keystrokes are still captured on window by
// each surface; this element exists so a tap can focus a real <input> and the OS keyboard opens.
// While it has focus the native field owns editing (paste, composition, autocorrect) and every
// edit flows back through onChange — surfaces skip their own character handling for events the
// field `owns`, and ignore keys typed into another surface's field (`isTouchTextTarget`).

import { useCallback, useEffect, useRef, type RefObject } from 'react'

export interface TouchTextInputOptions {
  /** The element exists only while the field can take input. */
  active: boolean
  /** Current text; pushed into the element so window-captured edits stay in sync. */
  value: string
  /** Receives every native edit, already sanitized and bounded to maxLength. */
  onChange: (value: string) => void
  /** Accessible name for the field. */
  label: string
  maxLength: number
  type?: 'search' | 'text'
  /** Normalizes native edits (charset, case) before they reach onChange. */
  sanitize?: (value: string) => string
  autoCapitalize?: 'off' | 'characters' | 'words' | 'sentences'
  /** Label for the OS keyboard's action key. */
  enterKeyHint?: 'done' | 'go' | 'search' | 'send'
}

export interface TouchTextInput {
  /** The mounted element while active, else null. */
  inputRef: RefObject<HTMLInputElement | null>
  /** Focus the field — call from a pointer handler so touch OSes open their keyboard. */
  focus: () => void
  /** True when an event came from the hidden field, i.e. the native input owns that edit. */
  owns: (e: Event) => boolean
}

/** Upper bound on a tap's pointerdown → click span; the focus guard never outlives it. */
const GESTURE_MS = 1000

const HIDDEN =
  'position:fixed;opacity:0;pointer-events:none;left:50%;bottom:0;height:1px;width:1px;'

/** Marks every surface's hidden field, so one surface can skip keys typed into another's. */
const FIELD_ATTR = 'data-touch-text-input'

/** True when an event came from any surface's hidden field — that field's owner handles it. */
export function isTouchTextTarget(e: Event): boolean {
  return e.target instanceof Element && e.target.hasAttribute(FIELD_ATTR)
}

export function useTouchTextInput({
  active,
  value,
  onChange,
  label,
  maxLength,
  type = 'text',
  sanitize,
  autoCapitalize = 'off',
  enterKeyHint,
}: TouchTextInputOptions): TouchTextInput {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const sanitizeRef = useRef(sanitize)
  sanitizeRef.current = sanitize
  const composing = useRef(false)

  useEffect(() => {
    if (!active) return
    const el = document.createElement('input')
    el.type = type
    el.maxLength = maxLength
    el.setAttribute('aria-label', label)
    el.setAttribute('autocapitalize', autoCapitalize)
    el.setAttribute('autocomplete', 'off')
    el.setAttribute('autocorrect', 'off')
    el.setAttribute('spellcheck', 'false')
    if (enterKeyHint) el.setAttribute('enterkeyhint', enterKeyHint)
    el.setAttribute(FIELD_ATTR, '')
    el.style.cssText = HIDDEN
    // Mid-composition (IME, Android word suggestions) the keyboard owns el.value — writing it
    // garbles or duplicates text on Gboard/Samsung — so report the cleaned text as it is typed
    // and write it back only once the composition settles.
    const commit = () => {
      const clean = sanitizeRef.current ? sanitizeRef.current(el.value) : el.value
      const next = clean.slice(0, maxLength)
      if (!composing.current && el.value !== next) el.value = next
      onChangeRef.current(next)
    }
    el.addEventListener('compositionstart', () => {
      composing.current = true
    })
    el.addEventListener('compositionend', () => {
      composing.current = false
      commit()
    })
    el.addEventListener('input', commit)
    document.body.appendChild(el)
    inputRef.current = el
    return () => {
      composing.current = false
      el.remove()
      inputRef.current = null
    }
  }, [active, type, label, maxLength, autoCapitalize, enterKeyHint])

  useEffect(() => {
    const el = inputRef.current
    if (el && !composing.current && el.value !== value) el.value = value
  }, [value, active])

  const focus = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    // The gesture that asked for focus still owes the page a compatibility mousedown on the
    // canvas, whose default action moves focus straight back off the field. R3F's pointer
    // listeners are passive, so the pointerdown can't be canceled; cancel that mousedown instead.
    const keep = (e: MouseEvent) => e.preventDefault()
    const done = () => {
      window.removeEventListener('mousedown', keep, true)
      window.removeEventListener('click', done, true)
    }
    window.addEventListener('mousedown', keep, true)
    window.addEventListener('click', done, true)
    setTimeout(done, GESTURE_MS)
  }, [])
  const owns = useCallback(
    (e: Event) => inputRef.current !== null && e.target === inputRef.current,
    []
  )
  return { inputRef, focus, owns }
}
