import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three'
import { makeRng, palette } from '../art/palette'
import { makePaperMaterial } from '../shaders/paper'
import { rig } from '../rig/RigState'
import { VIEW_WINDOWS, inWindow } from '../rig/acts'

const SHELF_Y = [0.5, 1.05, 1.6, 2.15, 2.7]
const PER_SHELF = 26
const BOOKS = SHELF_Y.length * PER_SHELF

/* hero book: 'The Story So Far' */
const SHELF_REST = { x: -3.42, y: 2.28, z: 1.5 }
const HERO_REST = { x: -1.4, y: 1.8, z: -1.0 }

const easeInOut = (x: number): number => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)
const clamp01 = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x)

/**
 * §5 Act 5 — Library (0.72–0.88), grey-box pass.
 * 130 spines are a single InstancedMesh with per-instance spine colour; the
 * hero book eases off the shelf toward the room centre and opens to a two-page
 * spread. Pending for the art pass: the spine CanvasTexture atlas, hover slide,
 * cursor-bend page corners and the 2× CanvasTexture spread content.
 */
export function Act5Library() {
  const root = useRef<Group>(null)
  const books = useRef<InstancedMesh>(null)
  const hero = useRef<Group>(null)
  const heroLeft = useRef<Group>(null)
  const heroRight = useRef<Group>(null)
  const dummy = useMemo(() => new Object3D(), [])

  const bookGeo = useMemo(() => new BoxGeometry(1, 1, 1), [])
  const spineMat = useMemo(() => new MeshStandardMaterial({ roughness: 0.85 }), [])
  const clothMat = useMemo(
    () => new MeshStandardMaterial({ color: 0xb83b5e, roughness: 0.9, side: DoubleSide }),
    [],
  )
  const pageMat = useMemo(
    () => makePaperMaterial({ color: palette.cream, amplitude: 0.003, side: DoubleSide }),
    [],
  )
  const goldMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: palette.sun,
        emissive: palette.sun,
        emissiveIntensity: 0.18,
        roughness: 0.35,
        metalness: 0.6,
      }),
    [],
  )
  const stripMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#241C42',
        emissive: palette.violet,
        emissiveIntensity: 0.8,
      }),
    [],
  )

  const spines = useMemo(() => {
    const rng = makeRng(97)
    const items: { matrix: number[]; color: Color }[] = []
    for (let s = 0; s < SHELF_Y.length; s++) {
      let z = -1.15
      for (let i = 0; i < PER_SHELF; i++) {
        const w = 0.05 + rng() * 0.055
        const h = 0.22 + rng() * 0.14
        const d = 0.28 + rng() * 0.06
        dummy.position.set(-3.32, SHELF_Y[s] + h / 2, z + w / 2)
        dummy.rotation.set(0, 0, rng() < 0.06 ? 0.08 : 0)
        dummy.scale.set(d, h, w)
        dummy.updateMatrix()
        const hue = 0.62 + (rng() - 0.5) * 0.35
        const color = new Color().setHSL(hue % 1, 0.35 + rng() * 0.25, 0.3 + rng() * 0.22)
        items.push({ matrix: dummy.matrix.toArray(), color })
        z += w + 0.004
      }
    }
    return items
  }, [dummy])

  useLayoutEffect(() => {
    const mesh = books.current
    if (!mesh) return
    for (let i = 0; i < spines.length; i++) {
      dummy.matrix.fromArray(spines[i].matrix)
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, spines[i].color)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [dummy, spines])

  useEffect(
    () => () => {
      bookGeo.dispose()
      spineMat.dispose()
      clothMat.dispose()
      pageMat.dispose()
      goldMat.dispose()
      stripMat.dispose()
    },
    [bookGeo, spineMat, clothMat, pageMat, goldMat, stripMat],
  )

  useFrame(() => {
    const group = root.current
    if (!group) return
    const p = rig.progress
    group.visible = inWindow(p, VIEW_WINDOWS.library, 0.06)
    if (!group.visible) return

    const reveal = rig.bookReveal
    const travel = easeInOut(clamp01(reveal / 0.6))
    const open = clamp01((reveal - 0.6) / 0.4)

    if (hero.current) {
      hero.current.position.set(
        SHELF_REST.x + (HERO_REST.x - SHELF_REST.x) * travel,
        SHELF_REST.y + (HERO_REST.y - SHELF_REST.y) * travel,
        SHELF_REST.z + (HERO_REST.z - SHELF_REST.z) * travel,
      )
      hero.current.rotation.y = -Math.PI / 2 + travel * (Math.PI / 2)
      hero.current.visible = reveal > 0.001
    }
    // two page halves hinge open to a 110° spread
    if (heroLeft.current) heroLeft.current.rotation.y = -open * 0.96
    if (heroRight.current) heroRight.current.rotation.y = open * 0.96
  })

  return (
    <group ref={root} visible={false}>
      <instancedMesh ref={books} args={[bookGeo, spineMat, BOOKS]} frustumCulled={false} />

      {/* shelf-edge light strip — this act's emissive hero */}
      <mesh geometry={bookGeo} material={stripMat} position={[-0.42, 2.95, 0]} scale={[0.06, 0.03, 2.6]} />

      {/* hero book */}
      <group ref={hero} visible={false}>
        <group ref={heroLeft}>
          <mesh geometry={bookGeo} material={clothMat} position={[-0.16, 0, 0]} scale={[0.32, 0.03, 0.24]} />
          <mesh geometry={bookGeo} material={pageMat} position={[-0.16, 0.02, 0]} scale={[0.3, 0.008, 0.22]} />
        </group>
        <group ref={heroRight}>
          <mesh geometry={bookGeo} material={clothMat} position={[0.16, 0, 0]} scale={[0.32, 0.03, 0.24]} />
          <mesh geometry={bookGeo} material={pageMat} position={[0.16, 0.02, 0]} scale={[0.3, 0.008, 0.22]} />
        </group>
        {/* gold foil title plate on the front cover */}
        <mesh geometry={bookGeo} material={goldMat} position={[0, 0.02, 0.13]} scale={[0.4, 0.004, 0.03]} />
      </group>
    </group>
  )
}
