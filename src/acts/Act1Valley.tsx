import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  type Material,
} from 'three'
import { palette, makeRng } from '../art/palette'
import { createRidgeGeometry } from '../art/ridge'
import { makeFireflyMaterial } from '../shaders/particles'
import { makeSkyMaterial } from '../shaders/sky'
import { rig } from '../rig/RigState'

/* ------------------------------------------------------------------ */
/* floating props                                                      */
/* ------------------------------------------------------------------ */

interface FloatingPropsProps {
  geometry: BufferGeometry
  material: Material
  count: number
  seed: number
  radius: [number, number]
  height: [number, number]
  palette: number[]
  scale: number
}

/**
 * §5 Act 1: ~40 instanced props on individual sine loops. Matrices are rebuilt
 * into a pooled Object3D — no allocation per frame.
 */
function FloatingProps({
  geometry,
  material,
  count,
  seed,
  radius,
  height,
  palette: tints,
  scale,
}: FloatingPropsProps) {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  const data = useMemo(() => {
    const rng = makeRng(seed)
    const base = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    const speed = new Float32Array(count)
    const amp = new Float32Array(count)
    const spin = new Float32Array(count)
    const color = new Color()
    const colors: Color[] = []
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2
      const r = radius[0] + rng() * (radius[1] - radius[0])
      base[i * 3] = Math.cos(a) * r
      base[i * 3 + 1] = height[0] + rng() * (height[1] - height[0])
      base[i * 3 + 2] = Math.sin(a) * r
      phase[i] = rng() * Math.PI * 2
      speed[i] = 0.25 + rng() * 0.45
      amp[i] = 0.22 + rng() * 0.5
      spin[i] = (rng() - 0.5) * 0.5
      colors.push(color.clone().setHex(tints[Math.floor(rng() * tints.length)], 'srgb'))
    }
    return { base, phase, speed, amp, spin, colors }
  }, [count, seed, radius, height, tints])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    data.colors.forEach((c, i) => mesh.setColorAt(i, c))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [data])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    const wind = rig.wind
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      dummy.position.set(
        data.base[i3] + Math.sin(t * 0.2 + data.phase[i]) * wind * 0.4,
        data.base[i3 + 1] + Math.sin(t * data.speed[i] + data.phase[i]) * data.amp[i],
        data.base[i3 + 2] + Math.cos(t * 0.17 + data.phase[i]) * wind * 0.4,
      )
      dummy.rotation.set(
        Math.sin(t * 0.3 + data.phase[i]) * 0.2,
        t * data.spin[i] + data.phase[i],
        Math.cos(t * 0.26 + data.phase[i]) * 0.15,
      )
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />
  )
}

/* ------------------------------------------------------------------ */
/* fireflies                                                           */
/* ------------------------------------------------------------------ */

function Fireflies({ count = 300, seed = 31 }: { count?: number; seed?: number }) {
  const material = useMemo(() => makeFireflyMaterial(palette.sun), [])
  const geometry = useMemo(() => {
    const rng = makeRng(seed)
    const positions = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    const speed = new Float32Array(count)
    const size = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2
      const r = 1.5 + rng() * 13
      positions[i * 3] = Math.cos(a) * r
      positions[i * 3 + 1] = 0.4 + rng() * 4.5
      positions[i * 3 + 2] = Math.sin(a) * r
      phase[i] = rng() * Math.PI * 2
      speed[i] = 0.5 + rng() * 1.4
      size[i] = 0.5 + rng() * 1.1
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aPhase', new BufferAttribute(phase, 1))
    g.setAttribute('aSpeed', new BufferAttribute(speed, 1))
    g.setAttribute('aSize', new BufferAttribute(size, 1))
    return g
  }, [count, seed])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

/* ------------------------------------------------------------------ */
/* Act 1                                                               */
/* ------------------------------------------------------------------ */

/**
 * §5 Act 1 — Valley (0.00–0.18). Gradient sky dome, exponential fog, valley
 * floor disc, two ridge rings, ~40 floating props, 300 fireflies.
 */
export function Act1Valley() {
  const root = useRef<Group>(null)
  const props = useRef<Group>(null)

  const geo = useMemo(
    () => ({
      sky: new SphereGeometry(140, 32, 24),
      floor: new CircleGeometry(30, 64),
      ridgeFar: createRidgeGeometry(26, 48, 3.2, 7.5, 11),
      ridgeNear: createRidgeGeometry(15, 40, 1.6, 4.6, 23),
      keycap: new BoxGeometry(0.2, 0.2, 0.2),
      wafer: new CylinderGeometry(0.34, 0.34, 0.05, 20),
      usb: new BoxGeometry(0.52, 0.07, 0.17),
    }),
    [],
  )

  const mat = useMemo(
    () => ({
      sky: makeSkyMaterial(),
      floor: new MeshStandardMaterial({ color: '#3B2A73', roughness: 0.95, metalness: 0 }),
      ridgeFar: new MeshStandardMaterial({
        color: '#2A1D5C',
        roughness: 1,
        side: DoubleSide,
        flatShading: true,
      }),
      ridgeNear: new MeshStandardMaterial({
        color: '#3D2A78',
        roughness: 1,
        side: DoubleSide,
        flatShading: true,
      }),
      // props are unlit: they read as graphic artifacts against the fog
      prop: new MeshBasicMaterial({ vertexColors: false, toneMapped: true }),
    }),
    [],
  )

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      mat.sky.dispose()
      mat.floor.dispose()
      mat.ridgeFar.dispose()
      mat.ridgeNear.dispose()
      mat.prop.dispose()
    },
    [geo, mat],
  )

  useFrame(() => {
    const p = rig.progress
    const night = rig.night > 0.05
    if (root.current) root.current.visible = p < 0.3 || night
    if (props.current) props.current.visible = p < 0.3
  })

  return (
    <group ref={root}>
      <mesh geometry={geo.sky} material={mat.sky} frustumCulled={false} />

      <mesh
        geometry={geo.floor}
        material={mat.floor}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow={false}
      />
      <mesh geometry={geo.ridgeFar} material={mat.ridgeFar} position={[0, 0, 0]} />
      <mesh geometry={geo.ridgeNear} material={mat.ridgeNear} position={[0, 0, 0]} />

      <group ref={props}>
        <FloatingProps
          geometry={geo.keycap}
          material={mat.prop}
          count={14}
          seed={41}
          radius={[3.4, 13]}
          height={[0.8, 3.6]}
          scale={1}
          palette={[palette.mint, palette.sun, palette.cream]}
        />
        <FloatingProps
          geometry={geo.wafer}
          material={mat.prop}
          count={13}
          seed={57}
          radius={[4.5, 15]}
          height={[1.2, 4.6]}
          scale={1}
          palette={[palette.violet, palette.mint, palette.coral]}
        />
        <FloatingProps
          geometry={geo.usb}
          material={mat.prop}
          count={13}
          seed={63}
          radius={[3.8, 11]}
          height={[0.9, 3.0]}
          scale={1}
          palette={[palette.sun, palette.coral, palette.cream]}
        />
      </group>

      <Fireflies />
    </group>
  )
}
