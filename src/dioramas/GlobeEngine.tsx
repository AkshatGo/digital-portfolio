import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  DoubleSide,
  Group,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  TorusGeometry,
} from 'three'
import { palette } from '../art/palette'

/** the project that owns this globe: Snow-Globe Engine */
export function GlobeEngine() {
  const rings = useRef<Group>(null)
  const shells = useRef<Group>(null)

  const geo = useMemo(
    () => ({
      shellOuter: new IcosahedronGeometry(0.075, 1),
      shellMid: new IcosahedronGeometry(0.052, 1),
      core: new IcosahedronGeometry(0.022, 1),
      ring: new TorusGeometry(0.082, 0.0022, 6, 28),
      ringSmall: new TorusGeometry(0.062, 0.0018, 6, 22),
    }),
    [],
  )

  const mat = useMemo(
    () => ({
      wire: new MeshBasicMaterial({ color: palette.mint, wireframe: true, transparent: true, opacity: 0.75, side: DoubleSide }),
      wireViolet: new MeshBasicMaterial({ color: palette.violet, wireframe: true, transparent: true, opacity: 0.8 }),
      core: new MeshStandardMaterial({ color: '#123', emissive: palette.mint, emissiveIntensity: 1.6, roughness: 0.3 }),
      ring: new MeshBasicMaterial({ color: palette.cream, transparent: true, opacity: 0.5 }),
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
    if (shells.current) shells.current.rotation.y = t * 0.22
    if (rings.current) {
      rings.current.rotation.x = t * 0.35
      rings.current.rotation.z = t * 0.18
    }
  })

  return (
    <group position={[0, 0.075, 0]}>
      <group ref={shells}>
        <mesh geometry={geo.shellOuter} material={mat.wire} />
        <mesh geometry={geo.shellMid} material={mat.wireViolet} rotation={[0.5, 0.9, 0]} />
        <mesh geometry={geo.core} material={mat.core} />
      </group>
      <group ref={rings}>
        <mesh geometry={geo.ring} material={mat.ring} rotation={[Math.PI / 2.4, 0, 0]} />
        <mesh geometry={geo.ringSmall} material={mat.ring} rotation={[0, 0.6, Math.PI / 3]} />
      </group>
    </group>
  )
}
