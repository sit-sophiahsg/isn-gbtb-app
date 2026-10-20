import { formatPassportDate } from '../components/PhotoPage'

export const POSTCARD_W = 1800
export const POSTCARD_H = 1200
export const MESSAGE_MAX = 280
export const TO_MAX = 40

export interface PostcardInput {
  photoUrl: string
  message: string
  to: string
  firstName: string
  country: string
  /** ISO date of the event: the postmark shows this, not today's date. */
  eventDate: string
}

// The handwriting face, then system fonts for scripts Caveat doesn't cover (Chinese, Hindi, Thai…).
const HAND = (size: number) => `500 ${size}px Caveat, "Segoe Print", "Bradley Hand", system-ui, sans-serif`
const SERIF = (size: number) => `${size}px "Young Serif", Georgia, serif`
const MONO = (size: number, bold = true) => `${bold ? '700 ' : ''}${size}px "Space Mono", ui-monospace, monospace`

const PAPER = '#fbf7ee'
const INK = '#2a2a3a'
const RULE = '#cfc4a8'

async function loadFonts() {
  await Promise.all([
    document.fonts.load(HAND(60)),
    document.fonts.load(SERIF(90)),
    document.fonts.load(MONO(24)),
    document.fonts.load(MONO(24, false)),
  ])
  await document.fonts.ready
}

async function loadPhoto(url: string): Promise<ImageBitmap> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not load photo')
  return createImageBitmap(await res.blob(), { imageOrientation: 'from-image' })
}

/** Split into words, keeping each CJK/kana/hangul character separate so those scripts wrap too. */
function tokens(text: string): string[] {
  return text.split(/(\s+|[぀-ヿ㐀-鿿가-힯＀-￯])/).filter((t) => t && t !== '')
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\n/)) {
    let line = ''
    for (const tok of tokens(paragraph)) {
      const attempt = line + tok
      if (ctx.measureText(attempt).width <= maxWidth || !line.trim()) {
        // A single word wider than the line gets broken by character.
        if (ctx.measureText(attempt).width > maxWidth) {
          for (const ch of tok) {
            if (ctx.measureText(line + ch).width > maxWidth && line) {
              lines.push(line)
              line = ''
            }
            line += ch
          }
        } else {
          line = attempt
        }
      } else {
        lines.push(line.trimEnd())
        line = /^\s+$/.test(tok) ? '' : tok
      }
    }
    lines.push(line.trimEnd())
  }
  return lines
}

/** Largest handwriting size at which the message fits the box. */
function fitText(ctx: CanvasRenderingContext2D, text: string, width: number, height: number) {
  for (let size = 66; size >= 34; size -= 2) {
    ctx.font = HAND(size)
    const lines = wrap(ctx, text, width)
    if (lines.length * size * 1.22 <= height) return { size, lines }
  }
  ctx.font = HAND(34)
  const lines = wrap(ctx, text, width)
  const max = Math.floor(height / (34 * 1.22))
  return { size: 34, lines: lines.length > max ? [...lines.slice(0, max - 1), lines[max - 1].replace(/.{0,2}$/, '…')] : lines }
}

function drawPhoto(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 14)
  ctx.clip()
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)

  // Darken the bottom so the title reads on any photo.
  const g = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)

  ctx.translate(x + 56, y + h - 70)
  ctx.rotate(-0.04)
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 4
  ctx.fillStyle = '#fffaf0'
  ctx.font = SERIF(64)
  ctx.fillText('Postcards from', 0, -112)
  ctx.font = SERIF(118)
  ctx.fillText('Singapore', 0, 0)
  ctx.restore()
}

/** A perforated Singapore postage stamp with an orchid (Vanda Miss Joaquim). */
function drawStamp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = 8
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, w, h)
  ctx.restore()

  // Perforations: bite semicircles out of each edge.
  ctx.fillStyle = PAPER
  const r = 8
  for (let px = x; px <= x + w; px += 22) {
    ctx.beginPath()
    ctx.arc(px, y, r, 0, Math.PI * 2)
    ctx.arc(px, y + h, r, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let py = y; py <= y + h; py += 22) {
    ctx.beginPath()
    ctx.arc(x, py, r, 0, Math.PI * 2)
    ctx.arc(x + w, py, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const ix = x + 18
  const iy = y + 18
  const iw = w - 36
  const ih = h - 36
  const g = ctx.createLinearGradient(0, iy, 0, iy + ih)
  g.addColorStop(0, '#1d4a34')
  g.addColorStop(1, '#2f7a55')
  ctx.fillStyle = g
  ctx.fillRect(ix, iy, iw, ih)

  // Orchid
  ctx.save()
  ctx.translate(ix + iw / 2, iy + ih / 2 + 6)
  ctx.fillStyle = '#c86fc9'
  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5)
    ctx.beginPath()
    ctx.ellipse(0, -25, 15, 25, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#8e2f8f'
  ctx.beginPath()
  ctx.ellipse(0, 12, 17, 19, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f7c948'
  ctx.beginPath()
  ctx.arc(0, 0, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = '#f6f1e4'
  ctx.textAlign = 'center'
  ctx.font = MONO(20)
  ctx.fillText('SINGAPORE', ix + iw / 2, iy + 34)
  ctx.font = MONO(18, false)
  ctx.fillText('2026', ix + iw / 2, iy + ih - 16)
  ctx.textAlign = 'left'
  ctx.font = MONO(22)
  ctx.fillStyle = '#e9c46a'
  ctx.fillText('$1', ix + 10, iy + ih - 40)
}

/** Round "GBTB · FLOWER DOME" postmark with the event date, plus wavy cancellation lines. */
function drawPostmark(ctx: CanvasRenderingContext2D, cx: number, cy: number, date: string) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.18)
  ctx.strokeStyle = 'rgba(42,42,70,0.78)'
  ctx.fillStyle = 'rgba(42,42,70,0.78)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(0, 0, 118, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(0, 0, 106, 0, Math.PI * 2)
  ctx.stroke()

  // Text around the top of the ring
  const label = 'GBTB · FLOWER DOME'
  ctx.font = MONO(17)
  const radius = 86
  const total = ctx.measureText(label).width
  let angle = -Math.PI / 2 - total / radius / 2
  for (const ch of label) {
    const cw = ctx.measureText(ch).width
    ctx.save()
    ctx.rotate(angle + cw / radius / 2 + Math.PI / 2)
    ctx.fillText(ch, -cw / 2, -radius)
    ctx.restore()
    angle += cw / radius
  }

  ctx.textAlign = 'center'
  ctx.font = MONO(21)
  ctx.fillText(date, 0, 14)
  ctx.font = MONO(22)
  ctx.fillText('★', 0, 62)

  // Cancellation waves off to the right, across the stamp
  ctx.lineWidth = 4
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    for (let px = 128; px <= 330; px += 4) {
      const py = i * 30 + Math.sin(px / 18) * 9
      if (px === 128) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  ctx.restore()
}

export async function renderPostcard(input: PostcardInput): Promise<Blob> {
  const [, photo] = await Promise.all([loadFonts(), loadPhoto(input.photoUrl)])
  const c = document.createElement('canvas')
  c.width = POSTCARD_W
  c.height = POSTCARD_H
  const ctx = c.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  // Paper
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, POSTCARD_W, POSTCARD_H)
  ctx.strokeStyle = RULE
  ctx.lineWidth = 4
  ctx.strokeRect(14, 14, POSTCARD_W - 28, POSTCARD_H - 28)

  drawPhoto(ctx, photo, 50, 50, 880, 1100)
  photo.close()

  // Divider
  ctx.strokeStyle = RULE
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(1000, 120)
  ctx.lineTo(1000, 1080)
  ctx.stroke()

  drawStamp(ctx, 1540, 70, 190, 240)
  drawPostmark(ctx, 1430, 225, formatPassportDate(input.eventDate))

  // Message
  const left = 1060
  const width = 680
  const top = 400
  const msgHeight = 470
  const { size, lines } = fitText(ctx, input.message.trim().slice(0, MESSAGE_MAX), width, msgHeight)
  ctx.fillStyle = INK
  ctx.font = HAND(size)
  ctx.textAlign = 'left'
  lines.forEach((line, i) => ctx.fillText(line, left, top + size + i * size * 1.22))

  // Signature
  ctx.font = HAND(50)
  ctx.textAlign = 'right'
  ctx.fillText(`— ${input.firstName}, from ${input.country}`, left + width, top + msgHeight + 70, width)

  // "To:" line
  ctx.textAlign = 'left'
  ctx.strokeStyle = RULE
  ctx.lineWidth = 3
  for (const ly of [1010, 1080]) {
    ctx.beginPath()
    ctx.moveTo(left, ly)
    ctx.lineTo(left + width, ly)
    ctx.stroke()
  }
  ctx.fillStyle = '#6b6555'
  ctx.font = MONO(24)
  ctx.fillText('To:', left, 1000)
  ctx.fillStyle = INK
  ctx.font = HAND(56)
  ctx.fillText(input.to.trim().slice(0, TO_MAX), left + 80, 1000, width - 80)

  ctx.fillStyle = '#8a8270'
  ctx.font = MONO(18, false)
  ctx.fillText('Gardens by the Bay · Flower Dome · Christmas Train Show', left, 1136)

  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png'),
  )
}
