import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Color,
  MeshBasicMaterial,
  PointLight,
  Raycaster,
  Vector2,
  type Scene as ThreeScene,
} from 'three'
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing'
import type { BloomEffect } from 'postprocessing'
import { palette, scratch } from '../art/palette'
import { rig } from '../rig/RigState'
import { ScrollRig } from '../rig/ScrollRig'
import { Act1Valley } from '../acts/Act1Valley'
import { Act2Metamorphosis } from '../acts/Act2Metamorphosis'
import { StreamedActs } from './StreamedActs'
import { DioramaPreload } from '../dioramas/DioramaPreload'
import { HeroNotebook } from '../acts/HeroNotebook'
import { useStore } from '../store/useStore'

/** §8 cursor point-light: follows the pointer ray at 1.5 m depth. */
function CursorLight() {
  const ref = useRef<PointLight>(null)
  const ray = useMemo(() => new Raycaster(), [])
  const ndc = useMemo(() => new Vector2(), [])

  useFrame(({ camera, pointer }) => {
    const light = ref.current
    if (!light) return
    ndc.copy(pointer)
    ray.setFromCamera(ndc, camera)
    ray.ray.at(1.5, scratch.v1)
    light.position.copy(scratch.v1)
  })

  return (
    <pointLight
      ref={ref}
      color={palette.violet}
      intensity={0.8}
      distance={4}
      decay={2}
    />
  )
}

/** §8 blueprint mode: scene-wide wireframe override behind the `blueprint` command. */
function BlueprintMode() {
  const scene = useThree((s) => s.scene) as ThreeScene
  const wireframe = useStore((s) => s.wireframe)
  const material = useMemo(
    () => new MeshBasicMaterial({ wireframe: true, color: palette.mint, fog: false }),
    [],
  )
  const background = useMemo(() => new Color(0x05060f), [])

  useEffect(() => {
    scene.overrideMaterial = wireframe ? material : null
    scene.background = wireframe ? background : null
    return () => {
      scene.overrideMaterial = null
    }
  }, [wireframe, material, background, scene])

  return null
}

/**
 * §6 tone mapping / post: ACESFilmic + bloom (threshold 0.85, strength 0.55,
 * radius 0.6) + vignette 0.3 + SMAA. Bloom strength is spiked by rig.flash so
 * the Act 2 crossfade gets masked by light rather than read as a cut.
 */
function PostFX() {
  const quality = useStore((s) => s.quality)
  const effects = useStore((s) => s.effects)
  const bloom = useRef<BloomEffect>(null)

  useFrame(() => {
    if (bloom.current) bloom.current.intensity = 0.55 + rig.flash * 1.7
  })

  if (quality === 'low' || !effects) return null

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        ref={bloom}
        intensity={0.55}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.2}
        mipmapBlur
        radius={0.6}
      />
      <Vignette offset={0.3} darkness={0.3} />
      <SMAA />
    </EffectComposer>
  )
}

export function Scene() {
  return (
    <>
      {/* §5 Act 1 environment: exponential fog keyed to the violet palette */}
      <fogExp2 attach="fog" args={['#2D1B69', 0.028]} />

      {/* §6 lighting: warm key + violet hemisphere fill */}
      <hemisphereLight args={[palette.violet, palette.ink, 0.5]} />
      <directionalLight position={[6, 9, -4]} intensity={1.1} color="#FFE0B0" />
      <ambientLight intensity={0.18} color={palette.cream} />

      <CursorLight />
      <ScrollRig />
      <DioramaPreload />

      <Act1Valley />
      <HeroNotebook />
      <Act2Metamorphosis />
      <StreamedActs />

      <BlueprintMode />
      <PostFX />
    </>
  )
}
