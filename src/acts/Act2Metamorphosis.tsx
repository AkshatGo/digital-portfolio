import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
} from 'three'
import { palette } from '../art/palette'
import { DustBursts } from '../art/dust'
import { makeNeonMaterial } from '../shaders/neon'
import { rig } from '../rig/RigState'
import { VIEW_WINDOWS, inWindow } from '../rig/acts'

/* --- room dimensions (§5): 8 × 8 m floor, 3.2 m walls --- */
const ROOM = 8
const HALF = ROOM / 2
const WALL_H = 3.2
const APERTURE = 1.8 // ceiling hole the Act 6 exit pulls through

const easeOutBack = (x: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
const ramp = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x)

/** Furniture that drops in when the walls finish rising (§5 Act 2 step 4). */
interface DropItem {
  id: string
  /** final rest position of the item group origin */
  pos: [number, number, number]
  /** how far above it falls from */
  drop: number
  /** delay in progress units after wallsRise reaches 0.25 */
  delay: number
  /** dust burst offset, local to the item origin */
  dust: [number, number, number]
}

const DROPS: DropItem[] = [
  { id: 'desk', pos: [3.35, 0.74, 0.5], drop: 1.4, delay: 0, dust: [0, 0.02, 0] },
  { id: 'monitors', pos: [2.95, 1.05, 0.6], drop: 1.1, delay: 0.1, dust: [0, 0, 0] },
  { id: 'shelves', pos: [-3.85, 0.0, 0.4], drop: 1.3, delay: 0.2, dust: [0, 1.4, 0] },
  { id: 'board', pos: [0, 1.7, 3.9], drop: 1.6, delay: 0.3, dust: [0, 0, 0] },
]

/**
 * §5 Act 2 (CRITICAL). The room is pre-built and scale-matched; the crossfade
 * itself is authored on the master timeline (roomRise / notebookFade overlap by
 * 0.01 progress) — this component only maps those proxies onto transforms.
 * A true geometric morph is never attempted.
 */
export function Act2Metamorphosis() {
  const root = useRef<Group>(null)
  const wallRefs = useRef<(Mesh | null)[]>([])
  const dropRefs = useRef<Record<string, Group | null>>({})
  const fired = useRef<Record<string, boolean>>({})
  const dust = useMemo(() => new DustBursts(17), [])

  const geo = useMemo(() => {
    const wall = new BoxGeometry(ROOM, WALL_H, 0.12)
    wall.translate(0, WALL_H / 2, 0) // origin at the base ⇒ scale.y grows up from the floor
    const floor = new PlaneGeometry(ROOM, ROOM)
    const panelLong = new BoxGeometry(ROOM, 0.12, (ROOM - APERTURE) / 2)
    const panelShort = new BoxGeometry((ROOM - APERTURE) / 2, 0.12, APERTURE)
    const slab = new BoxGeometry(1, 1, 1)
    const plane = new PlaneGeometry(1, 1)
    return { wall, floor, panelLong, panelShort, slab, plane }
  }, [])

  const mat = useMemo(
    () => ({
      // DoubleSide: the box walls are seen from the inside of the room
      wall: new MeshStandardMaterial({ color: palette.cream, roughness: 0.95, side: DoubleSide }),
      floor: new MeshStandardMaterial({ color: '#2C2650', roughness: 0.7, metalness: 0.05 }),
      ceiling: new MeshStandardMaterial({
        color: '#EDE3D2',
        roughness: 1,
        side: DoubleSide,
      }),
      cork: new MeshStandardMaterial({ color: '#D9A15B', roughness: 1 }),
      wood: new MeshStandardMaterial({ color: '#8A5A3B', roughness: 0.8 }),
      metal: new MeshStandardMaterial({ color: '#4A4A63', roughness: 0.35, metalness: 0.7 }),
      neon: makeNeonMaterial(palette.mint),
    }),
    [],
  )

  useEffect(
    () => () => {
      Object.values(geo).forEach((g: BufferGeometry) => g.dispose())
      Object.values(mat).forEach((m) => m.dispose())
      dust.dispose()
    },
    [geo, mat, dust],
  )

  useFrame((_state, delta) => {
    const p = rig.progress
    const group = root.current
    if (!group) return

    group.visible = inWindow(p, VIEW_WINDOWS.room, 0.01)
    if (!group.visible) {
      dust.update(delta)
      return
    }

    /* scale-match: room grows from 0.96 → 1 as the notebook scales out */
    const rise = rig.roomRise
    group.scale.setScalar(0.96 + 0.04 * rise)

    /* walls rise from the floor with a 0.02 progress stagger */
    const walls = rig.wallsRise
    for (let i = 0; i < wallRefs.current.length; i++) {
      const mesh = wallRefs.current[i]
      if (!mesh) continue
      const local = ramp((walls - i * 0.02) / (1 - i * 0.02))
      mesh.scale.y = local
      mesh.visible = local > 0.001
    }

    /* furniture drops in with back.out(2) + a dust puff on landing */
    for (let i = 0; i < DROPS.length; i++) {
      const item = DROPS[i]
      const node = dropRefs.current[item.id]
      if (!node) continue
      const local = ramp((walls - 0.25 - item.delay) / 0.6)
      node.visible = local > 0.001
      node.position.y = item.pos[1] + (1 - easeOutBack(local)) * item.drop

      if (local > 0.85 && !fired.current[item.id]) {
        fired.current[item.id] = true
        dust.burst(
          item.pos[0] + item.dust[0],
          item.pos[1] + item.dust[1],
          item.pos[2] + item.dust[2],
          12,
        )
      } else if (local < 0.6 && fired.current[item.id]) {
        // scrubbing backwards re-arms the puff so the drop replays
        fired.current[item.id] = false
      }
    }

    dust.update(delta)
  })

  return (
    <group ref={root} visible={false}>
      {/* floor */}
      <mesh
        geometry={geo.floor}
        material={mat.floor}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      />

      {/* four walls: back (door implied), left (library), front (board), right (desk) */}
      {(
        [
          { pos: [0, 0, -HALF] as const, rot: [0, 0, 0] as const },
          { pos: [0, 0, HALF] as const, rot: [0, 0, 0] as const },
          { pos: [-HALF, 0, 0] as const, rot: [0, Math.PI / 2, 0] as const },
          { pos: [HALF, 0, 0] as const, rot: [0, Math.PI / 2, 0] as const },
        ] as const
      ).map((w, i) => (
        <mesh
          key={i}
          ref={(node) => {
            wallRefs.current[i] = node
          }}
          geometry={geo.wall}
          material={mat.wall}
          position={[w.pos[0], w.pos[1], w.pos[2]]}
          rotation={[w.rot[0], w.rot[1], w.rot[2]]}
          visible={false}
        />
      ))}

      {/* ceiling with a central aperture for the Act 6 pull-out */}
      <group position={[0, WALL_H, 0]}>
        <mesh
          geometry={geo.panelLong}
          material={mat.ceiling}
          position={[0, 0, -(APERTURE / 2 + (ROOM - APERTURE) / 4)]}
        />
        <mesh
          geometry={geo.panelLong}
          material={mat.ceiling}
          position={[0, 0, APERTURE / 2 + (ROOM - APERTURE) / 4]}
        />
        <mesh
          geometry={geo.panelShort}
          material={mat.ceiling}
          position={[-(ROOM + APERTURE) / 4, 0, 0]}
        />
        <mesh
          geometry={geo.panelShort}
          material={mat.ceiling}
          position={[(ROOM + APERTURE) / 4, 0, 0]}
        />
      </group>

      {/* neon floor strip: shader reveal, driven by rig.neon */}
      <mesh
        geometry={geo.plane}
        material={mat.neon}
        position={[0, 0.03, HALF - 0.12]}
        scale={[ROOM - 0.3, 0.12, 1]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <mesh
        geometry={geo.plane}
        material={mat.neon}
        position={[HALF - 0.12, 0.03, 0]}
        scale={[ROOM - 0.3, 0.12, 1]}
        rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
      />

      {/* --- furniture chassis (details live in Acts 3–5) --- */}

      <group
        ref={(n) => {
          dropRefs.current.desk = n
        }}
        visible={false}
      >
        <mesh geometry={geo.slab} material={mat.wood} scale={[1.1, 0.06, 3.2]} />
        <mesh geometry={geo.slab} material={mat.wood} scale={[0.08, 0.72, 0.08]} position={[0.45, -0.37, -1.4]} />
        <mesh geometry={geo.slab} material={mat.wood} scale={[0.08, 0.72, 0.08]} position={[0.45, -0.37, 1.4]} />
        <mesh geometry={geo.slab} material={mat.wood} scale={[0.08, 0.72, 0.08]} position={[-0.42, -0.37, -1.2]} />
        <mesh geometry={geo.slab} material={mat.wood} scale={[0.08, 0.72, 0.08]} position={[-0.42, -0.37, 1.2]} />
      </group>

      <group
        ref={(n) => {
          dropRefs.current.monitors = n
        }}
        visible={false}
      >
        <mesh geometry={geo.slab} material={mat.metal} position={[-0.35, 0.2, -0.34]} scale={[0.06, 0.4, 0.68]} />
        <mesh geometry={geo.slab} material={mat.metal} position={[-0.35, 0.2, 0.42]} scale={[0.06, 0.4, 0.68]} />
        <mesh geometry={geo.slab} material={mat.metal} position={[-0.35, -0.01, 0.04]} scale={[0.2, 0.03, 0.5]} />
      </group>

      <group
        ref={(n) => {
          dropRefs.current.shelves = n
        }}
        visible={false}
      >
        <mesh geometry={geo.slab} material={mat.wood} position={[-0.08, 1.5, 0]} scale={[0.06, 3, 2.6]} />
        {[0.5, 1.05, 1.6, 2.15, 2.7].map((y) => (
          <mesh
            key={y}
            geometry={geo.slab}
            material={mat.wood}
            position={[-0.25, y, 0]}
            scale={[0.42, 0.05, 2.6]}
          />
        ))}
      </group>

      <group
        ref={(n) => {
          dropRefs.current.board = n
        }}
        visible={false}
      >
        <mesh geometry={geo.slab} material={mat.cork} scale={[2.4, 1.2, 0.06]} />
        <mesh geometry={geo.slab} material={mat.wood} position={[0, 0, -0.05]} scale={[2.5, 1.3, 0.05]} />
      </group>

      <primitive object={dust.points} />
    </group>
  )
}
