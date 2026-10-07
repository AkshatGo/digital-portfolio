import { CatmullRomCurve3, Vector3 } from 'three'

export interface CameraKeyframe {
  /** act label for readability */
  label: string
  /** scroll progress at which this keyframe is hit exactly */
  p: number
  pos: [number, number, number]
  look: [number, number, number]
}

/**
 * §4 camera choreography — 11 authored keyframes, room 8×8 m, y-up.
 * Keyframe 5 (fly-in) is repositioned at runtime by Act 4 via setKeyframePosition().
 */
export const KEYFRAMES: CameraKeyframe[] = [
  { label: 'enter', p: 0.0, pos: [0, 1.2, -6.5], look: [0, 0.8, 0] },
  { label: 'crane', p: 0.3, pos: [0, 3.5, -3.0], look: [0, 1.2, 0] },
  { label: 'desk-approach', p: 0.4, pos: [2.2, 1.6, -1.2], look: [2.6, 1.3, 0.6] },
  { label: 'desk-settle', p: 0.52, pos: [2.6, 1.5, -0.6], look: [2.6, 1.3, 0.6] },
  { label: 'board', p: 0.58, pos: [0.4, 1.6, -1.6], look: [0, 1.7, 3.9] },
  { label: 'flyin', p: 0.64, pos: [-0.6, 1.7, 3.2], look: [-1.1, 1.7, 3.6] },
  { label: 'library', p: 0.74, pos: [-2.4, 1.7, -1.0], look: [-3.6, 1.4, 0.4] },
  { label: 'book', p: 0.82, pos: [-1.4, 1.8, -1.8], look: [-1.4, 1.8, -1.0] },
  { label: 'rise', p: 0.88, pos: [0, 3.2, -2.2], look: [0, 1.2, 0] },
  { label: 'exit', p: 0.94, pos: [0, 7.0, -6.0], look: [0, 0.8, 0] },
  { label: 'end', p: 1.0, pos: [0, 9.5, -9.0], look: [0, 12, -2] },
]

const points = KEYFRAMES.map((k) => new Vector3(...k.pos))

/** centripetal parameterisation keeps the spline free of cusps/loops */
export const cameraCurve = new CatmullRomCurve3(points, false, 'centripetal', 0.5)

/**
 * Sample the spline. CatmullRomCurve3.getPoint maps t uniformly across segments
 * and returns control point i exactly at t = i / (n − 1), which is precisely
 * what the master timeline tweens posT to (piecewise, non-overlapping spans).
 */
export function sampleCameraPos(posT: number, out: Vector3): Vector3 {
  const t = posT <= 0 ? 0 : posT >= 1 ? 1 : posT
  return cameraCurve.getPoint(t, out)
}

/** Act 4 flies the camera at a real note position: move keyframe 5 in place. */
export function setKeyframePosition(index: number, x: number, y: number, z: number): void {
  const point = points[index]
  if (!point) return
  point.set(x, y, z)
  KEYFRAMES[index].pos = [x, y, z]
}

export function setKeyframeLook(index: number, x: number, y: number, z: number): void {
  const k = KEYFRAMES[index]
  if (!k) return
  k.look = [x, y, z]
}
