/**
 * §9 localStorage: nv_visitors = [{ sig, star, at }] (cap 500, FIFO).
 * The signature drawing UI (§8 signature ritual) is a later milestone; this
 * module owns the storage contract, the FIFO cap and the star placement so the
 * Act 6 constellation is already live and correct.
 */
export interface Visitor {
  sig: string
  star: [number, number, number]
  at: string
}

export const VISITORS_KEY = 'nv_visitors'
export const SIGNATURE_KEY = 'nv_signature'
export const VISITOR_CAP = 500

/** deterministic string hash (djb2) so a signature always maps to one star */
function hash(input: string): number {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0
  return h
}

/** §5 Act 6: a signature becomes a labelled star in the valley's dome. */
export function starFor(sig: string): [number, number, number] {
  const h = hash(sig || 'anonymous-visitor')
  const azimuth = ((h % 360) / 360) * Math.PI * 2
  const elevation = (0.42 + ((h >>> 9) % 100) / 100 * 0.5) * (Math.PI / 2) // 25°–72°
  const radius = 82 + ((h >>> 17) % 100) / 100 * 8
  return [
    Math.cos(azimuth) * Math.cos(elevation) * radius,
    Math.sin(elevation) * radius,
    Math.sin(azimuth) * Math.cos(elevation) * radius,
  ]
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — the constellation simply does not persist */
  }
}

export function readSignature(): string | null {
  return safeGet(SIGNATURE_KEY)
}

export function loadVisitors(): Visitor[] {
  const raw = safeGet(VISITORS_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (v): v is Visitor =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as Visitor).sig === 'string' &&
          Array.isArray((v as Visitor).star),
      )
      .slice(-VISITOR_CAP)
  } catch {
    return []
  }
}

function saveVisitors(list: Visitor[]): void {
  safeSet(VISITORS_KEY, JSON.stringify(list.slice(-VISITOR_CAP)))
}

/**
 * Records the current visit (creating a signature slot if the visitor has not
 * drawn one yet) and returns the full capped constellation plus this visitor.
 */
export function ensureVisit(): { visitors: Visitor[]; mine: Visitor } {
  const sig = readSignature() ?? `anon-${Date.now().toString(36)}`
  safeSet(SIGNATURE_KEY, sig)
  const star = starFor(sig)
  const list = loadVisitors()
  const existing = list.find((v) => v.sig === sig)
  if (existing) {
    // keep the entry at the end so "newest star" ordering is stable
    const others = list.filter((v) => v.sig !== sig)
    others.push({ ...existing, at: new Date().toISOString() })
    saveVisitors(others)
    return { visitors: others.slice(-VISITOR_CAP), mine: others[others.length - 1] }
  }
  const mine: Visitor = { sig, star, at: new Date().toISOString() }
  const next = [...list, mine].slice(-VISITOR_CAP)
  saveVisitors(next)
  return { visitors: next, mine }
}
