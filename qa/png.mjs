import { inflateSync } from 'node:zlib'

/** Minimal PNG (8-bit RGB/RGBA/grey) decoder — no dependencies. */
export function decodePng(buffer) {
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 8
  let colorType = 6
  const idat = []

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data))
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }

  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`)
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 4
  const stride = width * channels * (bitDepth / 8)
  const raw = inflateSync(Buffer.concat(idat))
  const out = Buffer.alloc(height * stride)

  let pos = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++]
    const line = raw.subarray(pos, pos + stride)
    pos += stride
    const prevOffset = (y - 1) * stride
    const curOffset = y * stride
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[curOffset + x - channels] : 0
      const b = y > 0 ? out[prevOffset + x] : 0
      const c = y > 0 && x >= channels ? out[prevOffset + x - channels] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      } else if (filter !== 0) throw new Error(`unknown filter ${filter}`)
      out[curOffset + x] = v & 0xff
    }
  }

  return { width, height, channels, data: out }
}

/**
 * Objective "is anything actually drawn?" statistics: mean colour, luminance
 * spread, and how many distinct quantised colours appear. A blank frame has ~1
 * distinct colour.
 */
export function imageStats(buffer) {
  const { width, height, channels, data } = decodePng(buffer)
  const seen = new Set()
  let r = 0
  let g = 0
  let b = 0
  let lumaMin = 255
  let lumaMax = 0
  let samples = 0

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * channels
      const pr = data[i]
      const pg = channels >= 3 ? data[i + 1] : pr
      const pb = channels >= 3 ? data[i + 2] : pr
      r += pr
      g += pg
      b += pb
      const luma = (pr * 299 + pg * 587 + pb * 114) / 1000
      if (luma < lumaMin) lumaMin = luma
      if (luma > lumaMax) lumaMax = luma
      samples++
      seen.add(((pr >> 3) << 10) | ((pg >> 3) << 5) | (pb >> 3))
    }
  }

  return {
    width,
    height,
    mean: [Math.round(r / samples), Math.round(g / samples), Math.round(b / samples)],
    lumaRange: [Math.round(lumaMin), Math.round(lumaMax)],
    distinctColors: seen.size,
  }
}

/**
 * Fraction of sampled pixels that changed by more than `threshold` levels.
 * Used to prove a real input (a drag) actually changed what is on screen.
 */
export function imageDiff(bufA, bufB, threshold = 12) {
  const a = decodePng(bufA)
  const b = decodePng(bufB)
  if (a.width !== b.width || a.height !== b.height) return 1
  let changed = 0
  let samples = 0
  for (let y = 0; y < a.height; y += 2) {
    for (let x = 0; x < a.width; x += 2) {
      const ia = (y * a.width + x) * a.channels
      const ib = (y * b.width + x) * b.channels
      const d =
        Math.abs(a.data[ia] - b.data[ib]) +
        Math.abs(a.data[ia + 1] - b.data[ib + 1]) +
        Math.abs(a.data[ia + 2] - b.data[ib + 2])
      if (d > threshold) changed++
      samples++
    }
  }
  return changed / samples
}
