// Sample artwork for demo mode, drawn in code so the repo needs no image files.
import type { StampKey } from './types'

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  return { c, ctx }
}

// ---------------------------------------------------------------------------
// Flower drawings: transparent PNGs that look finger-drawn.
// ---------------------------------------------------------------------------

type Style = 'round' | 'pointy' | 'tulip' | 'sunflower' | 'daisy' | 'rose' | 'lily' | 'pompom'

export const DEMO_FLOWER_STYLES: { style: Style; petal: string; centre: string }[] = [
  { style: 'round', petal: '#e8508a', centre: '#f7c948' },
  { style: 'sunflower', petal: '#f5b301', centre: '#7a4a1e' },
  { style: 'pointy', petal: '#8a5cf6', centre: '#ffd166' },
  { style: 'tulip', petal: '#e63946', centre: '#e63946' },
  { style: 'daisy', petal: '#ffffff', centre: '#f4a300' },
  { style: 'rose', petal: '#d62859', centre: '#d62859' },
  { style: 'lily', petal: '#ff8c42', centre: '#7a2e0e' },
  { style: 'pompom', petal: '#3fa7d6', centre: '#1d4e89' },
  { style: 'round', petal: '#ff9fb2', centre: '#ffffff' },
  { style: 'pointy', petal: '#ef476f', centre: '#06d6a0' },
  { style: 'lily', petal: '#f0e6ff', centre: '#9b5de5' },
  { style: 'sunflower', petal: '#ff6b35', centre: '#3d1f0b' },
]

function wobblyPath(ctx: CanvasRenderingContext2D, pts: [number, number][], r: () => number, amt: number) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => {
    const jx = x + (r() - 0.5) * amt
    const jy = y + (r() - 0.5) * amt
    if (i === 0) ctx.moveTo(jx, jy)
    else ctx.lineTo(jx, jy)
  })
}

function petalPoints(cx: number, cy: number, angle: number, len: number, width: number, pointy: boolean): [number, number][] {
  const pts: [number, number][] = []
  const steps = 18
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const along = (1 - Math.cos(t)) / 2
    let across = Math.sin(t) * width
    if (pointy) across *= Math.sin(along * Math.PI) ** 0.6
    const x = along * len
    pts.push([cx + x * Math.cos(angle) - across * Math.sin(angle), cy + x * Math.sin(angle) + across * Math.cos(angle)])
  }
  return pts
}

function darker(hex: string, f = 0.7) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (s: number) => Math.round(((n >> s) & 255) * f)
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

export function drawDemoFlower(index: number): string {
  const { style, petal, centre } = DEMO_FLOWER_STYLES[index % DEMO_FLOWER_STYLES.length]
  const r = rng(index * 977 + 13)
  const { c, ctx } = canvas(600, 600)
  const cx = 300
  const cy = 300
  const outline = darker(petal === '#ffffff' ? '#9a9a9a' : petal, 0.62)
  ctx.lineWidth = 9

  const petals = (n: number, len: number, width: number, pointy: boolean, offset = 0) => {
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.15
      wobblyPath(ctx, petalPoints(cx, cy, a, len * (0.9 + r() * 0.2), width, pointy), r, 6)
      ctx.closePath()
      ctx.fillStyle = petal
      ctx.fill()
      ctx.strokeStyle = outline
      ctx.stroke()
    }
  }
  const dot = (rad: number, fill: string) => {
    ctx.beginPath()
    ctx.arc(cx, cy, rad, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = darker(fill === '#ffffff' ? '#bbbbbb' : fill, 0.65)
    ctx.stroke()
  }

  switch (style) {
    case 'round':
      petals(5 + Math.floor(r() * 2), 200, 85, false)
      dot(62, centre)
      break
    case 'pointy':
      petals(8, 230, 48, true)
      dot(50, centre)
      break
    case 'sunflower':
      petals(16, 235, 32, true)
      petals(16, 200, 30, true, Math.PI / 16)
      dot(95, centre)
      ctx.fillStyle = darker(centre, 0.6)
      for (let i = 0; i < 40; i++) {
        const a = i * 2.4
        const d = Math.sqrt(i) * 13
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 6, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    case 'daisy':
      petals(14, 230, 30, false)
      dot(58, centre)
      break
    case 'tulip': {
      ctx.fillStyle = petal
      ctx.strokeStyle = outline
      ctx.lineWidth = 10
      wobblyPath(ctx, [[160, 200], [210, 330], [300, 470], [390, 330], [440, 200], [370, 270], [300, 140], [230, 270], [160, 200]], r, 8)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(300, 160)
      ctx.lineTo(300, 440)
      ctx.strokeStyle = darker(petal, 0.8)
      ctx.lineWidth = 6
      ctx.stroke()
      break
    }
    case 'rose':
      dot(210, petal)
      ctx.strokeStyle = darker(petal, 0.55)
      ctx.lineWidth = 11
      ctx.beginPath()
      for (let t = 0; t < Math.PI * 7; t += 0.12) {
        const rad = 8 + t * 9
        const x = cx + Math.cos(t) * rad + (r() - 0.5) * 4
        const y = cy + Math.sin(t) * rad + (r() - 0.5) * 4
        if (t === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      break
    case 'lily':
      petals(6, 250, 58, true)
      ctx.strokeStyle = darker(centre, 0.9)
      ctx.lineWidth = 6
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a + 0.4) * 95, cy + Math.sin(a + 0.4) * 95, 10, 0, Math.PI * 2)
        ctx.fillStyle = centre
        ctx.fill()
      }
      break
    case 'pompom':
      ctx.lineWidth = 16
      for (let i = 0; i < 90; i++) {
        const a = r() * Math.PI * 2
        const d = 40 + r() * 190
        ctx.strokeStyle = i % 3 ? petal : centre
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * d * 0.3, cy + Math.sin(a) * d * 0.3)
        ctx.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d)
        ctx.stroke()
      }
      break
  }
  return c.toDataURL('image/png')
}

// ---------------------------------------------------------------------------
// Stamp photos: simple illustrated scenes standing in for real photos.
// ---------------------------------------------------------------------------

export function drawDemoPhoto(kind: StampKey): string {
  const { c, ctx } = canvas(1200, 900)
  const r = rng(kind.length * 31)
  const sky = (top: string, bottom: string) => {
    const g = ctx.createLinearGradient(0, 0, 0, 900)
    g.addColorStop(0, top)
    g.addColorStop(1, bottom)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1200, 900)
  }

  switch (kind) {
    case 'flower_home': {
      sky('#cfe8c4', '#7fb36a')
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = `rgba(30,90,50,${0.25 + r() * 0.3})`
        ctx.beginPath()
        ctx.ellipse(r() * 1200, 500 + r() * 400, 120, 50, r() * 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.save()
      ctx.translate(600, 430)
      ctx.fillStyle = '#e0245e'
      for (let i = 0; i < 5; i++) {
        ctx.rotate((Math.PI * 2) / 5)
        ctx.beginPath()
        ctx.ellipse(0, -150, 120, 160, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = '#a0103e'
      ctx.lineWidth = 6
      for (let i = 0; i < 5; i++) {
        ctx.rotate((Math.PI * 2) / 5)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(0, -220)
        ctx.stroke()
      }
      ctx.strokeStyle = '#ffd23f'
      ctx.lineWidth = 12
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(60, 120, 140, 170)
      ctx.stroke()
      ctx.fillStyle = '#ffd23f'
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.arc(130 + i * 6, 160 + (i % 2) * 14, 10, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      break
    }
    case 'this_is_sg': {
      sky('#ffb37a', '#6a4c93')
      ctx.fillStyle = '#ffd9a0'
      ctx.beginPath()
      ctx.arc(900, 360, 90, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#2b2350'
      ctx.fillRect(0, 700, 1200, 200)
      // Three towers with the boat on top
      for (const x of [380, 520, 660]) {
        ctx.beginPath()
        ctx.moveTo(x, 700)
        ctx.lineTo(x + 20, 300)
        ctx.lineTo(x + 90, 300)
        ctx.lineTo(x + 100, 700)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.moveTo(340, 300)
      ctx.quadraticCurveTo(560, 250, 820, 270)
      ctx.lineTo(820, 300)
      ctx.lineTo(350, 310)
      ctx.fill()
      // Supertrees
      ctx.strokeStyle = '#2b2350'
      ctx.lineWidth = 18
      for (const [x, h] of [[120, 380], [230, 300], [960, 340], [1080, 260]] as const) {
        ctx.beginPath()
        ctx.moveTo(x, 700)
        ctx.lineTo(x, 700 - h)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x - 70, 700 - h - 40)
        ctx.quadraticCurveTo(x, 700 - h + 40, x + 70, 700 - h - 40)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(255,217,160,0.5)'
      for (let i = 0; i < 40; i++) ctx.fillRect(400 + r() * 360, 330 + r() * 360, 8, 12)
      break
    }
    case 'swap_story': {
      sky('#bde0fe', '#a2d2ff')
      const face = (x: number, skin: string, hair: string) => {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.roundRect(x - 150, 620, 300, 300, 120)
        ctx.fill()
        ctx.fillStyle = skin
        ctx.beginPath()
        ctx.arc(x, 470, 150, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = hair
        ctx.beginPath()
        ctx.arc(x, 420, 155, Math.PI, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#222'
        ctx.beginPath()
        ctx.arc(x - 50, 480, 14, 0, Math.PI * 2)
        ctx.arc(x + 50, 480, 14, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#222'
        ctx.lineWidth = 10
        ctx.beginPath()
        ctx.arc(x, 520, 50, 0.2, Math.PI - 0.2)
        ctx.stroke()
      }
      face(400, '#e0ac69', '#3b2219')
      face(800, '#f1c27d', '#1a1a1a')
      ctx.font = '600 64px system-ui, sans-serif'
      ctx.textAlign = 'center'
      for (const [x, y, t] of [[300, 170, 'saudade!'], [880, 150, 'shiok!']] as const) {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.roundRect(x - 170, y - 70, 340, 120, 50)
        ctx.fill()
        ctx.fillStyle = '#1d4a34'
        ctx.fillText(t, x, y + 12)
      }
      break
    }
    case 'bridge': {
      sky('#1b263b', '#415a77')
      ctx.strokeStyle = '#e0e1dd'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(0, 200)
      ctx.quadraticCurveTo(600, 420, 1200, 200)
      ctx.stroke()
      const colours = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93']
      for (let i = 0; i < 22; i++) {
        const t = i / 21
        const x = t * 1200
        const y = 200 + 4 * t * (1 - t) * 220 + 30
        ctx.fillStyle = colours[i % 5]
        ctx.beginPath()
        ctx.ellipse(x, y, 16, 24, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const [x, col] of [[330, '#d62828'], [870, '#d62828']] as const) {
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.ellipse(x, 600, 120, 150, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fcbf49'
        ctx.fillRect(x - 70, 440, 140, 24)
        ctx.fillRect(x - 70, 736, 140, 24)
      }
      ctx.fillStyle = '#fcbf49'
      ctx.font = '700 70px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('★', 600, 640)
      break
    }
    case 'seasonal': {
      sky('#d8f3dc', '#95d5b2')
      ctx.fillStyle = '#40916c'
      ctx.beginPath()
      ctx.moveTo(150, 330)
      ctx.lineTo(600, 160)
      ctx.lineTo(1050, 330)
      ctx.fill()
      ctx.fillStyle = '#b7e4c7'
      ctx.fillRect(220, 330, 40, 330)
      ctx.fillRect(940, 330, 40, 330)
      ctx.fillStyle = '#6c757d'
      ctx.fillRect(0, 760, 1200, 20)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(120, 470, 960, 280, 60)
      ctx.fill()
      ctx.fillStyle = '#d00000'
      ctx.fillRect(120, 640, 960, 34)
      ctx.fillStyle = '#1d3557'
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.roundRect(190 + i * 145, 510, 110, 100, 14)
        ctx.fill()
      }
      ctx.fillStyle = '#343a40'
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.arc(230 + i * 150, 760, 26, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#1d4a34'
      ctx.font = '700 56px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Bayfront', 600, 280)
      break
    }
  }
  return c.toDataURL('image/jpeg', 0.85)
}
