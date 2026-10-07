import type { CSSProperties } from 'react'
import { aboutText, identity, timeline } from '../content/about'
import { projects } from '../content/projects'
import { skillGroups } from '../content/skills'
import { useStore } from '../store/useStore'

const reasonCopy: Record<string, string> = {
  'reduced-motion': 'Motion is reduced on this device, so the notebook is presented as a quiet editorial edition.',
  'no-webgl': 'Your browser cannot render the 3D world, so every part of the notebook is collected here instead.',
  'low-tier': 'This device gets the lightweight edition: the same work, without the heavy rendering.',
  user: 'The calm edition of the notebook — all of the work, none of the camera movement.',
  '': 'The calm edition of the notebook.',
}

export function Static2D() {
  const reason = useStore((s) => s.modeReason)
  const setMode = useStore((s) => s.setMode)

  return (
    <main className="static">
      <nav className="static__nav" aria-label="Portfolio navigation">
        <a href="#top" className="brand">
          <span className="brand__mark">{identity.monogram}</span>
          <span className="brand__copy"><strong>{identity.name}</strong><small>{identity.role}</small></span>
        </a>
        <div><a href="#work">Work</a><a href="#about">About</a><a href={`mailto:${identity.email}`}>Contact</a></div>
      </nav>

      <section className="static__hero" id="top" aria-labelledby="portfolio-title">
        <div>
          <p className="eyebrow"><span /> {identity.availability}</p>
          <h1 id="portfolio-title">{identity.headline}</h1>
          <p>{aboutText}</p>
          <div className="static__actions">
            <a href="#work">Explore selected work</a>
            <button type="button" onClick={() => setMode('3d', 'user')}>Enter the 3D notebook</button>
          </div>
        </div>
        <aside className="static__note">
          <span>Notebook no. 01</span>
          <strong>Ideas, systems<br />& small worlds.</strong>
          <p>{reasonCopy[reason] ?? reasonCopy['']}</p>
          <small>{identity.location}</small>
        </aside>
      </section>

      <section className="static__work" id="work" aria-labelledby="work-title">
        <header><p className="eyebrow">Selected work</p><h2 id="work-title">Experiments with a practical spine.</h2><span>01—05</span></header>
        <div className="project-grid">
          {projects.map((project, index) => (
            <article className="project" key={project.id} style={{ '--note': project.noteColor } as CSSProperties}>
              <div className="project__visual"><span>{String(index + 1).padStart(2, '0')}</span><i>{project.type}</i><b>{project.title.slice(0, 1)}</b></div>
              <div className="project__body">
                <p className="project__meta">{project.year} · {project.role}</p>
                <h3>{project.title}</h3>
                <p>{project.summary}</p>
                <strong>{project.outcome}</strong>
                <ul>{project.stack.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="static__about" id="about" aria-labelledby="about-title">
        <div><p className="eyebrow">About Akshat</p><h2 id="about-title">The best interfaces explain themselves through feeling.</h2><p>{aboutText}</p></div>
        <div className="static__timeline">{timeline.map((item) => <div key={item.year}><span>{item.year}</span><p>{item.what}</p></div>)}</div>
      </section>

      <section className="static__skills" aria-label="Capabilities">
        {skillGroups.map((group, index) => <article key={group.group}><span>0{index + 1}</span><h3>{group.group}</h3><ul>{group.skills.map((skill) => <li key={skill.name}>{skill.name}<i>{'●'.repeat(skill.level)}{'○'.repeat(3 - skill.level)}</i></li>)}</ul></article>)}
      </section>

      <footer className="static__footer">
        <p className="eyebrow">Start a conversation</p>
        <h2>Let’s make something people want to explore.</h2>
        <a href={`mailto:${identity.email}`}>{identity.email}</a>
        <div><span>© {new Date().getFullYear()} {identity.name}</span><a href="#top">Back to top</a></div>
      </footer>
    </main>
  )
}
