import { BackSide, ShaderMaterial } from 'three'
import { uTime } from '../rig/RigState'

/** uNight = 0 day valley, 1 starry night (Act 6) */
export const uNight = { value: 0 }

/**
 * §5 Act 1: gradient sky dome (violet → coral → cream, top-down), reused in
 * Act 6 with the same geometry lerped towards ink/violet night colours.
 */
export function makeSkyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uNight, uTime },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uNight;
      uniform float uTime;
      varying vec3 vDir;

      // day: violet (top) -> coral (mid) -> cream (horizon)
      const vec3 DAY_TOP = vec3(0.486, 0.361, 1.0);
      const vec3 DAY_MID = vec3(1.0, 0.420, 0.420);
      const vec3 DAY_LOW = vec3(1.0, 0.965, 0.898);

      // night: deep ink (top) -> violet (mid) -> indigo glow (horizon)
      const vec3 NIGHT_TOP = vec3(0.020, 0.024, 0.059);
      const vec3 NIGHT_MID = vec3(0.082, 0.059, 0.208);
      const vec3 NIGHT_LOW = vec3(0.176, 0.106, 0.412);

      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        float lower = smoothstep(0.28, 0.52, h);
        float upper = smoothstep(0.5, 0.92, h);

        vec3 day = mix(DAY_LOW, DAY_MID, lower);
        day = mix(day, DAY_TOP, upper);

        vec3 night = mix(NIGHT_LOW, NIGHT_MID, lower);
        night = mix(night, NIGHT_TOP, upper);

        vec3 color = mix(day, night, uNight);

        // very slow breathing so the dome never reads as a flat fill
        color *= 0.97 + 0.03 * sin(uTime * 0.12 + h * 3.0);

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
}
