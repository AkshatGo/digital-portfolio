import { Suspense, lazy, useRef } from 'react'
import { useStore } from '../store/useStore'

/* §10: Acts 3–6 stream during Act 2 so the initial payload only carries the rig,
   Act 1 and the metamorphosis. */
const Act3Desk = lazy(() =>
  import('../acts/Act3Desk').then((m) => ({ default: m.Act3Desk })),
)
const Act4Board = lazy(() =>
  import('../acts/Act4Board').then((m) => ({ default: m.Act4Board })),
)
const Act5Library = lazy(() =>
  import('../acts/Act5Library').then((m) => ({ default: m.Act5Library })),
)
const Act6Night = lazy(() => import('../acts/Act6Night').then((m) => ({ default: m.Act6Night })))

/** Armed once the metamorphosis begins; never unmounts afterwards. */
export function StreamedActs() {
  const progress = useStore((s) => s.progress)
  const armed = useRef(false)
  if (progress > 0.22) armed.current = true

  if (!armed.current) return null

  return (
    <Suspense fallback={null}>
      <Act3Desk />
      <Act4Board />
      <Act5Library />
      <Act6Night />
    </Suspense>
  )
}
