import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { rig } from './RigState'
import { useStore } from '../store/useStore'

gsap.registerPlugin(ScrollTrigger)

/** Element id of the tall empty div that supplies document height (§2 rule 1). */
export const SCROLL_BODY_ID = 'scroll-length'

/**
 * §2: the DOM scroll body drives progress; the canvas never listens to wheel
 * events itself. Progress is written straight into the rig singleton, and
 * mirrored into the store (for DOM overlays) at 10 Hz — never from useFrame.
 */
export function useScrollTracking(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const el = document.getElementById(SCROLL_BODY_ID)
    if (!el) return

    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    rig.progress = 0

    let lastMirror = 0
    const mirror = (progress: number, force = false) => {
      const now = performance.now()
      if (!force && now - lastMirror < 100) return
      lastMirror = now
      useStore.getState().setProgress(progress)
    }

    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        rig.progress = self.progress
        mirror(self.progress)
      },
      onRefresh: (self) => {
        rig.progress = self.progress
        mirror(self.progress, true)
      },
    })

    // ScrollTrigger measures after layout settles (fonts, canvas mount)
    const raf = requestAnimationFrame(() => {
      ScrollTrigger.refresh()
      // QA hook: ?p=0.62 loads the page parked inside a given act
      const forced = new URLSearchParams(window.location.search).get('p')
      if (forced !== null) {
        const value = Number.parseFloat(forced)
        if (Number.isFinite(value)) {
          const max = document.documentElement.scrollHeight - window.innerHeight
          window.scrollTo(0, Math.min(1, Math.max(0, value)) * max)
        }
      }
    })

    return () => {
      cancelAnimationFrame(raf)
      st.kill()
      mirror(rig.progress, true)
    }
  }, [enabled])
}
