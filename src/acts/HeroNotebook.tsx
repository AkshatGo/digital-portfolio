import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, Group, Mesh, ShaderMaterial } from 'three'
import { rig, uTime } from '../rig/RigState'
import { palette } from '../art/palette'
import { makePaperMaterial } from '../shaders/paper'
import { VIEW_WINDOWS, inWindow } from '../rig/acts'

/* --- hero scale: the book must read from 6.5 m away in Act 1 --- */
const LENGTH = 3.2 // along +x, the spine runs along x
const DEPTH = 2.4 // from the spine (+z) to the fore edge
const BOARD = 0.12 // cover thickness
const PAGE_COUNT = 6

/**
 * §5 Act 1 hero: a notebook whose group origin sits on a CORNER VERTEX, so a
 * slow rotation.y reads as corner-pivot rotation rather than a turntable.
 * Act 2 hinges the front cover 180° about the spine (rotation.x) and fans the
 * pages 3° each, revealing the glow the room crossfades into.
 */
export function HeroNotebook() {
  const outer = useRef<Group>(null)
  const pivot = useRef<Group>(null)
  const hinge = useRef<Group>(null)
  const pages = useRef<Group>(null)
  const glow = useRef<Mesh>(null)

  const mats = useMemo(() => {
    const cover = makePaperMaterial({
      color: palette.violet,
      amplitude: 0.002,
      roughness: 0.72,
      transparent: true,
    })
    const back = makePaperMaterial({
      color: new Color(palette.violet).multiplyScalar(0.55),
      amplitude: 0,
      transparent: true,
    })
    const page = makePaperMaterial({ color: palette.cream, amplitude: 0.004, transparent: true })

    const glowMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime,
        uIntensity: { value: 0 },
        uColor: { value: [0.486, 0.361, 1.0] },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        uniform float uIntensity;
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.1, d);
          a *= uIntensity * (0.85 + 0.15 * sin(uTime * 2.4));
          gl_FragColor = vec4(uColor * a * 2.0, a);
        }
      `,
    })

    return { cover, back, page, glowMat }
  }, [])

  const fading = useMemo(() => [mats.cover, mats.back, mats.page], [mats])

  useEffect(
    () => () => {
      fading.forEach((m) => m.dispose())
      mats.glowMat.dispose()
    },
    [fading, mats],
  )

  useFrame((state) => {
    const root = outer.current
    if (!root) return
    const p = rig.progress

    root.visible = inWindow(p, VIEW_WINDOWS.notebook, 0.02)
    if (!root.visible) return

    const t = state.clock.elapsedTime
    root.scale.setScalar(rig.notebookScale)
    root.position.y = 0.02 + Math.sin(t * 0.62) * 0.012

    // corner-pivot spin reads off progress ⇒ scrubs backwards exactly
    if (pivot.current) pivot.current.rotation.y = -0.35 + p * 1.1 + Math.sin(t * 0.18) * 0.03

    // §3 `open`: hinge flips the cover 180° about the spine
    if (hinge.current) hinge.current.rotation.x = -Math.PI * rig.hinge

    // pages fan 3° each
    if (pages.current) {
      const kids = pages.current.children
      for (let i = 0; i < kids.length; i++) kids[i].rotation.x = -(i * 0.052) * rig.pages
    }

    // inner glow rises 0.26→0.31 and doubles as the crossfade mask
    if (glow.current) {
      const u = mats.glowMat.uniforms
      ;(u.uIntensity as { value: number }).value = rig.glowPages * 1.1
      glow.current.visible = rig.glowPages > 0.001
      glow.current.scale.setScalar(0.55 + rig.glowPages * 0.85)
    }

    const fade = rig.notebookFade
    for (let i = 0; i < fading.length; i++) fading[i].opacity = fade
  })

  return (
    <group ref={outer} position={[-LENGTH / 2, 0.02, -DEPTH / 2]}>
      {/* corner pivot: children are offset so the origin is the book's corner */}
      <group ref={pivot}>
        <mesh material={mats.back} position={[LENGTH / 2, -BOARD / 2, DEPTH / 2]}>
          <boxGeometry args={[LENGTH, BOARD, DEPTH]} />
        </mesh>

        <group ref={hinge}>
          <mesh material={mats.cover} position={[LENGTH / 2, BOARD / 2, DEPTH / 2]}>
            <boxGeometry args={[LENGTH, BOARD, DEPTH]} />
          </mesh>
        </group>

        <group ref={pages}>
          {Array.from({ length: PAGE_COUNT }, (_, i) => (
            <group key={i}>
              <mesh material={mats.page} position={[LENGTH / 2, i * 0.006, DEPTH / 2]}>
                <boxGeometry args={[LENGTH * 0.96, 0.004, DEPTH * 0.92]} />
              </mesh>
            </group>
          ))}
        </group>

        <mesh
          ref={glow}
          material={mats.glowMat}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[LENGTH / 2, 0.08, DEPTH / 2]}
          visible={false}
        >
          <planeGeometry args={[LENGTH * 1.05, DEPTH * 1.05]} />
        </mesh>
      </group>
    </group>
  )
}
