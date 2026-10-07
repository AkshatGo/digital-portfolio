import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { dampFactor, hexToNumber, palette } from '../art/palette'
import { makePaperMaterial } from '../shaders/paper'
import { projectById, projects } from '../content/projects'
import { rig } from '../rig/RigState'
import { VIEW_WINDOWS, inWindow } from '../rig/acts'
import { useStore } from '../store/useStore'
import { BookletUnfold } from '../dioramas/BookletUnfold'
import { SnowGlobe } from '../dioramas/SnowGlobe'
import { DIORAMAS, isDioramaName, type DioramaName } from '../dioramas/registry'

/* board plane: 2.4 × 1.2 m cork on the front wall */
const BOARD_Z = 3.86
const BOARD_Y = 1.7
/* note size: the plan's 0.09 m reads as a printed measurement error — at the
   Act 4 camera distance a 9 cm note would be sub-pixel, so notes are 0.42 m.
   Recorded as a deviation in README.md. */
const NOTE = 0.42
/* globe sits in front of the board; the camera stops 1.1 m further out so a
   0.34 m globe fills ~40 % of frame height at fov 42 (§5's 0.35 m fly-in
   distance was authored for 9 cm notes — see README deviations). */
const GLOBE_Z = BOARD_Z - 0.45
const BOOKLET_Z = BOARD_Z - 0.16
const CAMERA_OFFSET = 1.1
const ORBIT_LIMIT = (30 * Math.PI) / 180

/** authored note layout, hand-tuned so the red threads do not cross centres */
const NOTE_LAYOUT: [number, number][] = [
  [-0.72, 0.28],
  [0.08, 0.34],
  [0.78, 0.16],
  [-0.42, -0.34],
  [0.5, -0.3],
]

const ramp = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x)

interface OrbitState {
  yaw: number
  pitch: number
  targetYaw: number
  targetPitch: number
  dragging: boolean
  lastX: number
  lastY: number
}

/** §12 low-tier mitigation: a flat poster card stands in for the diorama. */
function PosterCard({ color }: { color: string }) {
  const geo = useMemo(() => new PlaneGeometry(0.36, 0.26), [])
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: hexToNumber(color),
        emissive: hexToNumber(color),
        emissiveIntensity: 0.45,
        side: DoubleSide,
        roughness: 0.6,
      }),
    [color],
  )
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <mesh geometry={geo} material={mat} />
}

/**
 * §5 Act 4 — Soft board (0.55–0.72).
 * Notes are one InstancedMesh (per-instance colour by project type) with a hover
 * lift computed in useFrame from a single hovered index. Clicking a note locks
 * the scrub, flies the camera in, unfolds the note into an open booklet and
 * scales the project's snow-globe diorama out of it; drag orbits the diorama
 * within ±30°.
 */
export function Act4Board() {
  const root = useRef<Group>(null)
  const notes = useRef<InstancedMesh>(null)
  const pins = useRef<InstancedMesh>(null)
  const globeRoot = useRef<Group>(null)
  const orbitRoot = useRef<Group>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const hovered = useRef<number | null>(null)
  const lifts = useRef<Float32Array>(new Float32Array(projects.length))
  const focusPoint = useMemo(() => new Vector3(), [])
  const lookPoint = useMemo(() => new Vector3(), [])

  /* fly-in ramp + orbit state, read per frame (never React state) */
  const focusT = useRef(0)
  const orbit = useRef<OrbitState>({
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
  })
  const openIdRef = useRef<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const quality = useStore((s) => s.quality)
  const openProject = openId ? projectById(openId) : undefined
  const dioramaName: DioramaName | null =
    openProject && isDioramaName(openProject.globeScene) ? openProject.globeScene : null

  const noteGeo = useMemo(() => new PlaneGeometry(NOTE, NOTE), [])
  const pinGeo = useMemo(() => new SphereGeometry(0.018, 10, 8), [])
  const noteMat = useMemo(
    () =>
      makePaperMaterial({ color: palette.cream, amplitude: 0.006, rate: 1.4, side: DoubleSide }),
    [],
  )
  const pinMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: palette.sun,
        emissive: palette.sun,
        emissiveIntensity: 0.6,
        roughness: 0.4,
      }),
    [],
  )
  const threadMat = useMemo(() => new MeshStandardMaterial({ color: 0xc0392b, roughness: 0.9 }), [])

  const notePositions = useMemo(
    () =>
      projects.map((_, i) => {
        const [x, y] = NOTE_LAYOUT[i % NOTE_LAYOUT.length]
        return new Vector3(x, BOARD_Y + y, BOARD_Z + 0.012)
      }),
    [],
  )

  const threads = useMemo(() => {
    const byId = new Map(projects.map((p, i) => [p.id, i]))
    const out: TubeGeometry[] = []
    projects.forEach((p, i) => {
      for (const target of p.threadTo ?? []) {
        const j = byId.get(target)
        if (j === undefined || j <= i) continue
        const a = notePositions[i]
        const b = notePositions[j]
        const mid = a.clone().add(b).multiplyScalar(0.5)
        mid.z += 0.05
        mid.y -= a.distanceTo(b) * 0.22 // catenary sag
        out.push(new TubeGeometry(new CatmullRomCurve3([a.clone(), mid, b.clone()]), 18, 0.006, 6, false))
      }
    })
    return out
  }, [notePositions])

  useEffect(
    () => () => {
      noteGeo.dispose()
      pinGeo.dispose()
      noteMat.dispose()
      pinMat.dispose()
      threadMat.dispose()
      threads.forEach((t) => t.dispose())
    },
    [noteGeo, pinGeo, noteMat, pinMat, threadMat, threads],
  )

  /* static matrices + per-instance colours, written once */
  useLayoutEffect(() => {
    const noteMesh = notes.current
    const pinMesh = pins.current
    if (!noteMesh || !pinMesh) return
    const tint = new Color()
    for (let i = 0; i < projects.length; i++) {
      const pos = notePositions[i]

      dummy.position.copy(pos)
      // face the room (the board is on the +z wall, the visitor looks from −z)
      dummy.rotation.set(0, Math.PI, ((i % 3) - 1) * 0.05)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      noteMesh.setMatrixAt(i, dummy.matrix)
      tint.setHex(hexToNumber(projects[i].noteColor), 'srgb')
      noteMesh.setColorAt(i, tint)

      dummy.position.set(pos.x, pos.y + NOTE * 0.42, pos.z - 0.01)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      pinMesh.setMatrixAt(i, dummy.matrix)
    }
    noteMesh.instanceMatrix.needsUpdate = true
    pinMesh.instanceMatrix.needsUpdate = true
    if (noteMesh.instanceColor) noteMesh.instanceColor.needsUpdate = true
  }, [dummy, notePositions])

  /* §5 step 3: drag orbits the diorama, constrained to ±30° */
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('.detail, .terminal, .hud')) return
      const o = orbit.current
      o.dragging = true
      o.lastX = e.clientX
      o.lastY = e.clientY
    }
    const onMove = (e: PointerEvent) => {
      const o = orbit.current
      if (!o.dragging) return
      const dx = (e.clientX - o.lastX) / Math.max(window.innerWidth, 1)
      const dy = (e.clientY - o.lastY) / Math.max(window.innerHeight, 1)
      o.lastX = e.clientX
      o.lastY = e.clientY
      o.targetYaw = Math.max(-ORBIT_LIMIT, Math.min(ORBIT_LIMIT, o.targetYaw + dx * 3.2))
      o.targetPitch = Math.max(-ORBIT_LIMIT, Math.min(ORBIT_LIMIT, o.targetPitch + dy * 2.4))
    }
    const onUp = () => {
      orbit.current.dragging = false
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const onMoveNote = (e: ThreeEvent<PointerEvent>) => {
    hovered.current = e.instanceId ?? null
    useStore
      .getState()
      .setHoveredProject(e.instanceId !== undefined ? projects[e.instanceId].id : null)
    document.body.style.cursor = e.instanceId !== undefined ? 'pointer' : ''
  }

  const onOutNote = () => {
    hovered.current = null
    useStore.getState().setHoveredProject(null)
    document.body.style.cursor = ''
  }

  const onClickNote = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId === undefined) return
    const project = projects[e.instanceId]
    if (!project) return
    e.stopPropagation()
    useStore.getState().setFocusedProject(project.id)
  }

  useFrame((state, delta) => {
    const group = root.current
    if (!group) return
    const p = rig.progress
    const store = useStore.getState()
    const focused = store.focusedProject

    group.visible = inWindow(p, VIEW_WINDOWS.board, 0.08) || focused !== null
    if (!group.visible) return

    /* --- focus ramp: 1 while inside a note, 0 once released ---------------- */
    const focusTarget = focused ? 1 : 0
    focusT.current += (focusTarget - focusT.current) * dampFactor(delta, 0.14)
    if (Math.abs(focusT.current - focusTarget) < 0.004) focusT.current = focusTarget

    // mount on open, unmount only after the reverse animation finished
    if (focused && openIdRef.current !== focused) {
      openIdRef.current = focused
      setOpenId(focused)
    } else if (!focused && openIdRef.current && focusT.current === 0) {
      openIdRef.current = null
      setOpenId(null)
    }

    const focusedIndex = focused ? projects.findIndex((pr) => pr.id === focused) : -1
    const reveal = rig.boardReveal
    const mesh = notes.current

    if (mesh) {
      const k = dampFactor(delta, 0.12)
      for (let i = 0; i < projects.length; i++) {
        const isFocused = i === focusedIndex
        const target = hovered.current === i || isFocused ? 1 : 0
        lifts.current[i] += (target - lifts.current[i]) * k
        const lift = lifts.current[i]
        const pos = notePositions[i]
        dummy.position.copy(pos)
        dummy.position.z -= 0.012 + lift * 0.04 // lifts off the board along −z

        if (isFocused) {
          // the clicked note slides toward the visitor and grows into the booklet
          const ft = focusT.current
          dummy.position.z -= ft * 0.22
          dummy.scale.setScalar(1 + ft * 1.4)
          dummy.rotation.set(0, Math.PI - ft * 0.12, ((i % 3) - 1) * 0.05)
        } else {
          dummy.rotation.set(0, Math.PI, ((i % 3) - 1) * 0.05)
          dummy.scale.setScalar(0.6 + 0.4 * ramp((reveal - i * 0.04) / 0.4) + lift * 0.06)
        }
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    /* §6: one emissive hero per act — the pins hand the spotlight to the globe */
    pinMat.emissiveIntensity =
      (0.5 + reveal * 0.7 + Math.sin(state.clock.elapsedTime * 2) * 0.08) *
      (1 - 0.9 * focusT.current)

    /* --- the globe itself ------------------------------------------------- */
    const gt = focusT.current
    if (globeRoot.current) {
      globeRoot.current.visible = gt > 0.002
      if (focusedIndex >= 0) {
        const pos = notePositions[focusedIndex]
        globeRoot.current.position.set(pos.x, pos.y, GLOBE_Z)
      }
    }
    if (orbitRoot.current) {
      const o = orbit.current
      const ok = dampFactor(delta, 0.12)
      o.yaw += (o.targetYaw - o.yaw) * ok
      o.pitch += (o.targetPitch - o.pitch) * ok
      orbitRoot.current.rotation.set(o.pitch, o.yaw, 0)
    }

    /* --- fly-in: Act 4 owns the camera while a project is focused (§5) --- */
    if (focused && focusedIndex >= 0) {
      const pos = notePositions[focusedIndex]
      focusPoint.set(pos.x, pos.y, GLOBE_Z - CAMERA_OFFSET)
      lookPoint.set(pos.x, pos.y, GLOBE_Z)
      const cam = state.camera as PerspectiveCamera
      // §5 asks for a 0.9 s power3.inOut tween; an exponential damp with a
      // ~0.28 s time constant reaches ~95 % in 0.9 s and stays scrub-safe
      const k2 = dampFactor(delta, 0.28)
      cam.position.lerp(focusPoint, k2)
      rig.look.x += (lookPoint.x - rig.look.x) * k2
      rig.look.y += (lookPoint.y - rig.look.y) * k2
      rig.look.z += (lookPoint.z - rig.look.z) * k2
      cam.lookAt(lookPoint)
    }
  })

  return (
    <group ref={root} visible={false}>
      <instancedMesh
        ref={notes}
        args={[noteGeo, noteMat, projects.length]}
        onPointerMove={onMoveNote}
        onPointerOut={onOutNote}
        onClick={onClickNote}
        frustumCulled={false}
      />
      <instancedMesh ref={pins} args={[pinGeo, pinMat, projects.length]} frustumCulled={false} />
      {threads.map((t, i) => (
        <mesh key={i} geometry={t} material={threadMat} />
      ))}

      {openProject && (
        <group ref={globeRoot} visible={false}>
          {/* face the visitor: the board is on the +z wall, the camera sits at −z */}
          <group rotation={[0, Math.PI, 0]}>
            <group position={[0, 0, GLOBE_Z - BOOKLET_Z]}>
              <BookletUnfold focusT={focusT as MutableRefObject<number>} />
            </group>
            <group ref={orbitRoot}>
              <Suspense fallback={null}>
                {quality === 'low' || !dioramaName ? (
                  <PosterCard color={openProject.noteColor} />
                ) : (
                  <SnowGlobe focusT={focusT as MutableRefObject<number>}>
                    {(() => {
                      const Mini = DIORAMAS[dioramaName]
                      return <Mini />
                    })()}
                  </SnowGlobe>
                )}
              </Suspense>
            </group>
          </group>
        </group>
      )}
    </group>
  )
}
