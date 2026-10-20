import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react'

const SIZE = 600

export const COLOURS = [
  { name: 'Orchid pink', value: '#e8508a' },
  { name: 'Red', value: '#e63946' },
  { name: 'Orange', value: '#ff8c42' },
  { name: 'Yellow', value: '#f7c948' },
  { name: 'White', value: '#ffffff' },
  { name: 'Sky blue', value: '#3a86ff' },
  { name: 'Purple', value: '#8a5cf6' },
  { name: 'Leaf green', value: '#2d8a4e' },
]

const BRUSHES = [
  { name: 'Thin', value: 9 },
  { name: 'Medium', value: 20 },
  { name: 'Thick', value: 38 },
]

interface Stroke {
  color: string
  size: number
  points: [number, number][]
}

export interface DrawingHandle {
  /** Transparent PNG cropped to the drawing, or null if nothing has been drawn. */
  toBlob(): Promise<Blob | null>
  isEmpty(): boolean
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineWidth = s.size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (s.points.length === 1) {
    const [x, y] = s.points[0]
    ctx.beginPath()
    ctx.arc(x, y, s.size / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(s.points[0][0], s.points[0][1])
  // Smooth through midpoints so finger strokes don't look jagged.
  for (let i = 1; i < s.points.length - 1; i++) {
    const [x, y] = s.points[i]
    const [nx, ny] = s.points[i + 1]
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
  }
  const last = s.points[s.points.length - 1]
  ctx.lineTo(last[0], last[1])
  ctx.stroke()
}

export const DrawingCanvas = forwardRef<DrawingHandle, { onChange?: (empty: boolean) => void }>(function DrawingCanvas(
  { onChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Stroke[]>([])
  const current = useRef<Stroke | null>(null)
  const [color, setColor] = useState(COLOURS[0].value)
  const [size, setSize] = useState(BRUSHES[1].value)
  const [count, setCount] = useState(0)

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, SIZE, SIZE)
    strokes.current.forEach((s) => drawStroke(ctx, s))
  }, [])

  useEffect(() => onChange?.(count === 0), [count, onChange])

  function point(e: PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - rect.left) / rect.width) * SIZE, ((e.clientY - rect.top) / rect.height) * SIZE]
  }

  function down(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    current.current = { color, size, points: [point(e)] }
    strokes.current.push(current.current)
    redraw()
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!current.current) return
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    const rect = e.currentTarget.getBoundingClientRect()
    for (const ev of events) {
      current.current.points.push([((ev.clientX - rect.left) / rect.width) * SIZE, ((ev.clientY - rect.top) / rect.height) * SIZE])
    }
    redraw()
  }

  function up() {
    if (!current.current) return
    current.current = null
    setCount(strokes.current.length)
  }

  function undo() {
    strokes.current.pop()
    redraw()
    setCount(strokes.current.length)
  }

  function clear() {
    strokes.current = []
    redraw()
    setCount(0)
  }

  useImperativeHandle(ref, () => ({
    isEmpty: () => strokes.current.length === 0,
    async toBlob() {
      const src = canvasRef.current
      if (!src || !strokes.current.length) return null
      const ctx = src.getContext('2d')!
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE)
      let minX = SIZE, minY = SIZE, maxX = -1, maxY = -1
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          if (data[(y * SIZE + x) * 4 + 3] > 8) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
      if (maxX < 0) return null
      // Square crop around the drawing so every bloom sits centred on its stem.
      const side = Math.max(maxX - minX, maxY - minY) * 1.08 + 8
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      const out = document.createElement('canvas')
      const outSize = Math.min(SIZE, Math.max(160, Math.round(side)))
      out.width = outSize
      out.height = outSize
      out.getContext('2d')!.drawImage(src, cx - side / 2, cy - side / 2, side, side, 0, 0, outSize, outSize)
      return new Promise((resolve) => out.toBlob((b) => resolve(b), 'image/png'))
    },
  }))

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border-2 border-rule bg-[radial-gradient(circle_at_50%_40%,#e6f2df,#c9e2bf)] dark:bg-[radial-gradient(circle_at_50%_40%,#2d4a33,#1e3323)]">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="Drawing area for your flower"
          role="img"
          className="block aspect-square w-full cursor-crosshair touch-none"
        />
        {count === 0 && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-lg text-cover/70 dark:text-gold/70">
            Draw your bloom here with your finger. We'll add the stem!
          </p>
        )}
      </div>

      <div role="radiogroup" aria-label="Colour" className="grid grid-cols-8 gap-1.5">
        {COLOURS.map((c) => (
          <button
            key={c.value}
            role="radio"
            aria-checked={color === c.value}
            aria-label={c.name}
            onClick={() => setColor(c.value)}
            className={`aspect-square min-h-10 rounded-full border-2 transition ${color === c.value ? 'scale-110 border-ink ring-2 ring-gold' : 'border-rule'}`}
            style={{ background: c.value }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="radiogroup" aria-label="Brush size" className="flex gap-1.5">
          {BRUSHES.map((b) => (
            <button
              key={b.value}
              role="radio"
              aria-checked={size === b.value}
              aria-label={b.name}
              onClick={() => setSize(b.value)}
              className={`flex size-12 items-center justify-center rounded-xl border-2 ${size === b.value ? 'border-cover bg-cover/10 dark:border-gold dark:bg-gold/15' : 'border-rule'}`}
            >
              <span className="rounded-full bg-ink" style={{ width: b.value / 2 + 2, height: b.value / 2 + 2 }} />
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button onClick={undo} disabled={!count} className="min-h-12 rounded-xl border-2 border-rule px-4 font-semibold disabled:opacity-40">
            ↶ Undo
          </button>
          <button onClick={clear} disabled={!count} className="min-h-12 rounded-xl border-2 border-rule px-4 font-semibold disabled:opacity-40">
            Clear
          </button>
        </div>
      </div>
    </div>
  )
})
