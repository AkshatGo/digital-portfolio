# The Notebook Valley — build status

A scroll-driven 3D portfolio built to `PORTFOLIO_MASTER_PLAN.md`. One WebGL canvas,
one master GSAP timeline scrubbed from DOM scroll progress, six acts.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc --noEmit && vite build
npm run typecheck
npm run qa         # headless Chromium audit (see "QA" below)
```

## What this checkpoint contains

Built in the plan's own order — **rig → Act 2 → the rest**, with the metamorphosis
prototype (Act 1 + hinge open + crossfade) done first.

| Piece | State |
|---|---|
| §2 scroll rig (single canvas, 10000 vh scroll body, `ScrollRig` single frame loop) | done |
| §2.3 progress mirror to zustand at 10 Hz, never from `useFrame` | done |
| §3 master timeline: labels `valley/open/unfold/desk/board/flyin/library/book/outro`, paused + `.time()` scrubbed (fully reversible) | done |
| §4 camera: 11 authored keyframes → centripetal `CatmullRomCurve3`, per-act look targets, fov 50 → 46 → 42 → 58, ±15°/±8° pointer parallax | done |
| §5 Act 1 valley: sky dome gradient, `FogExp2`, floor disc, two ridge rings, 40 instanced props, 300 fireflies | done |
| §5 Act 1 hero notebook: corner-pivot origin, spine hinge, 6 fanned pages, paper flutter, micro-float | done |
| §5 Act 2: cover hinges 180° (`back.out(1.2)`), pages fan 3°, notebook scales ×1.6, room crossfades in with a 0.01-progress overlap + bloom spike, walls rise (0.02 stagger), furniture drops in with `back.out(2)` + 12-particle dust puffs, neon floor strip shader reveal | done |
| §5 Acts 3, 5, 6 | grey-box, streamed during Act 2 (§10) — see "Next" |
| §7 shaders: `paperFlutter`, `skyDome`, fireflies, `starfield` + signature star, `neonDraw`, dust puffs, `glowPages` | done |
| §8 terminal (`T`) — `help ls cat about.txt skills --tree projects npm run hire blueprint act clear exit` | done |
| §8 blueprint mode (scene wireframe + black sky) | done |
| §8 Act 4 note hover lift + click fly-in: scrub lock, body scroll lock, camera takeover, DOM project card, Esc / X / scroll-down exit | done |
| §5 Act 4 snow-globes: note unfolds into an open booklet, the project's miniature scales out of it inside a glass globe with drifting snow, drag orbits it within ±30°, rim becomes the act's emissive hero while the pins dim, poster fallback on low tier | done |
| §10 diorama modules lazy-loaded and prefetched when Act 2 ends | done |
| §8 cursor point-light; §8 quality auto-tune (one-way, with low-tier → static fallback) | done |
| §8 `Static2D` fallback (reduced motion / no WebGL / low-tier / `2D mode` button) with a full keyboard-reachable content crawl | done |
| §9 content schemas (`projects`, `skills`, `about`), visitor constellation storage (`nv_visitors`, cap 500 FIFO, `nv_signature`) | done |
| §6 post: ACESFilmic exposure 1.1, bloom 0.55 (threshold 0.85, radius 0.6) spiked by `rig.flash`, vignette 0.3, SMAA | done |

## QA

`npm run qa` drives a headless Chromium over the DevTools protocol (`qa/audit.mjs`,
no test-framework dependency). It needs the preview server and a Chromium with
remote debugging:

```bash
npm run build && npx vite preview --port 4173 &     # or npm run dev
chromium --headless=new --no-sandbox --remote-debugging-port=9222 \
  --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1280,800 about:blank &
npm run qa
```

It reports per act: the real scene draw calls / triangles (measured with the
post-processing composer off — `renderer.info` only sees the composer's last pass,
so the audit flips the HUD's `fx` switch rather than the quality tier, which would
change what Act 4 renders), screenshot pixel statistics in `qa/*.png`, then
exercises the real input path (wheel over the canvas, note drag-orbit), the terminal
contract, note hover, the fly-in camera takeover, the diorama triangle cap and
scroll reversibility. `?dev=1` publishes `window.__NV__`
(`budgets()`, `scrubTo(p)`, `rig`, `store`) for the same purpose by hand; `?p=0.62`
loads the page parked inside an act.

Last run (Chromium 149, SwiftShader software raster, 1280×800):

```
act              scroll   act              fps  | scene calls/tris (post off) | globe chunks
act-1-valley     0.05     valley            23  |   16 /    3172             |    0/5
act-2-open       0.24     metamorphosis     25  |   16 /    3172             |    0/5
act-2-room       0.34     metamorphosis     20  |   45 /    1196             |    0/5
act-3-desk       0.45     desk              23  |   28 /    1002             |    5/5
act-4-board      0.6      board             23  |   29 /    1856             |    5/5
act-5-library    0.78     library           23  |   21 /    1758             |    5/5
act-6-night      0.95     outro             22  |   37 /    2032             |    5/5

// the globe-chunks column is §10 streaming made visible: the prefetch fires at
// the Act 2 → Act 3 boundary, so all five miniatures are cached before the board
// is even reachable at 0.55.

wheel scroll over the canvas: 0.0000 -> 0.6156 PASS
note hover probe: hit            fly-in: detail card visible, scroll locked, released on exit
diorama chunks fetched before the first note click: 5/5 PASS

diorama              added tris (cap 5000)  added calls  orbit drag  released  colours
notebook-valley        1940             3      45.1%      yes      1187
snow-globe-engine      2408             2       8.7%      yes      1250
corkboard              2406             6      16.7%      yes      1240
inkwell                2028             6      11.0%      yes      1063
firefly-lab            2736             1      13.4%      yes      1299
all dioramas are within the 5 k-triangle cap
drag orbit verified on every diorama
low-tier poster fallback: 544 distinct colours, 22 calls
exit paths: esc PASS, wheel-down PASS, scrub paused while open: PASS, scroll resumes after exit: PASS
reversibility: 0.78 -> 0.45 -> 0.78 reproduces bookReveal 0.937278 exactly (no drift)
console warnings/errors: 2 (both THREE.Clock deprecation notices from R3F internals)
uncaught exceptions: 0
```

Draw calls and triangles are far inside the §10 budgets because the acts are
grey-box. The fps column is a **software rasteriser** number and says nothing about
the §10 frame-time budget — that needs a real-GPU measurement (next perf pass).

## Deviations from the plan (deliberate, recorded)

1. **Camera is driven by the spline, not by `tl.to(camera.position, …)`.** §2 rule
   4 requires one owner for `camera.position`. The timeline tweens `rig.posT` along
   the 11 keyframes (piecewise, non-overlapping spans, so it still hits each
   keyframe exactly) and `rig.look`; `ScrollRig` samples the spline and adds the
   parallax offset. Act 4's fly-in takes over the camera only while a note is
   focused, and `ScrollRig` skips writing it then.
2. **Sticky notes are 0.42 m, not the spec's 0.09 m.** At the Act 4 camera distance
   (≈5.5 m) a 9 cm note is sub-pixel. `Act4Board.tsx` carries the note.
3. **No glTF assets yet.** With no Blender/asset pipeline in this environment the
   hero notebook, room and props are procedural geometry, which is what the plan's
   "grey-box" week 1–2 exits ask for. The art pass swaps in models ≤ 60 kB each.
4. **§10 JS budget is missed: ~452 kB gzip initial vs 350 kB** (207 kB app + 245 kB
   shared vendor chunk). Acts 3–6 and the five dioramas are already code-split and
   prefetched during Act 2; what remains is three + React 19 + R3F + postprocessing
   + gsap. Remaining levers: defer the postprocessing chunk behind the first
   interactive frame, and trim gsap.
5. **The fly-in camera stops 1.1 m from the note, not §5's 0.35 m.** 0.35 m was
   authored for 9 cm notes; with 0.42 m notes and a 0.34 m globe it would put the
   camera inside the glass. 1.1 m frames the globe at ~40 % of screen height at the
   act's fov 42.
6. **The miniatures are procedural, not authored glTF.** Each diorama is built
   from primitives (1940–2736 added triangles, verified) so the 5 k cap and the
   streaming contract are real; the art pass replaces the contents module by module
   without touching Act4Board, because the registry keys off `Project.globeScene`.
7. **Run order:** `npm run build` uses `tsc --noEmit` rather than `tsc -b` (no
   project references needed for a single-app repo).

## Next (in plan order)

1. **Act 4 art pass** — replace the procedural miniatures with authored glTF
   scenes (still ≤ 5 k tris each), and add the poster artwork for the low tier.
2. **Act 3 art pass** — adaptive 1024×640 `CanvasTexture` terminal typing at
   40 chars/s alternating with the radial skill chart, mug steam ribbon, cables.
3. **Act 5 art pass** — spine `CanvasTexture` atlas, hover slide, cursor-bend page
   corners, 2× spread pages.
4. **§8 signature ritual** — the canvas-2D overlay that writes `nv_signature`; the
   storage, FIFO cap and star placement already exist (`src/systems/visitors.ts`).
5. **Audio** — opt-in howler/WebAudio pads with per-act roots (§8); not started,
   no audio is loaded at all today.
6. **Perf pass** — real-GPU frame-time measurement, KTX2 textures, spector
   snapshot in CI, and closing the JS budget.

## Layout

```
src/
  App.tsx                 scroll body + fixed canvas + overlay switch
  rig/                    acts.ts (windows/labels) · RigState.ts (the singleton)
                          MasterTimeline.ts · cameraPath.ts · ScrollRig.tsx · useScroll.ts
  scene/                  Scene.tsx (fog, lights, acts, post) · StreamedActs.tsx
  acts/                   Act1Valley · HeroNotebook · Act2Metamorphosis · Act3Desk
                          Act4Board · Act5Library · Act6Night
  shaders/                paper.ts · sky.ts · particles.ts · neon.ts
  art/                    palette.ts (tokens + pooled scratch) · ridge.ts · dust.ts
  content/                projects.ts · skills.ts · about.ts
  dioramas/               registry.ts (content-keyed lazy map) · SnowGlobe · BookletUnfold
                          DioramaPreload · NotebookGlobe · GlobeEngine · CorkboardGlobe
                          InkwellGlobe · FireflyGlobe
  systems/                visitors.ts (constellation) · devtools.ts (?dev=1)
  ui/                     Overlay · Terminal · ProjectDetail · Static2D
  store/useStore.ts       mode/quality/progress mirror/overlay state
qa/                       audit.mjs (CDP audit) · png.mjs (decoder + image stats)
```
