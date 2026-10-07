import { MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three'
import { uTime, uWind } from '../rig/RigState'

export interface PaperOptions extends MeshStandardMaterialParameters {
  /** max displacement in local units; pages breathe, they do not flap */
  amplitude?: number
  /** flutter frequency multiplier */
  rate?: number
}

/**
 * §7 `paperFlutter`: notebook page edges + sticky-note corners breathe with
 * uWind. Injected via onBeforeCompile so the material keeps full PBR lighting.
 */
export function makePaperMaterial(options: PaperOptions = {}): MeshStandardMaterial {
  const { amplitude = 0.004, rate = 1.7, ...rest } = options
  const material = new MeshStandardMaterial({ roughness: 0.88, metalness: 0, ...rest })
  const uAmp = { value: amplitude }
  const uRate = { value: rate }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = uWind
    shader.uniforms.uTime = uTime
    shader.uniforms.uAmp = uAmp
    shader.uniforms.uRate = uRate

    shader.vertexShader = `
      uniform float uWind;
      uniform float uTime;
      uniform float uAmp;
      uniform float uRate;
    ${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float edge = pow(clamp(uv.y, 0.0, 1.0), 2.0);
       float ripple = sin(uTime * uRate + position.x * 8.0 + position.y * 3.0);
       float gust = 0.65 + 0.35 * sin(uTime * 0.37);
       transformed.z += ripple * uWind * gust * uAmp * edge;`,
    )
  }
  material.customProgramCacheKey = () => 'nv-paper-flutter'

  return material
}
