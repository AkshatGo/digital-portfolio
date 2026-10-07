import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Group, PlaneGeometry } from 'three'
import { clamp01, palette } from '../art/palette'
import { makePaperMaterial } from '../shaders/paper'

export interface BookletUnfoldProps {
  focusT: MutableRefObject<number>
  /** half-width of the sheet, matched to the note size (0.42 m) */
  size?: number
}

const MAX_OPEN = 1.92 // ≈110°, the same spread as the Act 5 hero book

/**
 * §5 Act 4 step 2: the note unfolds — quad → open paper booklet — and the
 * diorama scales out of the spread. Two hinged halves, opening over the first
 * half of the focus ramp, then settling back to a soft backdrop behind the globe.
 */
export function BookletUnfold({ focusT, size = 0.42 }: BookletUnfoldProps) {
  const root = useRef<Group>(null)
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)

  const geo = useMemo(() => new PlaneGeometry(size, size * 0.92), [size])
  const mat = useMemo(
    () =>
      makePaperMaterial({
        color: palette.cream,
        amplitude: 0.008,
        rate: 1.2,
        side: DoubleSide,
        transparent: true,
      }),
    [],
  )
  const backMat = useMemo(
    () =>
      makePaperMaterial({
        color: palette.violet,
        amplitude: 0.004,
        side: DoubleSide,
        transparent: true,
      }),
    [],
  )

  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
      backMat.dispose()
    },
    [geo, mat, backMat],
  )

  useFrame(() => {
    const group = root.current
    if (!group) return
    const t = clamp01(focusT.current)
    group.visible = t > 0.002
    if (!group.visible) return

    // unfold over the first 50 % of the ramp, ease-out
    const open = 1 - Math.pow(1 - clamp01(t / 0.5), 3)
    if (left.current) left.current.rotation.y = -open * MAX_OPEN * 0.5
    if (right.current) right.current.rotation.y = open * MAX_OPEN * 0.5

    // settle to a backdrop so the globe reads as the subject
    const opacity = 1 - 0.45 * clamp01((t - 0.5) / 0.5)
    mat.opacity = opacity
    backMat.opacity = opacity
    group.scale.setScalar(1 + 0.12 * t)
  })

  return (
    <group ref={root} visible={false}>
      <group ref={left}>
        <mesh geometry={geo} material={mat} position={[-size / 2, 0, 0]} />
        <mesh geometry={geo} material={backMat} position={[-size / 2, -0.004, 0]} />
      </group>
      <group ref={right}>
        <mesh geometry={geo} material={mat} position={[size / 2, 0, 0]} />
        <mesh geometry={geo} material={backMat} position={[size / 2, -0.004, 0]} />
      </group>
    </group>
  )
}

/** exported for the audit's triangle-cap documentation */
export const BOOKLET_TRIS = 2 * 2 * 2
