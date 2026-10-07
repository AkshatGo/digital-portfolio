import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import { Scene } from './scene/Scene'
import { exposeDevtools } from './systems/devtools'
import { Overlay } from './ui/Overlay'
import { Static2D } from './ui/Static2D'
import { SCROLL_BODY_ID, useScrollTracking } from './rig/useScroll'
import { useModeBootstrap } from './utils/useMode'
import { useStore } from './store/useStore'

/**
 * §2 rule 1: a single fixed canvas at z-index 0, plus one tall empty div at
 * z-index −1 that supplies the document height every ScrollTrigger reads.
 */
export default function App() {
  const mode = useStore((s) => s.mode)
  const quality = useStore((s) => s.quality)
  const dpr = useStore((s) => s.dpr)

  useModeBootstrap()
  useScrollTracking(mode === '3d')

  if (mode === '2d') return <Static2D />

  const maxDpr = quality === 'high' ? Math.min(2, dpr) : Math.min(1.25, dpr)

  return (
    <>
      <div className="scroll-body" id={SCROLL_BODY_ID} aria-hidden="true" />
      <div className="canvas-layer">
        <Canvas
          dpr={[1, maxDpr]}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
          }}
          camera={{ position: [0, 1.2, -6.5], fov: 50, near: 0.1, far: 400 }}
          onCreated={({ gl }) => {
            gl.toneMapping = ACESFilmicToneMapping
            gl.toneMappingExposure = 1.1
            exposeDevtools(gl)
          }}
        >
          <Scene />
        </Canvas>
      </div>
      <Overlay />
    </>
  )
}
