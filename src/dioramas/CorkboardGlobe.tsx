import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { hexToNumber, palette } from '../art/palette'
import { projects } from '../content/projects'
import { makePaperMaterial } from '../shaders/paper'

const NOTES = 4

/** the project that owns this globe: Corkboard */
export function CorkboardGlobe() {
  const board = useRef<Group>(null)
  const notes = useRef<InstancedMesh>(null)
  const pins = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  const geo = useMemo(
    () => ({
      frame: new BoxGeometry(0.17, 0.13, 0.006),
      cork: new PlaneGeometry(0.155, 0.115),
      note: new PlaneGeometry(0.045, 0.036),
      pin: new SphereGeometry(0.005, 8, 6),
      leg: new BoxGeometry(0.006, 0.055, 0.006),
    }),
    [],
  )

  const mat = useMemo(
    () => ({
      frame: new MeshStandardMaterial({ color: '#8A5A3B', roughness: 0.8 }),
      cork: new MeshStandardMaterial({ color: '#D9A15B', roughness: 1 }),
      note: makePaperMaterial({ color: palette.cream, amplitude: 0.002 }),
      pin: new MeshStandardMaterial({
        color: palette.sun,
        emissive: palette.sun,
        emissiveIntensity: 1.4,
        roughness: 0.35,
      }),
      thread: new MeshStandardMaterial({ color: 0xc0392b, roughness: 0.9 }),
      leg: new MeshStandardMaterial({ color: '#6E4526', roughness: 0.9 }),
    }),
    [],
  )

  const layout = useMemo(
    () => [
      [-0.045, 0.03],
      [0.012, 0.036],
      [0.048, 0.018],
      [-0.018, -0.028],
    ] as const,
    [],
  )

  const threads = useMemo(() => {
    const out: TubeGeometry[] = []
    const pairs: [number, number][] = [
      [0, 1],
      [1, 2],
      [0, 3],
    ]
    for (const [a, b] of pairs) {
      const pa = new Vector3(layout[a][0], layout[a][1], 0.006)
      const pb = new Vector3(layout[b][0], layout[b][1], 0.006)
      const mid = pa.clone().add(pb).multiplyScalar(0.5)
      mid.y -= pa.distanceTo(pb) * 0.18
      out.push(new TubeGeometry(new CatmullRomCurve3([pa, mid, pb]), 10, 0.0011, 5, false))
    }
    return out
  }, [layout])

  useLayoutEffect(() => {
    const noteMesh = notes.current
    const pinMesh = pins.current
    if (!noteMesh || !pinMesh) return
    const tint = new Color()
    for (let i = 0; i < NOTES; i++) {
      const [x, y] = layout[i]
      dummy.position.set(x, y, 0.004)
      dummy.rotation.set(0, 0, ((i % 3) - 1) * 0.08)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      noteMesh.setMatrixAt(i, dummy.matrix)
      tint.setHex(hexToNumber(projects[i % projects.length].noteColor), 'srgb')
      noteMesh.setColorAt(i, tint)

      dummy.position.set(x, y + 0.016, 0.008)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      pinMesh.setMatrixAt(i, dummy.matrix)
    }
    noteMesh.instanceMatrix.needsUpdate = true
    pinMesh.instanceMatrix.needsUpdate = true
    if (noteMesh.instanceColor) noteMesh.instanceColor.needsUpdate = true
  }, [dummy, layout])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mat).forEach((m) => m.dispose())
      threads.forEach((t) => t.dispose())
    },
    [geo, mat, threads],
  )

  useFrame((state) => {
    if (board.current) {
      const t = state.clock.elapsedTime
      board.current.rotation.y = Math.sin(t * 0.28) * 0.35
      board.current.position.y = 0.085 + Math.sin(t * 0.8) * 0.004
    }
  })

  return (
    <group ref={board} position={[0, 0.085, 0]}>
      <mesh geometry={geo.frame} material={mat.frame} />
      <mesh geometry={geo.cork} material={mat.cork} position={[0, 0, 0.004]} />
      <instancedMesh ref={notes} args={[geo.note, mat.note, NOTES]} frustumCulled={false} />
      <instancedMesh ref={pins} args={[geo.pin, mat.pin, NOTES]} frustumCulled={false} />
      {threads.map((t, i) => (
        <mesh key={i} geometry={t} material={mat.thread} />
      ))}
      {/* easel legs */}
      <mesh geometry={geo.leg} material={mat.leg} position={[-0.07, -0.09, 0]} rotation={[0, 0, 0.12]} />
      <mesh geometry={geo.leg} material={mat.leg} position={[0.07, -0.09, 0]} rotation={[0, 0, -0.12]} />
    </group>
  )
}
