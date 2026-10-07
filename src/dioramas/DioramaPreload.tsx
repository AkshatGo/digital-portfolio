import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { preloadDioramas } from './registry'

/**
 * §10: "Acts 3–6 streamed during Act 2" — the diorama modules are fetched at the
 * end of Act 2 as well, so the first note click in Act 4 is offline-fast. Reads
 * the 10 Hz progress mirror, so it never runs per frame.
 */
export function DioramaPreload({ at = 0.34 }: { at?: number }) {
  const progress = useStore((s) => s.progress)
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current || progress < at) return
    fired.current = true
    preloadDioramas()
  }, [progress, at])

  return null
}
