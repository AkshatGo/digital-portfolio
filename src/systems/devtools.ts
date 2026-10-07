import type { WebGLRenderer } from 'three'
import { rig } from '../rig/RigState'
import { useStore } from '../store/useStore'
import { ACTS, actAt } from '../rig/acts'

export interface NotebookValleyDevtools {
  info: WebGLRenderer['info']
  rig: typeof rig
  store: () => ReturnType<typeof useStore.getState>
  fps: () => number
  act: () => string
  /** jump the document scroll to a progress value (QA helper) */
  scrubTo: (p: number) => void
  /** post-processing on/off — needed to read true scene draw calls */
  setEffects: (on: boolean) => void
  budgets: () => { drawCalls: number; triangles: number; programs: number }
}

declare global {
  interface Window {
    __NV__?: NotebookValleyDevtools
  }
}

/**
 * §10 budget auditing: with `?dev=1` the renderer counters and rig state are
 * published on `window.__NV__` so a headless audit (or a spector snapshot) can
 * read draw calls / triangles / programs per act without instrumenting the app.
 */
export function exposeDevtools(gl: WebGLRenderer): void {
  if (typeof window === 'undefined') return
  if (!new URLSearchParams(window.location.search).has('dev')) return

  window.__NV__ = {
    info: gl.info,
    rig,
    store: () => useStore.getState(),
    fps: () => useStore.getState().fps,
    act: () => actAt(rig.progress).id,
    scrubTo: (p: number) => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo(0, Math.max(0, Math.min(1, p)) * max)
    },
    setEffects: (on: boolean) => useStore.getState().setEffects(on),
    budgets: () => ({
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      programs: gl.info.programs?.length ?? 0,
    }),
  }

  // handy in the console: list the authored act windows
  Object.defineProperty(window.__NV__, 'acts', { get: () => ACTS, configurable: true })
}
