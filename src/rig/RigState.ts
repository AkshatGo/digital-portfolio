/**
 * The rig state singleton.
 *
 * WHY A MODULE SINGLETON: the master timeline (GSAP) mutates these numbers and
 * the scene reads them inside `useFrame`. Routing them through React state or
 * zustand would re-render the tree 60×/s. `progress` is the only value that is
 * mirrored into the store, and only at 10 Hz (§2 rule 3).
 */
export interface RigState {
  /** raw scroll progress 0..1, written by ScrollTrigger */
  progress: number
  /** |scroll delta| normalised + smoothed over 300 ms → shader uWind */
  wind: number
  /** measured scroll velocity in progress/second (diagnostics) */
  scrollVel: number
  /** seconds since boot, written once per frame for shader uTime */
  time: number

  /* ---- timeline-driven camera proxies ---- */
  /** 0..1 position along the authored spline (piecewise, hits keyframes exactly) */
  posT: number
  /** current look-at target, tweened between act targets */
  look: { x: number; y: number; z: number }
  fov: number

  /* ---- Act 2 metamorphosis ---- */
  hinge: number // 0 closed → 1 cover flipped 180° about the spine
  pages: number // page fan amount 0..1
  glowPages: number
  notebookScale: number
  notebookFade: number
  roomRise: number // room scale-in 0..1 (crossfade partner of notebookFade)
  wallsRise: number // wall y-scale 0..1 with per-wall stagger
  neon: number // shader reveal of the floor strip
  flash: number // bloom spike that masks the crossfade

  /* ---- later acts ---- */
  deskGlow: number
  boardReveal: number
  flyIn: number
  bookReveal: number
  night: number

  /* ---- ambient ---- */
  parallaxYaw: number
  parallaxPitch: number
}

export const rig: RigState = {
  progress: 0,
  wind: 0,
  scrollVel: 0,
  time: 0,

  posT: 0,
  look: { x: 0, y: 0.8, z: 0 },
  fov: 50,

  hinge: 0,
  pages: 0,
  glowPages: 0,
  notebookScale: 1,
  notebookFade: 1,
  roomRise: 0,
  wallsRise: 0,
  neon: 0,
  flash: 0,

  deskGlow: 0,
  boardReveal: 0,
  flyIn: 0,
  bookReveal: 0,
  night: 0,

  parallaxYaw: 0,
  parallaxPitch: 0,
}

/** Reset to authored defaults (used when the static fallback takes over). */
export function resetRig(): void {
  rig.progress = 0
  rig.posT = 0
  rig.fov = 50
  rig.look.x = 0
  rig.look.y = 0.8
  rig.look.z = 0
  rig.hinge = 0
  rig.pages = 0
  rig.glowPages = 0
  rig.notebookScale = 1
  rig.notebookFade = 1
  rig.roomRise = 0
  rig.wallsRise = 0
  rig.neon = 0
  rig.flash = 0
  rig.deskGlow = 0
  rig.boardReveal = 0
  rig.flyIn = 0
  rig.bookReveal = 0
  rig.night = 0
  rig.parallaxYaw = 0
  rig.parallaxPitch = 0
  rig.wind = 0
}

/** Shared GLSL uniforms, written once per frame by ScrollRig. */
export const uWind = { value: 0 }
export const uTime = { value: 0 }
export const uScroll = { value: 0 }
