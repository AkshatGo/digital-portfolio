import gsap from 'gsap'
import { KEYFRAMES } from './cameraPath'
import { LABELS } from './acts'
import type { RigState } from './RigState'

export interface MasterTimeline {
  /** paused GSAP timeline, total duration normalised to 1 */
  tl: gsap.core.Timeline
  duration: number
}

/**
 * §3 master scroll timeline.
 *
 * Everything that moves in the scene is a tween on the `rig` proxy object, so
 * scrubbing is perfectly reversible at any speed: we never call .play(), we
 * only ever set `.time()`. Because the timeline is paused and scrubbed, GSAP
 * evaluates eases (including back.out) in both directions — no one-shot tweens.
 */
export function buildMasterTimeline(rig: RigState): MasterTimeline {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })

  /* -- camera: one non-overlapping piecewise tween per keyframe span ------- */
  for (let i = 1; i < KEYFRAMES.length; i++) {
    const from = KEYFRAMES[i - 1].p
    const to = KEYFRAMES[i].p
    const k = KEYFRAMES[i]
    const segmentEase = i === 4 || i === 6 ? 'power1.inOut' : 'none' // settle + rise
    tl.to(rig, { posT: i / (KEYFRAMES.length - 1), duration: to - from, ease: segmentEase }, from)
    tl.to(
      rig.look,
      { x: k.look[0], y: k.look[1], z: k.look[2], duration: to - from, ease: segmentEase },
      from,
    )
  }

  /* -- labels (§3) -------------------------------------------------------- */
  for (const [name, at] of Object.entries(LABELS)) tl.addLabel(name, at)

  /* -- Act 1 · valley: slow push-in, quiet camera ------------------------ */
  tl.to(rig, { fov: 50, duration: 0.18 }, 0)

  /* -- Act 2 · metamorphosis (critical) ---------------------------------- */
  tl
    // 1. cover hinges 180° about the spine, pages fan 3° each
    .to(rig, { hinge: 1, duration: 0.08, ease: 'back.out(1.2)' }, LABELS.open)
    .to(rig, { pages: 1, duration: 0.1, ease: 'power2.out' }, 0.2)
    .to(rig, { glowPages: 1, duration: 0.05 }, 0.26)
    // 2. open notebook scales ×1.6 toward camera, glow rises
    .to(rig, { notebookScale: 1.6, duration: 0.04, ease: 'power2.in' }, 0.26)
    // 3. the illusion: room fades/scales in exactly as the notebook scales out
    .to(rig, { roomRise: 1, duration: 0.03, ease: 'power2.out' }, 0.3)
    .to(rig, { notebookFade: 0, duration: 0.02, ease: 'power2.out' }, 0.3)
    .to(rig, { flash: 1, duration: 0.02 }, 0.29)
    .to(rig, { flash: 0, duration: 0.04, ease: 'power2.out' }, 0.31)
    // 4. walls rise, neon floor strip draws on
    .to(rig, { wallsRise: 1, duration: 0.07, ease: 'power2.out' }, 0.31)
    .to(rig, { neon: 1, duration: 0.07 }, 0.31)
    // tightens FOV as the room settles
    .to(rig, { fov: 46, duration: 0.08 }, 0.3)

  /* -- Act 3 · desk ------------------------------------------------------- */
  tl.to(rig, { deskGlow: 1, duration: 0.06 }, LABELS.desk).to(rig, { fov: 50, duration: 0.1 }, 0.44)

  /* -- Act 4 · soft board ------------------------------------------------- */
  tl.to(rig, { boardReveal: 1, duration: 0.05, ease: 'power2.out' }, LABELS.board).to(
    rig,
    { fov: 42, duration: 0.06, ease: 'power2.inOut' },
    LABELS.flyin,
  )

  /* -- Act 5 · library ---------------------------------------------------- */
  tl.to(rig, { bookReveal: 1, duration: 0.08, ease: 'power2.inOut' }, LABELS.library).to(
    rig,
    { fov: 50, duration: 0.06 },
    0.8,
  )

  /* -- Act 6 · night outro ------------------------------------------------ */
  tl.to(rig, { night: 1, duration: 0.06 }, LABELS.outro).to(rig, { fov: 58, duration: 0.12 }, 0.88)

  // every tween above ends on or before progress 1.0, so the master length is 1
  return { tl, duration: tl.duration() }
}
