import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { projects } from '../content/projects'

/**
 * §5 Act 4: "each project has a miniature scene module, ≤ 5 k tris, lazy-loaded
 * at Act 2 end". The registry keys off `Project.globeScene` so content drives
 * which miniature appears — adding a project never touches Act4Board.
 */
export const DIORAMA_LOADERS = {
  NotebookGlobe: () => import('./NotebookGlobe'),
  GlobeEngine: () => import('./GlobeEngine'),
  CorkboardGlobe: () => import('./CorkboardGlobe'),
  InkwellGlobe: () => import('./InkwellGlobe'),
  FireflyGlobe: () => import('./FireflyGlobe'),
} as const

export type DioramaName = keyof typeof DIORAMA_LOADERS

export const DIORAMAS: Record<DioramaName, LazyExoticComponent<ComponentType>> = {
  NotebookGlobe: lazy(() =>
    DIORAMA_LOADERS.NotebookGlobe().then((m) => ({ default: m.NotebookGlobe })),
  ),
  GlobeEngine: lazy(() => DIORAMA_LOADERS.GlobeEngine().then((m) => ({ default: m.GlobeEngine }))),
  CorkboardGlobe: lazy(() =>
    DIORAMA_LOADERS.CorkboardGlobe().then((m) => ({ default: m.CorkboardGlobe })),
  ),
  InkwellGlobe: lazy(() =>
    DIORAMA_LOADERS.InkwellGlobe().then((m) => ({ default: m.InkwellGlobe })),
  ),
  FireflyGlobe: lazy(() =>
    DIORAMA_LOADERS.FireflyGlobe().then((m) => ({ default: m.FireflyGlobe })),
  ),
}

export function isDioramaName(name: string): name is DioramaName {
  return name in DIORAMA_LOADERS
}

/**
 * §10: the diorama chunks are fetched during Act 2 so the first note click
 * never waits on the network. Idempotent — the module cache makes later calls
 * free, and failures are swallowed because the poster fallback still works.
 */
export function preloadDioramas(): void {
  for (const loader of Object.values(DIORAMA_LOADERS)) {
    void loader().catch(() => undefined)
  }
}

/** every globeScene referenced by content actually has a module */
export function missingDioramas(): string[] {
  return projects.map((p) => p.globeScene).filter((name) => !isDioramaName(name))
}
