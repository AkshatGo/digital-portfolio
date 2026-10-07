import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
} from 'three'
import { palette } from '../art/palette'
import { rig } from '../rig/RigState'
import { VIEW_WINDOWS, inWindow } from '../rig/acts'

const KEY_ROWS = 4
const KEY_COLS = 14
const KEY_COUNT = KEY_ROWS * KEY_COLS

/**
 * §5 Act 3 — Desk (0.38–0.55), grey-box pass.
 * In place: geometry, the emissive screens and the mint LED strip (this act's
 * single bloom hero), plus a single instanced keycap grid whose glow wave runs
 * along instance colours. Pending for the art pass: the adaptive CanvasTexture
 * terminal / radial skill chart, mug steam ribbon, cable tubes and the
 * interactive `T` overlay (the overlay itself lives in src/ui/Terminal.tsx).
 */
export function Act3Desk() {
  const root = useRef<Group>(null)
  const caps = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  const geo = useMemo(
    () => ({
      plane: new PlaneGeometry(1, 1),
      box: new BoxGeometry(1, 1, 1),
      mug: new CylinderGeometry(0.07, 0.06, 0.16, 20),
      cap: new BoxGeometry(0.028, 0.012, 0.03),
    }),
    [],
  )

  const mat = useMemo(
    () => ({
      screen: new MeshStandardMaterial({
        color: '#0E2430',
        emissive: palette.mint,
        emissiveIntensity: 0,
        roughness: 0.4,
      }),
      bezel: new MeshStandardMaterial({ color: '#22243A', roughness: 0.5, metalness: 0.4 }),
      keyboard: new MeshStandardMaterial({ color: '#2B2D45', roughness: 0.7 }),
      cap: new MeshStandardMaterial({ color: '#5B5E82', roughness: 0.6 }),
      mug: new MeshStandardMaterial({ color: palette.coral, roughness: 0.6 }),
      led: new MeshStandardMaterial({
        color: '#0D2A28',
        emissive: palette.mint,
        emissiveIntensity: 0,
      }),
      figurine: new MeshStandardMaterial({ color: palette.violet, roughness: 0.5 }),
    }),
    [],
  )

  const capsData = useMemo(() => {
    const base = new Color('#5B5E82')
    const hot = new Color(palette.mint)
    const colors: Color[] = []
    const scratchColor = new Color()
    for (let i = 0; i < KEY_COUNT; i++) colors.push(base.clone())
    return { base, hot, colors, scratchColor }
  }, [])

  useLayoutEffect(() => {
    const mesh = caps.current
    if (!mesh) return
    for (let i = 0; i < KEY_COUNT; i++) {
      const row = Math.floor(i / KEY_COLS)
      const col = i % KEY_COLS
      dummy.position.set((row - 1.5) * 0.08, 0, (col - 6.5) * 0.082)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, capsData.colors[i])
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [dummy, capsData])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mat).forEach((m) => m.dispose())
    },
    [geo, mat],
  )

  useFrame((state) => {
    const group = root.current
    if (!group) return
    const p = rig.progress
    group.visible = inWindow(p, VIEW_WINDOWS.desk, 0.05)
    if (!group.visible) return

    const glow = rig.deskGlow
    mat.screen.emissiveIntensity = glow * 1.6
    mat.led.emissiveIntensity = glow * 2.2

    // glow wave travels across the rows every 4 s (§5 Act 3)
    const mesh = caps.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    for (let i = 0; i < KEY_COUNT; i++) {
      const row = Math.floor(i / KEY_COLS)
      const phase = (t * 0.9 + row * 0.5) % 2
      const wave = phase < 1 ? 1 - phase : 0
      capsData.scratchColor.copy(capsData.base).lerp(capsData.hot, wave * glow * 0.8)
      mesh.setColorAt(i, capsData.scratchColor)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <group ref={root} visible={false}>
      {[
        { z: 0.26, h: 1.25 },
        { z: 1.02, h: 1.25 },
      ].map((s, i) => (
        <group key={i} position={[2.62, s.h, s.z]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh geometry={geo.plane} material={mat.screen} scale={[0.62, 0.38, 1]} />
          <mesh
            geometry={geo.box}
            material={mat.bezel}
            position={[0, 0, -0.035]}
            scale={[0.66, 0.42, 0.03]}
          />
        </group>
      ))}

      <mesh
        geometry={geo.box}
        material={mat.keyboard}
        position={[2.95, 0.79, 0.64]}
        scale={[0.42, 0.03, 1.24]}
      />
      <instancedMesh
        ref={caps}
        args={[geo.cap, mat.cap, KEY_COUNT]}
        position={[2.95, 0.81, 0.64]}
        frustumCulled={false}
      />

      <mesh geometry={geo.mug} material={mat.mug} position={[3.3, 0.85, 1.62]} />
      <mesh
        geometry={geo.cap}
        material={mat.figurine}
        position={[3.25, 0.83, -0.5]}
        scale={[4, 5, 3]}
      />

      {/* LED strip under the desk edge — the act's emissive hero */}
      <mesh
        geometry={geo.box}
        material={mat.led}
        position={[2.8, 0.7, 0.5]}
        scale={[0.04, 0.02, 3.0]}
      />
    </group>
  )
}
