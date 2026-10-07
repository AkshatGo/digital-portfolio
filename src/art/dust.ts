import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  Color,
} from 'three'
import { uTime } from '../rig/RigState'

const CAPACITY = 256
const MAX_LIFE = 0.6

/**
 * §5 Act 2 step 4: furniture drops in with a dust puff — 12 particles per item,
 * 0.6 s life. Fully pooled: `burst()` recycles a ring buffer, `update()` is
 * allocation-free, and asleep particles are discarded in the fragment shader.
 */
export class DustBursts {
  readonly points: Points
  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly life: Float32Array
  private readonly maxLife: Float32Array
  private readonly size: Float32Array
  private readonly velocity: Float32Array
  private readonly seeds: Float32Array
  private cursor = 0
  private readonly rng: () => number

  constructor(seed = 7, color = 0xfff6e5) {
    // deterministic PRNG so bursts look the same on every replay
    let s = seed >>> 0
    this.rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    }

    this.positions = new Float32Array(CAPACITY * 3)
    this.colors = new Float32Array(CAPACITY * 3)
    this.life = new Float32Array(CAPACITY)
    this.maxLife = new Float32Array(CAPACITY).fill(MAX_LIFE)
    this.size = new Float32Array(CAPACITY)
    this.velocity = new Float32Array(CAPACITY * 3)
    this.seeds = new Float32Array(CAPACITY)

    const tint = new Color(color)
    for (let i = 0; i < CAPACITY; i++) {
      this.colors[i * 3] = tint.r
      this.colors[i * 3 + 1] = tint.g
      this.colors[i * 3 + 2] = tint.b
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3))
    geometry.setAttribute('aColor', new BufferAttribute(this.colors, 3))
    geometry.setAttribute('aLife', new BufferAttribute(this.life, 1))
    geometry.setAttribute('aSize', new BufferAttribute(this.size, 1))
    geometry.boundingSphere = null
    geometry.setDrawRange(0, CAPACITY)

    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime },
      vertexShader: /* glsl */ `
        attribute float aLife;
        attribute float aSize;
        attribute vec3 aColor;
        uniform float uTime;
        varying float vLife;
        varying vec3 vColor;
        void main() {
          vLife = aLife;
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * (1.0 + (1.0 - aLife) * 1.6) * (300.0 / max(-mv.z, 0.001));
          if (aLife <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vLife;
        varying vec3 vColor;
        void main() {
          if (vLife <= 0.0) discard;
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor * a * vLife * 0.8, a * vLife * 0.55);
        }
      `,
    })

    this.points = new Points(geometry, material)
    this.points.frustumCulled = false
  }

  /** One-shot burst of `count` particles (default 12) at a world position. */
  burst(x: number, y: number, z: number, count = 12, spread = 0.22, lift = 0.5): void {
    for (let n = 0; n < count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % CAPACITY

      this.positions[i * 3] = x + (this.rng() - 0.5) * spread
      this.positions[i * 3 + 1] = y + this.rng() * 0.05
      this.positions[i * 3 + 2] = z + (this.rng() - 0.5) * spread

      const angle = this.rng() * Math.PI * 2
      const speed = 0.25 + this.rng() * 0.8
      this.velocity[i * 3] = Math.cos(angle) * speed * spread * 2
      this.velocity[i * 3 + 1] = lift * (0.35 + this.rng() * 0.9)
      this.velocity[i * 3 + 2] = Math.sin(angle) * speed * spread * 2

      this.size[i] = 0.5 + this.rng() * 1.4
      this.seeds[i] = this.rng()
      this.maxLife[i] = MAX_LIFE * (0.7 + this.rng() * 0.6)
      this.life[i] = 1
    }
  }

  update(delta: number): void {
    let active = false
    for (let i = 0; i < CAPACITY; i++) {
      const life = this.life[i]
      if (life <= 0) continue
      active = true
      const next = life - delta / this.maxLife[i]
      this.life[i] = next > 0 ? next : 0

      const i3 = i * 3
      this.velocity[i3 + 1] -= 1.1 * delta // gravity
      const drag = 1 - Math.min(1, 1.6 * delta)
      this.velocity[i3] *= drag
      this.velocity[i3 + 1] *= drag
      this.velocity[i3 + 2] *= drag

      this.positions[i3] += this.velocity[i3] * delta
      this.positions[i3 + 1] += this.velocity[i3 + 1] * delta
      this.positions[i3 + 2] += this.velocity[i3 + 2] * delta
    }

    if (!active) return
    const geometry = this.points.geometry
    ;(geometry.getAttribute('position') as BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('aLife') as BufferAttribute).needsUpdate = true
    ;(geometry.getAttribute('aSize') as BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    this.points.geometry.dispose()
    ;(this.points.material as ShaderMaterial).dispose()
  }
}
