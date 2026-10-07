import { clamp01 } from '../art/palette'

export type ActId = 'valley' | 'metamorphosis' | 'desk' | 'board' | 'library' | 'outro'

export interface ActWindow {
  id: ActId
  title: string
  /** inclusive start progress */
  start: number
  /** exclusive end progress (last act uses 1.0) */
  end: number
  /** label(s) on the master timeline for this act */
  segment: string
}

/** Master scroll timeline (§3). Windows are the single source of truth. */
export const ACTS: ActWindow[] = [
  { id: 'valley', title: 'The Valley', start: 0.0, end: 0.18, segment: 'valley' },
  { id: 'metamorphosis', title: 'Metamorphosis', start: 0.18, end: 0.38, segment: 'open · unfold' },
  { id: 'desk', title: 'The Desk', start: 0.38, end: 0.55, segment: 'desk' },
  { id: 'board', title: 'The Soft Board', start: 0.55, end: 0.72, segment: 'board · flyin' },
  { id: 'library', title: 'The Library', start: 0.72, end: 0.88, segment: 'library · book' },
  { id: 'outro', title: 'Night Outro', start: 0.88, end: 1.0001, segment: 'outro' },
]

/** Named labels write straight onto the master timeline (§3). */
export const LABELS = {
  valley: 0.0,
  open: 0.18,
  unfold: 0.3,
  desk: 0.38,
  board: 0.55,
  flyin: 0.62,
  library: 0.72,
  book: 0.8,
  outro: 0.88,
} as const

export function actAt(progress: number): ActWindow {
  const p = clamp01(progress)
  for (const act of ACTS) {
    if (p < act.end) return act
  }
  return ACTS[ACTS.length - 1]
}

/**
 * Manual culling windows for act groups (§10: act groups visible=false when
 * >0.15 (of window length) progress outside their window).
 */
export const VIEW_WINDOWS = {
  valley: [0.0, 0.3] as const,
  room: [0.29, 1.01] as const,
  desk: [0.35, 0.6] as const,
  board: [0.52, 0.76] as const,
  library: [0.69, 0.92] as const,
  night: [0.83, 1.01] as const,
  notebook: [0.0, 0.34] as const,
} as const

/** True when progress is inside [start,end] inflated by `margin` × window length. */
export function inWindow(
  progress: number,
  window: readonly [number, number],
  margin = 0.15,
): boolean {
  const [start, end] = window
  const pad = (end - start) * margin
  return progress >= start - pad && progress <= end + pad
}

/** 0..1 ramp inside a window with soft edges — used for act-local reveals. */
export function windowRamp(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / (end - start))
}
