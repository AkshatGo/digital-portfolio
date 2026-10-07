import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
} from 'three'
import { makeRng, palette } from '../art/palette'
import { makeStarMaterial } from '../shaders/particles'
import { makePaperMaterial } from '../shaders/paper'
import { rig, uTime } from '../rig/RigState'
import { VIEW_WINDOWS, inWindow } from '../rig/acts'
import { loadVisitors, ensureVisit } from '../systems/visitors'

const AMBIENT_STARS = 600

/** §7 `glowPages`: warm light leaking out of the closed notebook's page edges. */
function makePageGlowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime, uColor: { value: [1, 0.82, 0.4] }, uIntensity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float band = smoothstep(0.5, 0.0, abs(vUv.y - 0.5) * 2.0);
        float pulse = 0.7 + 0.3 * sin(uTime * 1.1 + vUv.x * 6.0);
        float a = band * pulse * uIntensity;
        gl_FragColor = vec4(uColor * a * 1.8, a * 0.85);
      }
    `,
  })
}

/**
 * §5 Act 6 — Night outro (0.88–1.00).
 * The sky swaps to a star dome (uNight is written each frame by ScrollRig); the
 * visitor's signature appears as a pulsing labelled star among past visitors
 * (§9 cap 500 FIFO); the closed notebook sits in the valley with warm light
 * leaking through its page edges.
 */
export function Act6Night() {
  const root = useRef<Group>(null)
  const glow = useRef<Mesh>(null)
  const starMat = useMemo(() => makeStarMaterial(), [])
  const glowMat = useMemo(() => makePageGlowMaterial(), [])

  const paper = useMemo(
    () => makePaperMaterial({ color: palette.violet, amplitude: 0.002, roughness: 0.7 }),
    [],
  )
  const pagesMat = useMemo(
    () => new MeshStandardMaterial({ color: palette.cream, roughness: 0.9, emissive: palette.sun, emissiveIntensity: 0 }),
    [],
  )

  /** ambient dome + every stored visitor star (mine drawn brighter) */
  const geometry = useMemo(() => {
    const rng = makeRng(1234)
    const mine = ensureVisit()
    const visitors = loadVisitors()
    const list = visitors.length ? visitors : [mine.mine]
    const total = AMBIENT_STARS + list.length

    const positions = new Float32Array(total * 3)
    const phase = new Float32Array(total)
    const size = new Float32Array(total)
    const kind = new Float32Array(total)

    for (let i = 0; i < AMBIENT_STARS; i++) {
      const u = rng() * Math.PI * 2
      const v = Math.acos(rng() * 0.9 + 0.05)
      const r = 86 + rng() * 6
      positions[i * 3] = Math.cos(u) * Math.sin(v) * r
      positions[i * 3 + 1] = Math.cos(v) * r * 0.8 + 12
      positions[i * 3 + 2] = Math.sin(u) * Math.sin(v) * r
      phase[i] = rng() * 8
      size[i] = 0.35 + rng() * 0.8
      kind[i] = 0
    }

    list.forEach((v, n) => {
      const i = AMBIENT_STARS + n
      positions[i * 3] = v.star[0]
      positions[i * 3 + 1] = v.star[1] * 0.9 + 14
      positions[i * 3 + 2] = v.star[2]
      phase[i] = n * 0.7
      size[i] = v.sig === mine.mine.sig ? 2.2 : 1.6
      kind[i] = 1
    })

    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aPhase', new BufferAttribute(phase, 1))
    g.setAttribute('aSize', new BufferAttribute(size, 1))
    g.setAttribute('aKind', new BufferAttribute(kind, 1))
    return g
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      starMat.dispose()
      glowMat.dispose()
      paper.dispose()
      pagesMat.dispose()
    },
    [geometry, starMat, glowMat, paper, pagesMat],
  )

  useFrame((state) => {
    const group = root.current
    if (!group) return
    const p = rig.progress
    group.visible = inWindow(p, VIEW_WINDOWS.night, 0.02)
    if (!group.visible) return

    const t = state.clock.elapsedTime
    // the visitor's own star pulses; amplitude rises with rig.night
    const pulse = rig.night * (0.5 + 0.5 * Math.sin(t * 1.3))
    ;(starMat.uniforms.uPulse as { value: number }).value = pulse
    ;(glowMat.uniforms.uIntensity as { value: number }).value = rig.night
    if (glow.current) glow.current.visible = rig.night > 0.01

    // warm leak pulsing through the page edges
    pagesMat.emissiveIntensity = 0.12 + 0.1 * Math.sin(t * 0.9)
  })

  return (
    <group ref={root} visible={false}>
      <points geometry={geometry} material={starMat} frustumCulled={false} />

      {/* the notebook, now closed, sitting in the night valley */}
      <group position={[-1.6, 0.06, -1.2]} scale={1} rotation={[0, 0.4, 0]}>
        <mesh material={paper} position={[1.6, 0, 1.2]}>
          <boxGeometry args={[3.2, 0.1, 2.4]} />
        </mesh>
        <mesh material={pagesMat} position={[1.6, 0.075, 1.2]}>
          <boxGeometry args={[3.05, 0.05, 2.25]} />
        </mesh>
        <mesh
          ref={glow}
          material={glowMat}
          position={[1.6, 0.02, 1.2]}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <planeGeometry args={[3.3, 2.5]} />
        </mesh>
      </group>
    </group>
  )
}
