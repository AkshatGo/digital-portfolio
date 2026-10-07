/**
 * QA audit for The Notebook Valley (headless Chromium + CDP).
 *
 * Verifies, act by act, that the app really renders: draw calls and triangle
 * counts against the §10 budgets, no console/shader errors, screenshots on disk,
 * the terminal contract, and the Act 4 fly-in camera takeover.
 *
 * Usage: node qa/audit.mjs [url] [outDir]
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { imageDiff, imageStats } from './png.mjs'

const URL_BASE = process.argv[2] ?? 'http://localhost:4173/?dev=1'
const OUT_DIR = process.argv[3] ?? 'qa'
const CDP = 'http://localhost:9222'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------- budgets from PORTFOLIO_MASTER_PLAN.md §10 ---------- */
const BUDGET = { drawCalls: 150, triangles: 300_000 }

const targets = [
  { label: 'act-1-valley', p: 0.05 },
  { label: 'act-2-open', p: 0.24 },
  { label: 'act-2-room', p: 0.34 },
  { label: 'act-3-desk', p: 0.45 },
  { label: 'act-4-board', p: 0.6 },
  { label: 'act-5-library', p: 0.78 },
  { label: 'act-6-night', p: 0.95 },
]

const list = await (await fetch(`${CDP}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
if (!page) throw new Error('no debuggable page found')

const ws = new WebSocket(page.webSocketDebuggerUrl)
const pending = new Map()
const consoleMsgs = []
const exceptions = []
let nextId = 0

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = (msg.params.args ?? [])
      .map((a) => a.value ?? a.description ?? a.type)
      .join(' ')
    consoleMsgs.push({ level: msg.params.type, text })
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(
      msg.params?.exceptionDetails?.exception?.description ??
        msg.params?.exceptionDetails?.text ??
        'unknown exception',
    )
  }
})

await new Promise((res, rej) => {
  ws.addEventListener('open', res)
  ws.addEventListener('error', rej)
})

const send = (method, params = {}) =>
  new Promise((res) => {
    const id = ++nextId
    pending.set(id, res)
    ws.send(JSON.stringify({ id, method, params }))
  })

async function evaluate(expression) {
  const msg = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (msg.result?.exceptionDetails) {
    throw new Error(
      `evaluate failed: ${msg.result.exceptionDetails.exception?.description ?? 'unknown'}`,
    )
  }
  return msg.result?.result?.value
}

const click = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}

mkdirSync(OUT_DIR, { recursive: true })

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: URL_BASE })
await sleep(6000)

const ready = await evaluate('!!window.__NV__')
if (!ready) {
  console.error('FAIL: window.__NV__ missing — devtools hook never installed (WebGL failed?)')
  console.error('console:', consoleMsgs.slice(0, 10))
  process.exit(1)
}

const webgl = await evaluate(
  '(() => { const c = document.createElement("canvas"); const g = c.getContext("webgl2") || c.getContext("webgl"); return g ? g.getParameter(g.VERSION) : "none" })()',
)
console.log(`WebGL: ${webgl}\n`)

const rows = []
for (const t of targets) {
  await evaluate(`window.__NV__.scrubTo(${t.p})`)
  await sleep(2600) // let the scrub settle and the quality tuner report once
  const sample = await evaluate(`(() => {
    const b = window.__NV__.budgets()
    return {
      act: window.__NV__.act(),
      progress: Number(window.__NV__.rig.progress.toFixed(3)),
      fps: window.__NV__.fps(),
      quality: window.__NV__.store().quality,
      calls: b.drawCalls,
      tris: b.triangles,
      preloaded: performance
        .getEntriesByType('resource')
        .filter((e) => /(NotebookGlobe|GlobeEngine|CorkboardGlobe|InkwellGlobe|FireflyGlobe)/.test(e.name))
        .length,
    }
  })()`)
  const r = { ...t, ...sample }
  rows.push(r)

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot.result?.data) {
    const buf = Buffer.from(shot.result.data, 'base64')
    writeFileSync(`${OUT_DIR}/${t.label}.png`, buf)
    try {
      const s = imageStats(buf)
      r.pixels = s
    } catch (err) {
      r.pixelError = String(err)
    }
  }

  // Scene-only draw calls: postprocessing renders through its own passes, so
  // renderer.info only sees the composer's final quad. Switching effects off
  // (not quality, which would change what Act 4 renders) exposes the true
  // scene cost (§10 draw-call budget).
  await evaluate('window.__NV__.setEffects(false)')
  await sleep(1200)
  const raw = await evaluate('window.__NV__.budgets()')
  r.sceneCalls = raw.drawCalls
  r.sceneTris = raw.triangles
  await evaluate('window.__NV__.setEffects(true)')
  await sleep(400)
}

console.log(
  'act              scroll   act              fps  | scene calls/tris (post off) | globe chunks | screenshot',
)
for (const r of rows) {
  const over =
    r.sceneCalls > BUDGET.drawCalls || r.sceneTris > BUDGET.triangles ? ' OVER BUDGET' : ''
  const px = r.pixels
    ? `mean rgb(${r.pixels.mean.join(',')}) luma ${r.pixels.lumaRange.join('-')} colors ${r.pixels.distinctColors}`
    : `pixel stats failed: ${r.pixelError}`
  console.log(
    `${r.label.padEnd(16)} ${String(r.p).padEnd(8)} ${String(r.act).padEnd(16)} ${String(
      r.fps,
    ).padStart(3)}  | ${String(r.sceneCalls).padStart(4)} / ${String(r.sceneTris).padStart(7)}${over.padEnd(
      12,
    )} | ${String(r.preloaded).padStart(4)}/5     | ${px}`,
  )
}

const blank = rows.filter((r) => r.pixels && r.pixels.distinctColors < 24)
console.log(
  blank.length
    ? `\nFAIL: ${blank.length} act(s) look blank (<24 distinct colours): ${blank
        .map((b) => b.label)
        .join(', ')}`
    : '\nAll acts render distinct imagery (>=24 distinct quantised colours each).',
)

/* ---------- terminal contract (§8 / §13) ---------- */
await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }))`)
await sleep(400)
const termOpen = await evaluate(`!!document.querySelector('.terminal')`)
let commands = {}
if (termOpen) {
  await evaluate(`(() => {
    const form = document.querySelector('.terminal__form')
    const input = form.querySelector('input')
    const fire = (value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    }
    ;['help', 'cat about.txt', 'skills --tree', 'projects', 'blueprint'].forEach(fire)
  })()`)
  await sleep(700)
  commands = await evaluate(`(() => {
    const log = document.querySelector('.terminal__log').innerText
    return {
      lines: log.split('\\n').length,
      hasSkills: log.includes('three.js / WebGL'),
      hasAbout: log.includes('Creative engineer'),
      hasProjects: log.includes('Notebook Valley'),
      blueprintOn: window.__NV__.store().wireframe,
    }
  })()`)
}
console.log('\nterminal:', termOpen ? 'opened' : 'FAILED TO OPEN', commands)
await evaluate(`window.__NV__.store().setWireframe(false); window.__NV__.store().setTerminalOpen(false)`)

/* ---------- real input path: wheel scrolling must move the document ---------- */
await evaluate('window.scrollTo(0, 0)')
await sleep(1500)
const wheelStart = await evaluate('window.__NV__.rig.progress')
for (let i = 0; i < 14; i++) {
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 640,
    y: 400,
    deltaX: 0,
    deltaY: 260,
  })
  await sleep(70)
}
await sleep(1600)
const wheelEnd = await evaluate('window.__NV__.rig.progress')
console.log(
  `\nwheel scroll over the canvas: ${wheelStart.toFixed(4)} -> ${wheelEnd.toFixed(4)} ${
    wheelEnd > wheelStart + 0.01 ? 'PASS' : 'FAIL (canvas is swallowing the wheel?)'
  }`,
)

/* ---------- Act 4 note click through real pointer input (§5) ---------- */
await evaluate(`window.__NV__.scrubTo(0.6)`)
await sleep(2500)
let noteClick = 'no note hit'
outer: for (const dx of [148, -148, 74, -74, 0]) {
  for (const dy of [-53, 53, 0]) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640 + dx, y: 400 + dy })
    await sleep(260)
    if (await evaluate(`!!document.body.style.cursor && document.body.style.cursor === 'pointer'`)) {
      noteClick = `hover hit at (${640 + dx}, ${400 + dy})`
      break outer
    }
  }
}
console.log(`note hover probe: ${noteClick}`)

/* ---------- Act 4 fly-in camera takeover (§5 / §13) ---------- */
await evaluate(`window.__NV__.scrubTo(0.6)`)
await sleep(2000)
const beforeLook = await evaluate('window.__NV__.rig.look.z')
await evaluate(`window.__NV__.store().setFocusedProject('notebook-valley')`)
await sleep(2500)
const flyIn = await evaluate(`(() => ({
  lookZ: window.__NV__.rig.look.z,
  detailVisible: !!document.querySelector('.detail'),
  overflow: document.body.style.overflow,
}))()`)
await evaluate(`window.__NV__.store().setFocusedProject(null)`)
await sleep(600)
const released = await evaluate('document.body.style.overflow')

/* ---------- scroll reversibility (§13) ---------- */
await evaluate(`window.__NV__.scrubTo(0.78)`)
await sleep(2000)
const atLibrary = await evaluate('window.__NV__.rig.progress')
await evaluate(`window.__NV__.scrubTo(0.45)`)
await sleep(2000)
const backAtDesk = await evaluate('window.__NV__.rig.progress')
const forwardAgain = await evaluate(`(() => { window.__NV__.scrubTo(0.78); return true })()`)
await sleep(2000)
const reconciliation = await evaluate(
  '(() => ({ progress: window.__NV__.rig.progress, bookReveal: window.__NV__.rig.bookReveal, deskGlow: window.__NV__.rig.deskGlow }))()',
)

/* ---------- §10 streaming: diorama chunks must arrive during Act 2 ---------- */
const preloadedBeforeClick = await evaluate(`performance.getEntriesByType('resource')
  .map((e) => e.name)
  .filter((n) => /(NotebookGlobe|GlobeEngine|CorkboardGlobe|InkwellGlobe|FireflyGlobe)/.test(n)).length`)
console.log(
  `\ndiorama chunks fetched before the first note click: ${preloadedBeforeClick}/5 ${
    preloadedBeforeClick >= 5 ? 'PASS' : 'FAIL'
  }`,
)

/* ---------- Act 4 snow-globe dioramas (§5) ---------- */
const projectSource = readFileSync('src/content/projects.ts', 'utf8')
const projectIds = [...projectSource.matchAll(/\bid:\s*'([a-z0-9-]+)'/g)].map((m) => m[1])

await evaluate('window.__NV__.scrubTo(0.6)')
await sleep(1800)
await evaluate('window.__NV__.setEffects(false)')
await sleep(900)
const boardOnly = await evaluate('window.__NV__.budgets()')

const dioramas = []
for (const id of projectIds) {
  await evaluate(`window.__NV__.store().setFocusedProject('${id}')`)
  await sleep(2800) // lazy chunk + 0.9 s ramp
  const open = await evaluate('window.__NV__.budgets()')
  const shotOpen = await send('Page.captureScreenshot', { format: 'png' })
  const bufOpen = Buffer.from(shotOpen.result.data, 'base64')
  writeFileSync(`${OUT_DIR}/diorama-${id}.png`, bufOpen)

  // a real drag must orbit the diorama (±30° constrained)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 620,
    y: 430,
    button: 'left',
    clickCount: 1,
  })
  for (let i = 1; i <= 8; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 620 + i * 22,
      y: 430 + i * 3,
      button: 'left',
    })
    await sleep(45)
  }
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 620 + 8 * 22,
    y: 430 + 8 * 3,
    button: 'left',
    clickCount: 1,
  })
  await sleep(800)
  const shotDrag = await send('Page.captureScreenshot', { format: 'png' })
  const bufDrag = Buffer.from(shotDrag.result.data, 'base64')
  writeFileSync(`${OUT_DIR}/diorama-${id}-orbit.png`, bufDrag)

  await evaluate('window.__NV__.store().setFocusedProject(null)')
  await sleep(1700)
  const closed = await evaluate('window.__NV__.budgets()')
  const stillFocused = await evaluate('window.__NV__.store().focusedProject')

  dioramas.push({
    id,
    addedTris: open.triangles - boardOnly.triangles,
    addedCalls: open.drawCalls - boardOnly.drawCalls,
    orbitChangedPixels: imageDiff(bufOpen, bufDrag),
    closedCalls: closed.drawCalls,
    released: stillFocused === null,
    pixels: imageStats(bufOpen),
  })
}
await evaluate('window.__NV__.setEffects(true)')

console.log(
  `\ndiorama              added tris (cap 5000)  added calls  orbit drag  released  colours`,
)
for (const d of dioramas) {
  const cap = d.addedTris > 5000 ? ' OVER' : ''
  console.log(
    `${d.id.padEnd(20)} ${String(d.addedTris).padStart(6)}${cap.padEnd(7)} ${String(
      d.addedCalls,
    ).padStart(6)}      ${(d.orbitChangedPixels * 100).toFixed(1)}%      ${
      d.released ? 'yes' : 'NO'
    }      ${d.pixels.distinctColors}`,
  )
}
const capFail = dioramas.filter((d) => d.addedTris > 5000)
const orbitFail = dioramas.filter((d) => d.orbitChangedPixels < 0.02)
console.log(
  capFail.length
    ? `FAIL: diorama tri cap exceeded: ${capFail.map((d) => d.id).join(', ')}`
    : 'all dioramas are within the 5 k-triangle cap',
)
console.log(
  orbitFail.length
    ? `FAIL: drag did not change the view for: ${orbitFail.map((d) => d.id).join(', ')}`
    : 'drag orbit verified on every diorama',
)

/* ---------- §12 low-tier poster fallback ---------- */
await evaluate(`window.__NV__.store().setQuality('low')`)
await evaluate(`window.__NV__.store().setFocusedProject('corkboard')`)
await sleep(2400)
const posterShot = await send('Page.captureScreenshot', { format: 'png' })
const posterBuf = Buffer.from(posterShot.result.data, 'base64')
writeFileSync(`${OUT_DIR}/diorama-low-tier-poster.png`, posterBuf)
const posterStats = imageStats(posterBuf)
const posterBudget = await evaluate('window.__NV__.budgets()')
await evaluate(`window.__NV__.store().setFocusedProject(null)`)
await evaluate(`window.__NV__.store().setQuality('high')`)
console.log(
  `\nlow-tier poster fallback: ${posterStats.distinctColors} distinct colours, ${posterBudget.drawCalls} calls (PASS if > 24 colours and no diorama geometry)`,
)

/* ---------- §13: real Esc and real wheel must both exit the fly-in ---------- */
await evaluate(`window.__NV__.store().setFocusedProject('corkboard')`)
await sleep(1600)
// §5: the scrub is paused while a note is open …
const progressBeforeEsc = await evaluate('window.__NV__.rig.progress')
await sleep(1200)
const progressWhileStillOpen = await evaluate('window.__NV__.rig.progress')
const scrubPaused = Math.abs(progressWhileStillOpen - progressBeforeEsc) < 1e-6
await send('Input.dispatchKeyEvent', {
  type: 'rawKeyDown',
  key: 'Escape',
  code: 'Escape',
  windowsVirtualKeyCode: 27,
  nativeVirtualKeyCode: 27,
})
await send('Input.dispatchKeyEvent', {
  type: 'keyUp',
  key: 'Escape',
  code: 'Escape',
  windowsVirtualKeyCode: 27,
  nativeVirtualKeyCode: 27,
})
await sleep(900)
const escReleased = await evaluate('window.__NV__.store().focusedProject === null')

await evaluate(`window.__NV__.store().setFocusedProject('inkwell')`)
await sleep(1600)
for (let i = 0; i < 3; i++) {
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 640,
    y: 400,
    deltaX: 0,
    deltaY: 200,
  })
  await sleep(90)
}
await sleep(900)
const wheelReleased = await evaluate('window.__NV__.store().focusedProject === null')
// … and §5's scroll-down exit releases the note, so the scrub resumes. A wheel
// towards the viewer is what closes it, so progress advancing here is correct.
const progressAfterExit = await evaluate('window.__NV__.rig.progress')
console.log(
  `\nexit paths: esc ${escReleased ? 'PASS' : 'FAIL'}, wheel-down ${
    wheelReleased ? 'PASS' : 'FAIL'
  }, scrub paused while open: ${scrubPaused ? 'PASS' : 'FAIL'}, scroll resumes after exit: ${
    progressAfterExit > progressWhileStillOpen ? 'PASS' : 'FAIL'
  }`,
)

/* ---------- report ---------- */
const errors = consoleMsgs.filter(
  (m) =>
    (m.level === 'error' || m.level === 'warning') &&
    !m.text.includes('Multiple instances of Three.js'),
)
console.log('\nfly-in:', {
  lookZBefore: beforeLook,
  lookZAfter: flyIn.lookZ,
  detailVisible: flyIn.detailVisible,
  scrollLocked: flyIn.overflow === 'hidden',
  releasedOverflow: `"${released}"`,
})
console.log('reversibility:', { atLibrary, backAtDesk, forwardAgain, reconciliation })
console.log(`\nconsole warnings/errors: ${errors.length}`)
errors.slice(0, 12).forEach((m) => console.log(`  [${m.level}] ${m.text.slice(0, 220)}`))
console.log(`uncaught exceptions: ${exceptions.length}`)
exceptions.slice(0, 6).forEach((e) => console.log(`  ${e.slice(0, 300)}`))
console.log(`\nscreenshots in ${OUT_DIR}/`)

ws.close()
process.exit(0)
