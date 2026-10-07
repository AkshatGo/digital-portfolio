import { AdditiveBlending, Color, ShaderMaterial } from 'three'
import { uTime, uWind } from '../rig/RigState'

/**
 * §5 Act 1: 300 fireflies, additive, custom points shader. Motion lives in the
 * vertex shader so the CPU never touches 300 positions per frame.
 */
export function makeFireflyMaterial(color = 0xffd166): ShaderMaterial {
  const tint = new Color(color)
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime, uWind, uColor: { value: [tint.r, tint.g, tint.b] } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uWind;
      varying float vFade;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * aSpeed + aPhase) * 0.6;
        p.x += cos(uTime * aSpeed * 0.7 + aPhase * 1.3) * 0.5;
        p.z += sin(uTime * aSpeed * 0.9 + aPhase * 2.1) * 0.4;
        p.xy *= 1.0 + uWind * 0.04;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (260.0 / max(-mv.z, 0.001)) * (1.0 + 0.45 * sin(uTime * 3.0 + aPhase * 6.0));
        vFade = 0.5 + 0.5 * sin(uTime * 2.3 + aPhase * 5.0);
      }
    `,
    // no explicit precision here: three injects the same precision into the
    // vertex stage, and a mismatch on shared uniforms (uTime/uWind) makes the
    // program fail VALIDATE_STATUS on some drivers.
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a *= a;
        gl_FragColor = vec4(uColor * a * vFade * 2.2, a * vFade);
      }
    `,
  })
}

/**
 * §7 `starfield` + §5 Act 6 signature star: aKind = 0 ambient, 1 signature.
 * The signature star grows and pulses so the visitor can find themselves.
 */
export function makeStarMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime, uPulse: { value: 0 }, uColor: { value: [1, 0.965, 0.898] } },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSize;
      attribute float aKind;
      uniform float uTime;
      uniform float uPulse;
      varying float vTwinkle;
      varying float vKind;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float twinkle = 0.6 + 0.4 * sin(uTime * (1.1 + aPhase) + aPhase * 9.0);
        float boost = aKind > 0.5 ? (1.0 + 2.2 * uPulse) : 1.0;
        gl_PointSize = aSize * boost * twinkle * (300.0 / max(-mv.z, 0.001));
        vTwinkle = twinkle;
        vKind = aKind;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPulse;
      varying float vTwinkle;
      varying float vKind;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a *= a;
        vec3 c = mix(uColor, vec3(0.486, 0.361, 1.0), vKind);
        c = mix(c, vec3(1.0, 0.82, 1.0), vKind * uPulse * 0.7);
        gl_FragColor = vec4(c * a * vTwinkle * (1.6 + 2.0 * vKind * uPulse), a * vTwinkle);
      }
    `,
  })
}
