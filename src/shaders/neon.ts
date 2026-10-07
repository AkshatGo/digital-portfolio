import { AdditiveBlending, Color, ShaderMaterial } from 'three'
import { uTime } from '../rig/RigState'

/** Written once per frame by ScrollRig from rig.neon. */
export const uNeonProgress = { value: 0 }

/**
 * §7 `neonDraw`: the floor strip reveals left→right with a bright head that
 * travels with the reveal. Transparent + additive so it feeds bloom directly.
 */
export function makeNeonMaterial(color = 0x4ecdc4): ShaderMaterial {
  const tint = new Color(color)
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime,
      uProgress: uNeonProgress,
      uColor: { value: [tint.r, tint.g, tint.b] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uProgress;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        if (vUv.x > uProgress) discard;
        float core = smoothstep(0.5, 0.0, abs(vUv.y - 0.5) * 2.0);
        float head = exp(-(uProgress - vUv.x) * 16.0);
        float pulse = 0.78 + 0.22 * sin(uTime * 2.0 - vUv.x * 12.0);
        float a = 0.5 * core * pulse + head * 1.5;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
  })
}
