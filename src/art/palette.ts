import { Vector3, Color, Quaternion, Euler } from 'three'

/**
 * Palette shared between CSS tokens (src/styles/global.css) and three.js.
 * Never allocate a Color in a frame loop — use these module-level instances.
 */
export const palette = {
  violet: 0x7c5cff,
  coral: 0xff6b6b,
  sun: 0xffd166,
  mint: 0x4ecdc4,
  cream: 0xfff6e5,
  ink: 0x1a1b2e,
} as const

export const colors = {
  violet: new Color(palette.violet),
  coral: new Color(palette.coral),
  sun: new Color(palette.sun),
  mint: new Color(palette.mint),
  cream: new Color(palette.cream),
  ink: new Color(palette.ink),
} as const

/**
 * Pooled scratch values. Reuse inside useFrame only — never store a reference
 * across frames, never allocate in the render loop.
 */
export const scratch = {
  v1: new Vector3(),
  v2: new Vector3(),
  v3: new Vector3(),
  v4: new Vector3(),
  look: new Vector3(),
  q1: new Quaternion(),
  e1: new Euler(),
}

export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Frame-rate independent exponential damping factor. */
export function dampFactor(delta: number, smoothing: number): number {
  return 1 - Math.exp(-delta / smoothing)
}

/** Deterministic PRNG so grey-box art is stable between reloads. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
