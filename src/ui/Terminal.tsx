import { useEffect, useRef, useState } from 'react'
import { aboutText, identity } from '../content/about'
import { projects } from '../content/projects'
import { skillsTree } from '../content/skills'
import { useStore } from '../store/useStore'
import { rig } from '../rig/RigState'

interface Line {
  kind: 'in' | 'ok' | 'err' | 'out'
  text: string
}

const BANNER: Line[] = [
  { kind: 'ok', text: 'notebook-valley shell — v0.1.0' },
  { kind: 'out', text: "type `help` for the command list, `exit` to close" },
]

const HELP: string[] = [
  'help            this list',
  'ls              list the valley contents',
  'cat about.txt   read the bio',
  'skills --tree   skill tree with levels',
  'projects        project index',
  'npm run hire    open a mail draft',
  'blueprint       easter egg: wireframe the scene',
  'act             current act + scroll progress',
  'clear           clear the log',
  'exit            close the terminal',
]

/**
 * §8 working terminal: a real interactive CLI in the DOM (never live 3D text).
 * Opened with `T` or by clicking the monitor, closed with Esc/exit.
 */
export function Terminal() {
  const setTerminalOpen = useStore((s) => s.setTerminalOpen)
  const setWireframe = useStore((s) => s.setWireframe)
  const [lines, setLines] = useState<Line[]>(BANNER)
  const [value, setValue] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const push = (next: Line[]) => setLines((prev) => [...prev, ...next])

  const run = (raw: string) => {
    const input = raw.trim()
    if (!input) return
    const [cmd, ...rest] = input.split(/\s+/)
    const arg = rest.join(' ')
    push([{ kind: 'in', text: `❯ ${input}` }])

    switch (cmd) {
      case 'help':
        push(HELP.map((text) => ({ kind: 'out' as const, text })))
        break
      case 'ls':
        push([
          { kind: 'out', text: 'valley/   room/   desk/   softboard/   library/   night/' },
          ...projects.map((p) => ({ kind: 'out' as const, text: `  ${p.id}.note` })),
        ])
        break
      case 'cat':
        if (arg !== 'about.txt') {
          push([{ kind: 'err', text: `cat: ${arg || '(missing operand)'}: no such file` }])
        } else {
          push([
            { kind: 'out', text: `${identity.name} — ${identity.role}` },
            { kind: 'out', text: aboutText },
          ])
        }
        break
      case 'skills':
        push(skillsTree().map((text) => ({ kind: 'out' as const, text })))
        break
      case 'projects':
        push(
          projects.map((p) => ({
            kind: 'out' as const,
            text: `${p.year}  ${p.title.padEnd(22)} ${p.type.padEnd(10)} ${p.stack.join(', ')}`,
          })),
        )
        break
      case 'act': {
        const act = useStore.getState().act
        push([
          {
            kind: 'ok',
            text: `${act.id} — ${act.title} (${act.start.toFixed(2)}–${act.end.toFixed(2)}) at ${(
              rig.progress * 100
            ).toFixed(1)}%`,
          },
        ])
        break
      }
      case 'npm':
        if (arg === 'run hire') {
          push([{ kind: 'ok', text: `opening a draft to ${identity.email} …` }])
          window.location.href = `mailto:${identity.email}?subject=Let's%20work%20together`
        } else {
          push([{ kind: 'err', text: `npm: unknown script "${arg}"` }])
        }
        break
      case 'blueprint': {
        const on = !useStore.getState().wireframe
        setWireframe(on)
        push([{ kind: 'ok', text: `blueprint mode ${on ? 'ON' : 'OFF'}` }])
        break
      }
      case 'clear':
        setLines([])
        return
      case 'exit':
      case 'quit':
        setTerminalOpen(false)
        return
      default:
        push([{ kind: 'err', text: `${cmd}: command not found — try \`help\`` }])
    }
  }

  return (
    <div className="terminal" role="dialog" aria-label="Notebook Valley terminal">
      <div className="terminal__bar">
        <span>akshat@notebook-valley:~$</span>
        <button type="button" onClick={() => setTerminalOpen(false)}>
          esc · close
        </button>
      </div>
      <div className="terminal__log" ref={logRef}>
        {lines.map((line, i) => (
          <div key={i} className={`line--${line.kind}`}>
            {line.text}
          </div>
        ))}
      </div>
      <form
        className="terminal__form"
        onSubmit={(e) => {
          e.preventDefault()
          run(value)
          setValue('')
        }}
      >
        <span>❯</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Command input"
          spellCheck={false}
          autoComplete="off"
        />
      </form>
    </div>
  )
}
