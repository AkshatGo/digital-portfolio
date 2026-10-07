import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three'
import { makeRng, palette } from '../art/palette'
import { createRidgeGeometry } from '../art/ridge'
import { makeFireflyMaterial } from '../shaders/particles'
import { makePaperMaterial } from '../shaders/paper'

/* canonical miniature space: origin on the globe floor, ~0.17 tall */
const PROPS = 8

/** the project that owns this globe: The Notebook Valley */
export function NotebookGlobe() {
  const bookRef = useRef<Group>(null)
  const props = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  const geo = useMemo(
    () => ({
      ridge: createRidgeGeometry(0.098, 28, 0.012, 0.032, 41, 0.2),
      floor: new CircleGeometry(0.1, 24),
      book: new BoxGeometry(0.085, 0.006, 0.06),
      prop: new BoxGeometry(0.012, 0.012, 0.012),
      firefly: new SphereGeometry(0.001, 4, 3),
    }),
    [],
  )

  const mat = useMemo(
    () => ({
      floor: new MeshStandardMaterial({ color: '#3B2A73', roughness: 0.95 }),
      ridge: new MeshStandardMaterial({ color: '#2A1D5C', roughness: 1, side: DoubleSide }),
      cover: makePaperMaterial({ color: palette.violet, amplitude: 0.002 }),
      pages: makePaperMaterial({ color: palette.cream, amplitude: 0.003 }),
      prop: new MeshStandardMaterial({ color: palette.mint, roughness: 0.5 }),
    }),
    [],
  )

  const propData = useMemo(() => {
    const rng = makeRng(52)
    const data: { x: number; y: number; z: number; phase: number; speed: number }[] = []
    const color = new Color()
    const colors: Color[] = []
    for (let i = 0; i < PROPS; i++) {
      const a = rng() * Math.PI * 2
      const r = 0.03 + rng() * 0.06
      data.push({
        x: Math.cos(a) * r,
        y: 0.02 + rng() * 0.09,
        z: Math.sin(a) * r,
        phase: rng() * Math.PI * 2,
        speed: 0.4 + rng() * 0.6,
      })
      colors.push(color.clone().setHex(rng() < 0.5 ? palette.sun : palette.coral, 'srgb'))
    }
    return { data, colors }
  }, [])

  const fireflyGeo = useMemo(() => {
    const rng = makeRng(88)
    const count = 40
    const positions = new Float32Array(count * 3)
    const phase = new Float32Array(count)
    const speed = new Float32Array(count)
    const size = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2
      const r = 0.01 + rng() * 0.085
      positions[i * 3] = Math.cos(a) * r
      positions[i * 3 + 1] = 0.015 + rng() * 0.12
      positions[i * 3 + 2] = Math.sin(a) * r
      phase[i] = rng() * Math.PI * 2
      speed[i] = 0.5 + rng() * 1.2
      size[i] = 0.1 + rng() * 0.2
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aPhase', new BufferAttribute(phase, 1))
    g.setAttribute('aSpeed', new BufferAttribute(speed, 1))
    g.setAttribute('aSize', new BufferAttribute(size, 1))
    return g
  }, [])
  const fireflyMat = useMemo(() => makeFireflyMaterial(palette.sun), [])

  useLayoutEffect(() => {
    const mesh = props.current
    if (!mesh) return
    propData.colors.forEach((c, i) => mesh.setColorAt(i, c))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [propData])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mat).forEach((m) => m.dispose())
      fireflyGeo.dispose()
      fireflyMat.dispose()
    },
    [geo, mat, fireflyGeo, fireflyMat],
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (bookRef.current) bookRef.current.rotation.y = 0.3 + Math.sin(t * 0.35) * 0.5
    const mesh = props.current
    if (!mesh) return
    for (let i = 0; i < PROPS; i++) {
      const d = propData.data[i]
      dummy.position.set(d.x, d.y + Math.sin(t * d.speed + d.phase) * 0.012, d.z)
      dummy.rotation.set(0, t * 0.3 + d.phase, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <mesh geometry={geo.floor} material={mat.floor} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={geo.ridge} material={mat.ridge} />

      <group ref={bookRef} position={[0, 0.004, 0]}>
        <mesh geometry={geo.book} material={mat.pages} />
        <mesh geometry={geo.book} material={mat.cover} position={[0, 0.005, 0]} />
      </group>

      <instancedMesh ref={props} args={[geo.prop, mat.prop, PROPS]} frustumCulled={false} />
      <points geometry={fireflyGeo} material={fireflyMat} frustumCulled={false} />
    </group>
  )
}
