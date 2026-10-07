import { BufferAttribute, BufferGeometry } from 'three'
import { makeRng } from './palette'

const TAU = Math.PI * 2

/**
 * §5 Act 1: a low-poly mountain ridge as a single triangle strip ring.
 * Non-indexed so `computeVertexNormals` yields flat per-face normals — the
 * layered silhouette look. Side is DoubleSide on the material.
 */
export function createRidgeGeometry(
  radius: number,
  segments: number,
  minHeight: number,
  maxHeight: number,
  seed: number,
  jitter = 0.14,
): BufferGeometry {
  const rng = makeRng(seed)
  const vertices: number[] = []
  const base = -0.8

  const ring = (i: number) => {
    const a = (i / segments) * TAU
    const r = radius * (1 + (rng() - 0.5) * jitter)
    const h = minHeight + rng() * (maxHeight - minHeight)
    return {
      bx: Math.cos(a) * r,
      bz: Math.sin(a) * r,
      tx: Math.cos(a) * r * 0.995,
      tz: Math.sin(a) * r * 0.995,
      h,
    }
  }

  // the ridge shape is generated once, then the ring is closed by wrapping
  const shape: ReturnType<typeof ring>[] = []
  for (let i = 0; i < segments; i++) shape.push(ring(i))

  for (let i = 0; i < segments; i++) {
    const a = shape[i]
    const b = shape[(i + 1) % segments]
    // two faces per span; both wound outward-ish, material is double sided
    vertices.push(a.bx, base, a.bz, a.tx, a.h, a.tz, b.tx, b.h, b.tz)
    vertices.push(a.bx, base, a.bz, b.tx, b.h, b.tz, b.bx, base, b.bz)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
  geometry.computeVertexNormals()
  return geometry
}
