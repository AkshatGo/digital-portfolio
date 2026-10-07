import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
} from 'three'
import { palette } from '../art/palette'

/** the project that owns this globe: Inkwell */
export function InkwellGlobe() {
  const pen = useRef<Group>(null)
  const ink = useRef<Group>(null)

  const geo = useMemo(
    () => ({
      pot: new CylinderGeometry(0.032, 0.038, 0.05, 18),
      lid: new ConeGeometry(0.036, 0.03, 18),
      ink: new CylinderGeometry(0.028, 0.028, 0.004, 16),
      page: new BoxGeometry(0.085, 0.0025, 0.062),
      barrel: new CylinderGeometry(0.0042, 0.0042, 0.11, 8),
      nib: new ConeGeometry(0.0055, 0.022, 8),
      band: new CylinderGeometry(0.005, 0.005, 0.008, 8),
    }),
    [],
  )

  const mat = useMemo(
    () => ({
      pot: new MeshStandardMaterial({ color: '#1B1B33', roughness: 0.25, metalness: 0.5 }),
      lid: new MeshStandardMaterial({ color: palette.violet, roughness: 0.35, metalness: 0.4 }),
      ink: new MeshStandardMaterial({ color: '#05050C', roughness: 0.1, metalness: 0.2 }),
      page: new MeshStandardMaterial({ color: palette.cream, roughness: 0.9 }),
      barrel: new MeshStandardMaterial({ color: '#22224A', roughness: 0.3, metalness: 0.6 }),
      nib: new MeshStandardMaterial({ color: palette.sun, roughness: 0.25, metalness: 0.85 }),
      band: new MeshStandardMaterial({ color: palette.mint, roughness: 0.4, metalness: 0.6 }),
    }),
    [],
  )

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mat).forEach((m) => m.dispose())
    },
    [geo, mat],
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // the pen hovers, dips into the pot and lifts again — a slow writing loop
    if (pen.current) {
      pen.current.position.y = 0.1 + Math.sin(t * 0.7) * 0.012
      pen.current.rotation.z = 0.32 + Math.sin(t * 0.45) * 0.06
      pen.current.rotation.y = -0.5 + Math.sin(t * 0.3) * 0.25
    }
    if (ink.current) ink.current.rotation.y = t * 0.5
  })

  return (
    <group>
      {/* printed pages */}
      <mesh geometry={geo.page} material={mat.page} position={[-0.012, 0.0016, 0.004]} rotation={[0, 0.12, 0]} />
      <mesh geometry={geo.page} material={mat.page} position={[-0.008, 0.0044, 0.002]} rotation={[0, -0.06, 0]} />
      <mesh geometry={geo.page} material={mat.page} position={[-0.004, 0.0072, 0]} rotation={[0, 0.22, 0]} />

      {/* inkwell */}
      <group ref={ink} position={[0.048, 0.025, -0.03]}>
        <mesh geometry={geo.pot} material={mat.pot} />
        <mesh geometry={geo.ink} material={mat.ink} position={[0, 0.022, 0]} />
        <mesh geometry={geo.lid} material={mat.lid} position={[0, 0.062, 0]} rotation={[0, 0, 0.35]} />
      </group>

      {/* floating pen */}
      <group ref={pen} position={[-0.01, 0.1, 0.01]}>
        <mesh geometry={geo.barrel} material={mat.barrel} position={[0, 0.055, 0]} />
        <mesh geometry={geo.band} material={mat.band} position={[0, 0.095, 0]} />
        <mesh geometry={geo.nib} material={mat.nib} position={[0, -0.01, 0]} rotation={[Math.PI, 0, 0]} />
      </group>
    </group>
  )
}
