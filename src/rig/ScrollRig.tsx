import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, Quaternion, Vector3, type PerspectiveCamera } from 'three'
import { buildMasterTimeline } from './MasterTimeline'
import { rig, uScroll, uTime, uWind } from './RigState'
import { sampleCameraPos } from './cameraPath'
import { clamp, dampFactor } from '../art/palette'
import { useStore } from '../store/useStore'
import { LABELS } from './acts'

/* pooled — zero allocation inside useFrame (§10) */
const _pos = new Vector3()
const _look = new Vector3()
const _dir = new Vector3()
const _euler = new Euler()
const _quat = new Quaternion()

/** Parallax limits from §4: ±15° yaw, ±8° pitch, lerped at ~5 %/frame. */
const YAW_LIMIT = (15 * Math.PI) / 180
const PITCH_LIMIT = (8 * Math.PI) / 180

/**
 * §2 rule 2: useFrame runs exactly two things here — scrub the master timeline
 * and place the camera from the rig proxies. Everything else in the scene reads
 * the `rig` singleton and does pooled math only.
 */
export function ScrollRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const master = useMemo(() => buildMasterTimeline(rig), [])

  const prevProgress = useRef(0)
  const frames = useRef(0)
  const frameTime = useRef(0)
  const sinceReport = useRef(0)

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)

    /* ---- scrub the master timeline: fully reversible, no one-shot tweens -- */
    master.tl.time(rig.progress * master.duration)
    rig.time = state.clock.elapsedTime
    uTime.value = rig.time
    uScroll.value = rig.progress

    /* ---- scroll weather: |delta| normalised, smoothed over 300 ms --------- */
    const dProgress = Math.abs(rig.progress - prevProgress.current)
    prevProgress.current = rig.progress
    rig.scrollVel = dProgress / Math.max(delta, 1e-4)
    const raw = clamp(dProgress / 0.012, 0, 1)
    rig.wind += (raw - rig.wind) * dampFactor(delta, 0.3)
    uWind.value = rig.wind

    /* ---- camera: the spline owns the base position, nothing else ---------- */
    const store = useStore.getState()
    const flying = store.focusedProject !== null
    const inFlyinBand = rig.progress > LABELS.flyin && rig.progress < LABELS.library

    if (!flying) {
      sampleCameraPos(rig.posT, _pos)

      const parallaxAllowed = store.quality !== 'low' && !inFlyinBand
      const targetYaw = parallaxAllowed ? state.pointer.x * YAW_LIMIT : 0
      const targetPitch = parallaxAllowed ? -state.pointer.y * PITCH_LIMIT : 0
      const k = 1 - Math.pow(0.95, delta * 60) // 5 %/frame, frame-rate independent
      rig.parallaxYaw += (targetYaw - rig.parallaxYaw) * k
      rig.parallaxPitch += (targetPitch - rig.parallaxPitch) * k

      _look.set(rig.look.x, rig.look.y, rig.look.z)
      _dir.copy(_pos).sub(_look)
      _euler.set(rig.parallaxPitch, rig.parallaxYaw, 0)
      _quat.setFromEuler(_euler)
      _dir.applyQuaternion(_quat)
      camera.position.copy(_look).add(_dir)
      camera.lookAt(_look)
    }

    if (Math.abs(camera.fov - rig.fov) > 0.01) {
      camera.fov = rig.fov
      camera.updateProjectionMatrix()
    }

    /* ---- fps readout + one-way quality auto-tune -------------------------- */
    frames.current++
    frameTime.current += delta
    sinceReport.current += delta
    if (sinceReport.current >= 0.5) {
      const fps = frames.current / frameTime.current
      store.setFps(Math.round(fps))
      if (frames.current > 20 && fps < 30 && store.quality === 'high') {
        store.setQuality('mid')
        store.setDpr(1.25)
      } else if (frames.current > 20 && fps < 24 && store.quality === 'mid') {
        // §8: mobile low-tier falls back to the DOM story
        store.setMode('2d', 'low-tier')
      }
      frames.current = 0
      frameTime.current = 0
      sinceReport.current = 0
    }
  })

  return null
}
