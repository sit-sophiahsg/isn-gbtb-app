// Deterministic flowerbed layout: the same flowers always land in the same places,
// so nothing jumps around when the garden refreshes.
import type { GardenFlower } from './types'

const GOLDEN = 0.6180339887

/** Stable 0–1 number from a string (FNV-1a). */
export function hash01(s: string, salt = 0): number {
  let h = 0x811c9dc5 ^ salt
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return ((h >>> 0) % 100000) / 100000
}

export interface Hill {
  /** Top of the hill at horizontal position x. */
  y(x: number): number
}

export interface PlacedFlower {
  flower: GardenFlower
  row: number
  x: number
  baseY: number
  bloomX: number
  bloomY: number
  size: number
  swaySeconds: number
  swayDelay: number
  leafSide: 1 | -1
}

export interface GardenLayout {
  width: number
  height: number
  rows: number
  hills: Hill[]
  backdrop: Hill
  flowers: PlacedFlower[]
}

function makeHill(width: number, top: number, amp: number, freq: number, phase: number): Hill {
  return { y: (x) => top + Math.sin((x / width) * Math.PI * 2 * freq + phase) * amp + Math.sin((x / width) * Math.PI * 5.3 + phase * 2) * amp * 0.35 }
}

/**
 * Lay out flowers in rows: back rows smaller and higher, front rows bigger and lower.
 * A fourth row is added above 40 flowers, and flowers shrink above 60.
 */
export function layoutGarden(flowers: GardenFlower[], width: number, height: number): GardenLayout {
  const n = flowers.length
  const rows = n > 40 ? 4 : 3
  const tall = height > width
  const rowTops = rows === 4 ? (tall ? [0.48, 0.6, 0.73, 0.87] : [0.55, 0.66, 0.78, 0.91]) : tall ? [0.5, 0.66, 0.84] : [0.6, 0.74, 0.89]
  const rowScale = rows === 4 ? [0.55, 0.68, 0.84, 1] : [0.62, 0.8, 1]

  const hills = rowTops.map((t, r) => makeHill(width, t * height, height * (0.018 + r * 0.004), 1.2 + r * 0.35, r * 1.7 + 0.4))
  const backdrop = makeHill(width, (rowTops[0] - 0.08) * height, height * 0.03, 0.9, 2.2)

  const perRow = Math.max(4, Math.ceil(n / rows))
  let base = Math.min(width * 0.17, ((width * 0.94) / perRow) * 1.35, height * 0.2)
  if (n > 60) base *= 0.82

  const margin = 0.06
  const placed: PlacedFlower[] = flowers.map((flower, i) => {
    // First flowers fill the front row, so early arrivals are big and visible.
    const row = rows - 1 - (i % rows)
    const k = Math.floor(i / rows)
    const h1 = hash01(flower.id, 1)
    const h2 = hash01(flower.id, 2)
    const h3 = hash01(flower.id, 3)
    const frac = (row * 0.37 + 0.11 + k * GOLDEN) % 1
    const x = (margin + frac * (1 - 2 * margin) + (h1 - 0.5) * 0.03) * width
    const size = base * rowScale[row] * (0.9 + h2 * 0.2)
    const baseY = hills[row].y(x) + size * 0.12
    // Taller stems when the garden is sparse, so a dozen flowers still fill the scene.
    const sparse = n < 30 ? 1.3 : 1
    const stem = size * (tall ? 1.35 : 1.05) * sparse * (0.85 + h3 * 0.5)
    const lean = (h1 - 0.5) * size * 0.5
    const bloomY = Math.max(size * 0.6, baseY - stem)
    return {
      flower,
      row,
      x,
      baseY,
      bloomX: x + lean,
      bloomY,
      size,
      swaySeconds: 4.5 + h2 * 3.5,
      swayDelay: -h3 * 6,
      leafSide: h2 > 0.5 ? 1 : -1,
    }
  })

  return { width, height, rows, hills, backdrop, flowers: placed }
}

/** SVG path for a hill filled down to the bottom of the scene. */
export function hillPath(h: Hill, width: number, height: number): string {
  const step = width / 40
  let d = `M 0 ${height} L 0 ${h.y(0).toFixed(1)}`
  for (let x = step; x <= width + 0.5; x += step) d += ` L ${x.toFixed(1)} ${h.y(x).toFixed(1)}`
  return `${d} L ${width} ${height} Z`
}
