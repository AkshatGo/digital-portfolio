import { useEffect } from 'react'
import { projectById } from '../content/projects'
import { useStore } from '../store/useStore'

/**
 * §5 Act 4 step 3: while flying into a note, the HUD shows project copy and
 * links in crisp DOM text — long copy is never rendered as 3D geometry.
 * Esc, the close button and a downward scroll all release the fly-in.
 */
export function ProjectDetail() {
  const focused = useStore((s) => s.focusedProject)
  const setFocusedProject = useStore((s) => s.setFocusedProject)
  const project = focused ? projectById(focused) : undefined

  /* lock the page scroll while inside a note, release on exit */
  useEffect(() => {
    if (!focused) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const release = () => setFocusedProject(null)
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) release()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') release()
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [focused, setFocusedProject])

  if (!project) return null

  return (
    <aside className="detail" aria-live="polite">
      <div className="meta">
        {project.type} · {project.role} · {project.year}
      </div>
      <h2>{project.title}</h2>
      <p>{project.summary}</p>
      <p className="outcome">{project.outcome}</p>
      <div className="stack">
        {project.stack.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="links">
        {project.links.demo && (
          <a href={project.links.demo} target="_blank" rel="noreferrer noopener">
            Live demo
          </a>
        )}
        {project.links.repo && (
          <a href={project.links.repo} target="_blank" rel="noreferrer noopener">
            Repository
          </a>
        )}
        {project.links.case && (
          <a href={project.links.case} target="_blank" rel="noreferrer noopener">
            Case study
          </a>
        )}
        {!project.links.demo && !project.links.repo && !project.links.case && (
          <span className="detail__status">Independent concept</span>
        )}
        <button type="button" onClick={() => setFocusedProject(null)}>
          Close (esc)
        </button>
      </div>
    </aside>
  )
}
