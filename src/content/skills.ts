export interface SkillGroup {
  group: string
  skills: { name: string; level: 0 | 1 | 2 | 3 }[]
}

export const skillGroups: SkillGroup[] = [
  {
    group: '3D & graphics',
    skills: [
      { name: 'three.js / WebGL', level: 3 },
      { name: 'GLSL shaders', level: 3 },
      { name: 'Blender / glTF pipeline', level: 2 },
      { name: 'postprocessing', level: 2 },
    ],
  },
  {
    group: 'Front-end',
    skills: [
      { name: 'React + TypeScript', level: 3 },
      { name: 'scroll choreography (gsap)', level: 3 },
      { name: 'state design (zustand)', level: 2 },
      { name: 'accessibility & fallbacks', level: 2 },
    ],
  },
  {
    group: 'Systems',
    skills: [
      { name: 'web performance budgets', level: 2 },
      { name: 'asset pipelines', level: 2 },
      { name: 'CI / spector audits', level: 1 },
    ],
  },
]

/** Terminal-friendly rendering of the skill tree (`skills --tree`). */
export function skillsTree(): string[] {
  const lines: string[] = []
  for (const g of skillGroups) {
    lines.push(g.group)
    g.skills.forEach((s, i) => {
      const branch = i === g.skills.length - 1 ? '└─' : '├─'
      lines.push(`  ${branch} ${s.name} ${'●'.repeat(s.level)}${'○'.repeat(3 - s.level)}`)
    })
  }
  return lines
}
