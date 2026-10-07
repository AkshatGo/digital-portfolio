import { useEffect } from 'react'
import { useStore } from '../store/useStore'

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    )
  } catch {
    return false
  }
}

/**
 * §8 fallbacks: prefers-reduced-motion, missing WebGL and mobile low-tier all
 * route to the static DOM story. The runtime frame-time floor in ScrollRig can
 * also drop the user there later; the choice is always reversible from the HUD.
 */
export function useModeBootstrap(): void {
  useEffect(() => {
    const store = useStore.getState()
    if (store.mode === '2d') return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      store.setMode('2d', 'reduced-motion')
      return
    }
    if (!supportsWebGL()) {
      store.setMode('2d', 'no-webgl')
      return
    }

    const cores = navigator.hardwareConcurrency ?? 8
    const smallScreen = window.matchMedia('(max-width: 820px)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (smallScreen && coarse && cores <= 4) {
      store.setMode('2d', 'low-tier')
      return
    }

    if (cores <= 4) store.setQuality('mid')
  }, [])
}
