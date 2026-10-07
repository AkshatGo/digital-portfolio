import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { makeRng, palette } from '../art/palette'
import { uTime } from '../rig/RigState'

const SWARM = 900

/** swarm shader: curl-ish drift around the core, additive, twinkling */
function makeSwarmMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime, uColor: { value: [1, 0.82, 0.4] } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aSize;
      uniform float uTime;
      varying float vFade;
      void main() {
        float t = uTime * aSpeed + aPhase;
        vec3 p = position;
        float d = length(p);
        p += normalize(p + vec3(0.001)) * sin(t) * 0.012;
        p.y += cos(t * 1.3) * 0.008;
        p.xz *= 1.0 + 0.05 * sin(t * 0.6);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (240.0 / max(-mv.z, 0.001));
        vFade = 0.45 + 0.55 * sin(t * 2.1);
        vFade *= smoothstep(0.0, 0.06, d);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vFade;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        a *= a;
        gl_FragColor = vec4(uColor * a * vFade * 1.8, a * vFade);
      }
    `,
  })
}

/** the project that owns this globe: Firefly Lab */
export function FireflyGlobe() {
  const spin = useRef<Group>(null)

  const swarmGeo = useMemo(() => {
    const rng = makeRng(311)
    const positions = new Float32Array(SWARM * 3)
    const phase = new Float32Array(SWARM)
    const speed = new Float32Array(SWARM)
    const size = new Float32Array(SWARM)
    for (let i = 0; i < SWARM; i++) {
      // shell-biased distribution so the core stays readable
      const r = 0.035 + Math.pow(rng(), 0.6) * 0.06
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.8
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      phase[i] = rng() * Math.PI * 2
      speed[i] = 0.4 + rng() * 1.6
      size[i] = 0.18 + rng() * 0.5
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(positions, 3))
    g.setAttribute('aPhase', new BufferAttribute(phase, 1))
    g.setAttribute('aSpeed', new BufferAttribute(speed, 1))
    g.setAttribute('aSize', new BufferAttribute(size, 1))
    return g
  }, [])

  const swarmMat = useMemo(() => makeSwarmMaterial(), [])
  const coreGeo = useMemo(() => new SphereGeometry(0.022, 18, 12), [])
  const coreMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#2A1200',
        emissive: palette.sun,
        emissiveIntensity: 2.2,
        roughness: 0.3,
      }),
    [],
  )
  const cageGeo = useMemo(() => new TorusGeometry(0.092, 0.0016, 5, 30), [])
  const cageMat = useMemo(
    () => new MeshBasicMaterial({ color: palette.coral, transparent: true, opacity: 0.55 }),
    [],
  )

  useEffect(
    () => () => {
      swarmGeo.dispose()
      swarmMat.dispose()
      coreGeo.dispose()
      coreMat.dispose()
      cageGeo.dispose()
      cageMat.dispose()
    },
    [swarmGeo, swarmMat, coreGeo, coreMat, cageGeo, cageMat],
  )

  useFrame((state) => {
    if (spin.current) {
      spin.current.rotation.y = state.clock.elapsedTime * 0.25
      spin.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.15
    }
  })

  return (
    <group ref={spin} position={[0, 0.085, 0]}>
      <mesh geometry={coreGeo} material={coreMat} />
      <points geometry={swarmGeo} material={swarmMat} frustumCulled={false} />
      <mesh geometry={cageGeo} material={cageMat} rotation={[Math.PI / 2.6, 0.4, 0]} />
      <mesh geometry={cageGeo} material={cageMat} rotation={[0.4, 1.2, Math.PI / 2]} />
    </group>
  )
}
