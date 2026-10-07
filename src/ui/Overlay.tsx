import { useEffect } from 'react'
import { aboutText, identity, timeline } from '../content/about'
import { skillGroups } from '../content/skills'
import { ACTS } from '../rig/acts'
import { useStore } from '../store/useStore'
import { Terminal } from './Terminal'
import { ProjectDetail } from './ProjectDetail'
import { clamp01 } from '../art/palette'

/**
 * §2 rule 3: DOM overlays read the store's 10 Hz progress mirror — never the
 * frame loop. §5 Act 1 title parallaxes against the scroll and is gone by 0.12.
 */
export function Overlay() {
  const progress = useStore((s) => s.progress)
  const act = useStore((s) => s.act)
  const fps = useStore((s) => s.fps)
  const quality = useStore((s) => s.quality)
  const terminalOpen = useStore((s) => s.terminalOpen)
  const setTerminalOpen = useStore((s) => s.setTerminalOpen)
  const setMode = useStore((s) => s.setMode)
  const effects = useStore((s) => s.effects)
  const setEffects = useStore((s) => s.setEffects)
  const setFocusedProject = useStore((s) => s.setFocusedProject)

  /* keyboard: T toggles the terminal, Esc closes every overlay (§8) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
      if (e.key === 'Escape') {
        setTerminalOpen(false)
        setFocusedProject(null)
        return
      }
      if (!typing && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        setTerminalOpen(!useStore.getState().terminalOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTerminalOpen, setFocusedProject])

  const heroFade = clamp01(1 - progress / 0.12)
  const showOutro = progress > 0.93
  const showHint = progress < 0.05
  const showDesk = progress > 0.405 && progress < 0.515
  const showLibrary = progress > 0.755 && progress < 0.87

  const goTo = (target: number) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: max * target, behavior: 'smooth' })
  }

  return (
    <div className="overlay">
      <header className="site-header">
        <nav className="nav" aria-label="Portfolio navigation">
          <button className="brand" type="button" onClick={() => goTo(0)} aria-label="Back to the beginning">
            <span className="brand__mark">{identity.monogram}</span>
            <span className="brand__copy">
              <strong>{identity.name}</strong>
              <small>{identity.role}</small>
            </span>
          </button>
          <div className="nav__chapters">
            {ACTS.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={item.id === act.id ? 'is-active' : ''}
                onClick={() => goTo(item.start + 0.01)}
                aria-label={`Go to ${item.title}`}
                aria-current={item.id === act.id ? 'step' : undefined}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <em>{item.title.replace('The ', '')}</em>
              </button>
            ))}
          </div>
          <div className="nav__actions">
            <button type="button" onClick={() => setTerminalOpen(!terminalOpen)}>Terminal</button>
            <button type="button" onClick={() => setMode('2d', 'user')}>2D edition</button>
          </div>
        </nav>
        <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress * 100}%` }} /></div>
        <div
          className="hero"
          style={{
            opacity: heroFade,
            transform: `translateY(${progress * -80}px)`,
            visibility: heroFade === 0 ? 'hidden' : 'visible',
          }}
        >
          <p className="eyebrow"><span /> {identity.availability}</p>
          <h1>{identity.headline}</h1>
          <p className="hero__intro">I’m {identity.name}, a {identity.role.toLowerCase()}. Scroll to open my notebook and explore the work inside.</p>
          <div className="hero__meta"><span>{identity.location}</span><span>Design · Code · Motion</span></div>
        </div>
      </header>

      <aside className="chapter-card" aria-live="polite">
        <span className="chapter-card__number">{String(ACTS.indexOf(act) + 1).padStart(2, '0')}</span>
        <div><small>Now exploring</small><strong>{act.title}</strong></div>
        <span className="chapter-card__percent">{Math.round(progress * 100)}%</span>
      </aside>

      {showDesk && (
        <aside className="story-panel story-panel--right">
          <p className="eyebrow">What I work with</p>
          <h2>Craft on both sides of the screen.</h2>
          <div className="skill-columns">
            {skillGroups.map((group) => (
              <div key={group.group}><strong>{group.group}</strong><span>{group.skills.slice(0, 3).map((s) => s.name).join(' · ')}</span></div>
            ))}
          </div>
          <button type="button" onClick={() => setTerminalOpen(true)}>Open the working terminal</button>
        </aside>
      )}

      {showLibrary && (
        <aside className="story-panel story-panel--left">
          <p className="eyebrow">A little context</p>
          <h2>Curious by default. Precise by choice.</h2>
          <p>{aboutText}</p>
          <ol>{timeline.slice(0, 3).map((entry) => <li key={entry.year}><span>{entry.year}</span>{entry.what}</li>)}</ol>
        </aside>
      )}

      <footer>
        {showHint && (
          <button className="hint" type="button" onClick={() => goTo(0.19)}>
            <span>Scroll to enter</span><i />
          </button>
        )}
        {showOutro && (
          <div className="contact-card">
            <p className="eyebrow">The last page</p>
            <h2>Have an idea worth obsessing over?</h2>
            <p>I’m open to thoughtful collaborations, creative development and ambitious web experiences.</p>
            <div><a href={`mailto:${identity.email}`}>Start a conversation</a><button type="button" onClick={() => goTo(0)}>Reopen the notebook</button></div>
            <small>{identity.email} · {identity.location}</small>
          </div>
        )}
      </footer>

      <div className="experience-controls">
        <button type="button" aria-pressed={effects} onClick={() => setEffects(!effects)}>FX {effects ? 'on' : 'off'}</button>
        <span>{fps} fps · {quality}</span>
      </div>

      {terminalOpen && <Terminal />}
      <ProjectDetail />
    </div>
  )
}
