export interface Project {
  id: string // kebab-case
  title: string
  type: 'web' | '3d' | 'tool' | 'experiment'
  noteColor: string // hex — sticky color
  tagline: string // <= 48 chars, on the note
  summary: string
  outcome: string
  stack: string[]
  role: string
  year: string
  links: { demo?: string; repo?: string; case?: string }
  globeScene: string // module name of miniature diorama
  threadTo?: string[] // ids of related projects (red thread)
}

/** Note colour is chosen by type; keep in sync with the palette. */
export const typeColor: Record<Project['type'], string> = {
  web: '#FFD166', // sun
  '3d': '#7C5CFF', // violet
  tool: '#4ECDC4', // mint
  experiment: '#FF6B6B', // coral
}

export const projects: Project[] = [
  {
    id: 'notebook-valley',
    title: 'The Notebook Valley',
    type: '3d',
    noteColor: typeColor['3d'],
    tagline: 'A portfolio that opens like a book',
    summary: 'A cinematic, scroll-driven portfolio where a notebook unfolds into a room and every object becomes part of the story.',
    outcome: 'One continuous WebGL scene, six reversible acts and an accessible 2D edition.',
    stack: ['three.js', 'react-three-fiber', 'gsap', 'glsl'],
    role: 'Design + engineering',
    year: '2026',
    links: {},
    globeScene: 'NotebookGlobe',
    threadTo: ['snow-globe-engine'],
  },
  {
    id: 'snow-globe-engine',
    title: 'Snow-Globe Engine',
    type: 'tool',
    noteColor: typeColor.tool,
    tagline: 'Tiny dioramas from one glTF file',
    summary: 'A compact rendering system for turning small 3D scenes into responsive, interactive project showcases.',
    outcome: 'Reusable scene loading, constrained orbit controls and a strict 5k-triangle budget.',
    stack: ['three.js', 'meshopt', 'vite'],
    role: 'Author',
    year: '2025',
    links: {},
    globeScene: 'GlobeEngine',
    threadTo: ['notebook-valley'],
  },
  {
    id: 'corkboard',
    title: 'Corkboard',
    type: 'web',
    noteColor: typeColor.web,
    tagline: 'Notes that thread themselves together',
    summary: 'A spatial idea board where related notes reveal their connections instead of disappearing into folders.',
    outcome: 'Fast canvas interactions with an intentionally tactile, desk-like feel.',
    stack: ['react', 'zustand', 'canvas'],
    role: 'Front-end lead',
    year: '2025',
    links: {},
    globeScene: 'CorkboardGlobe',
    threadTo: ['notebook-valley'],
  },
  {
    id: 'inkwell',
    title: 'Inkwell',
    type: 'tool',
    noteColor: typeColor.tool,
    tagline: 'Compile prose into a print layout',
    summary: 'A writing-to-layout experiment that treats typography and structure as part of the authoring process.',
    outcome: 'A focused command-line workflow for repeatable, publication-ready output.',
    stack: ['rust', 'typst', 'cli'],
    role: 'Creator',
    year: '2024',
    links: {},
    globeScene: 'InkwellGlobe',
  },
  {
    id: 'firefly-lab',
    title: 'Firefly Lab',
    type: 'experiment',
    noteColor: typeColor.experiment,
    tagline: '300,000 particles, one shader',
    summary: 'A real-time study in scale, light and motion built around one highly tuned particle pipeline.',
    outcome: 'A dense, responsive visual system that stays playful under tight performance constraints.',
    stack: ['webgpu', 'wgsl', 'three.js'],
    role: 'Experimenter',
    year: '2024',
    links: {},
    globeScene: 'FireflyGlobe',
    threadTo: ['notebook-valley'],
  },
]

export const projectById = (id: string): Project | undefined => projects.find((p) => p.id === id)
