import { create } from 'zustand'
import { ACTS, actAt, type ActWindow } from '../rig/acts'

export type Quality = 'high' | 'mid' | 'low'
export type Mode = '3d' | '2d'

interface Store {
  /* --- render mode / quality --- */
  mode: Mode
  modeReason: '' | 'reduced-motion' | 'no-webgl' | 'low-tier' | 'user'
  setMode: (mode: Mode, reason?: Store['modeReason']) => void
  quality: Quality
  setQuality: (q: Quality) => void
  /** post-processing switch — the perf escape hatch and the QA measurement lever */
  effects: boolean
  setEffects: (on: boolean) => void
  dpr: number
  setDpr: (dpr: number) => void

  /* --- scroll mirror (throttled to 10 Hz, never written from useFrame) --- */
  progress: number
  act: ActWindow
  setProgress: (progress: number) => void

  /* --- overlays / interactions --- */
  terminalOpen: boolean
  setTerminalOpen: (open: boolean) => void
  wireframe: boolean
  setWireframe: (on: boolean) => void
  hoveredProject: string | null
  setHoveredProject: (id: string | null) => void
  focusedProject: string | null
  setFocusedProject: (id: string | null) => void
  audioOn: boolean
  setAudioOn: (on: boolean) => void

  /* --- perf readout --- */
  fps: number
  setFps: (fps: number) => void
}

export const useStore = create<Store>((set, get) => ({
  mode: '3d',
  modeReason: '',
  setMode: (mode, reason = 'user') => set({ mode, modeReason: reason }),

  quality: 'high',
  setQuality: (quality) => set({ quality }),
  effects: true,
  setEffects: (effects) => set({ effects }),
  dpr: Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1),
  setDpr: (dpr) => set({ dpr }),

  progress: 0,
  act: ACTS[0],
  setProgress: (progress) => {
    const act = actAt(progress)
    // only commit when something a DOM overlay cares about changed
    if (Math.abs(get().progress - progress) < 0.001 && act === get().act) return
    set({ progress, act })
  },

  terminalOpen: false,
  setTerminalOpen: (terminalOpen) => set({ terminalOpen }),
  wireframe: false,
  setWireframe: (wireframe) => set({ wireframe }),
  hoveredProject: null,
  setHoveredProject: (hoveredProject) => set({ hoveredProject }),
  focusedProject: null,
  setFocusedProject: (focusedProject) => set({ focusedProject }),
  audioOn: false,
  setAudioOn: (audioOn) => set({ audioOn }),

  fps: 60,
  setFps: (fps) => set({ fps }),
}))
