import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { clamp01, makeRng, palette } from '../art/palette'
import { makeFireflyMaterial } from '../shaders/particles'

export interface SnowGlobeProps {
  /** 0 → 1 open ramp, owned by Act4Board and read per frame (no re-renders) */
  focusT: MutableRefObject<number>
  radius?: number
  children: ReactNode
}

const easeOutBack = (x: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

const SNOW = 120

/**
 * §5 Act 4: a project diorama lives inside a glass globe — the miniature scales
 * out of the unfolded note, snow drifts inside, and the rim becomes the act's
 * single emissive hero while the board pins dim down (Act4Board handles the
 * hand-off so only one bloom source is ever lit).
 */
export function SnowGlobe({ focusT, radius = 0.17, children }: SnowGlobeProps) {
  const root = useRef<Group>(null)
  const inner = useRef<Group>(null)

  const glassGeo = useMemo(() => new SphereGeometry(radius, 24, 16), [radius])
  const baseGeo = useMemo(() => new CylinderGeometry(0.075, 0.098, 0.05, 20), [])
  const rimGeo = useMemo(() => new TorusGeometry(0.079, 0.005, 6, 26), [])
  const groundGeo = useMemo(() => new CylinderGeometry(0.105, 0.105, 0.008, 24), [])

  const glassMat = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: '#E8F4FF',
        transparent: true,
        opacity: 0.14,
        roughness: 0.05,
        metalness: 0,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  )
  const baseMat = useMemo(
    () => new MeshStandardMaterial({ color: '#382A5E', roughness: 0.45, metalness: 0.35 }),
    [],
  )
  const groundMat = useMemo(
    () => new MeshStandardMaterial({ color: palette.cream, roughness: 0.95 }),
    [],
  )
  const rimMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#241C42',
        emissive: palette.violet,
        emissiveIntensity: 0,
        roughness: 0.4,
      }),
    [],
  )
  const snowMat = useMemo(() => makeFireflyMaterial(0xffffff), [])

  const snowGeo = useMemo(() => {
    const rng = makeRng(2024)
    const positions = new Float32Array(SNOW * 3)
    const phase = new Float32Array(SNOW)
    const speed = new Float32Array(SNOW)
    const size = new Float32Array(SNOW)
    for (let i = 0; i < SNOW; i++) {
      // uniform-ish inside the sphere, biased low so it reads as settled snow
      const r = radius * 0.86 * Math.cbrt(rng())
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.75 - 0.02
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      phase[i] = rng() * Math.PI * 2
      speed[i] = 0.18 + rng() * 0.35
      size[i] = 0.12 + rng() * 0.22
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aPhase', new BufferAttribute(phase, 1))
    g.setAttribute('aSpeed', new BufferAttribute(speed, 1))
    g.setAttribute('aSize', new BufferAttribute(size, 1))
    return g
  }, [radius])

  useEffect(
    () => () => {
      glassGeo.dispose()
      baseGeo.dispose()
      rimGeo.dispose()
      groundGeo.dispose()
      snowGeo.dispose()
      glassMat.dispose()
      baseMat.dispose()
      groundMat.dispose()
      rimMat.dispose()
      snowMat.dispose()
    },
    [glassGeo, baseGeo, rimGeo, groundGeo, snowGeo, glassMat, baseMat, groundMat, rimMat, snowMat],
  )

  useFrame((state) => {
    const group = root.current
    if (!group) return
    const t = clamp01(focusT.current)
    group.visible = t > 0.002
    if (!group.visible) return

    const eased = easeOutBack(t)
    group.scale.setScalar(Math.max(0.001, eased))

    // the rim takes over as the act's emissive hero only once the globe is open
    rimMat.emissiveIntensity = 2.1 * clamp01((t - 0.55) / 0.45)
    // a slow idle spin so the miniature is never static
    if (inner.current) inner.current.rotation.y = state.clock.elapsedTime * 0.12
  })

  return (
    <group ref={root} visible={false}>
      {/* everything inside the glass */}
      <group ref={inner}>
        <group position={[0, -0.105, 0]}>{children}</group>
        <mesh geometry={groundGeo} material={groundMat} position={[0, -0.109, 0]} />
        <points geometry={snowGeo} material={snowMat} frustumCulled={false} />
      </group>

      <mesh geometry={glassGeo} material={glassMat} renderOrder={2} />
      <mesh geometry={baseGeo} material={baseMat} position={[0, -0.135, 0]} />
      <mesh geometry={rimGeo} material={rimMat} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.111, 0]} />
    </group>
  )
}
