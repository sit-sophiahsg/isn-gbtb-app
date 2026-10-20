import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { hash01, hillPath, layoutGarden, type Hill, type PlacedFlower } from '../lib/garden'
import type { GardenFlower } from '../lib/types'

interface Props {
  flowers: GardenFlower[]
  /** Flower ids that just arrived: they grow up out of the ground. */
  growing: Set<string>
  highlight?: string | null
  onSelect(f: GardenFlower): void
}

/** Illustrated Flower Dome garden: glass ribs, rolling hills with Christmas trees, and every flower on a swaying stem. */
export function GardenScene({ flowers, growing, highlight, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 16, h: 9 })

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width && height) setBox({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const W = 1000
  const H = Math.round((W * box.h) / box.w)
  const layout = useMemo(() => layoutGarden(flowers, W, H), [flowers, H])

  return (
    <div ref={wrap} className="absolute inset-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full select-none" role="group" aria-label={`Garden with ${flowers.length} flowers`}>
        <defs>
          <linearGradient id="g-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--g-sky-top)" />
            <stop offset="1" stopColor="var(--g-sky-bottom)" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#g-sky)" />
        <DomeRibs W={W} H={H} />
        <path d={hillPath(layout.backdrop, W, H)} fill="var(--g-hill-back)" />
        <Trees hill={layout.backdrop} W={W} H={H} scale={0.45} seed="back" count={6} />

        {Array.from({ length: layout.rows }, (_, r) => (
          <g key={r}>
            {layout.flowers
              .filter((p) => p.row === r)
              .map((p) => (
                <Flower key={p.flower.id} p={p} grow={growing.has(p.flower.id)} highlight={highlight === p.flower.id} onSelect={onSelect} />
              ))}
            <path d={hillPath(layout.hills[r], W, H)} fill={`var(--g-hill-${Math.min(r, 3)})`} />
            <Trees hill={layout.hills[r]} W={W} H={H} scale={0.55 + r * 0.17} seed={`row${r}`} count={r === layout.rows - 1 ? 2 : 3} />
          </g>
        ))}
      </svg>
    </div>
  )
}

function Flower({ p, grow, highlight, onSelect }: { p: PlacedFlower; grow: boolean; highlight: boolean; onSelect(f: GardenFlower): void }) {
  const { x, baseY, bloomX, bloomY, size } = p
  const midY = (baseY + bloomY) / 2
  const stemEndY = bloomY + size * 0.18
  const origin = { transformOrigin: `${x}px ${baseY}px` }
  const label = `${p.flower.flowerName}, planted by ${p.flower.firstName} from ${p.flower.country}`

  return (
    <g className={grow ? 'garden-grow' : undefined} style={origin}>
      <g
        className="garden-sway cursor-pointer outline-none"
        style={{ ...origin, animationDuration: `${p.swaySeconds}s`, animationDelay: `${p.swayDelay}s` } as CSSProperties}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => onSelect(p.flower)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(p.flower)
          }
        }}
      >
        <path
          d={`M ${x} ${baseY} Q ${x + (bloomX - x) * 0.2} ${midY} ${bloomX} ${stemEndY}`}
          stroke="var(--g-stem)"
          strokeWidth={Math.max(2.5, size * 0.055)}
          strokeLinecap="round"
          fill="none"
        />
        <ellipse
          cx={x + (bloomX - x) * 0.15 + p.leafSide * size * 0.16}
          cy={midY + size * 0.12}
          rx={size * 0.17}
          ry={size * 0.065}
          transform={`rotate(${p.leafSide * -28} ${x + (bloomX - x) * 0.15 + p.leafSide * size * 0.16} ${midY + size * 0.12})`}
          fill="var(--g-leaf)"
        />
        {highlight && (
          <circle cx={bloomX} cy={bloomY} r={size * 0.62} fill="none" stroke="var(--gold)" strokeWidth={4} className="garden-pulse" />
        )}
        {/* Larger invisible target so small back-row flowers are easy to tap. */}
        <circle cx={bloomX} cy={bloomY} r={Math.max(size * 0.55, 26)} fill="transparent" />
        <image href={p.flower.imageUrl} x={bloomX - size / 2} y={bloomY - size / 2} width={size} height={size} />
      </g>
    </g>
  )
}

function DomeRibs({ W, H }: { W: number; H: number }) {
  const cx = W / 2
  const base = H * 0.92
  // Half-ellipses sharing a top point above the frame, so the meridians meet off-screen like a real glass dome.
  const ry = base + H * 0.35
  const ribs = [0.12, 0.28, 0.45, 0.63, 0.82, 1.02, 1.25]
  return (
    <g stroke="var(--g-rib)" fill="none" strokeWidth={2.2}>
      {ribs.map((t) => {
        const rx = W * 0.6 * t
        return <path key={t} d={`M ${cx - rx} ${base} A ${rx} ${ry} 0 0 1 ${cx + rx} ${base}`} />
      })}
      {[0.16, 0.3, 0.45].map((t) => (
        <path key={t} d={`M ${-W * 0.05} ${H * (t + 0.18)} Q ${cx} ${H * (t - 0.12)} ${W * 1.05} ${H * (t + 0.18)}`} strokeWidth={1.4} />
      ))}
    </g>
  )
}

/** Small decorated Christmas trees dotted along a hill. */
function Trees({ hill, W, H, scale, seed, count }: { hill: Hill; W: number; H: number; scale: number; seed: string; count: number }) {
  const s = (H / 9) * 0.55 * scale + (W / 16) * 0.2 * scale
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x = ((i + 0.5) / count + (hash01(seed, i) - 0.5) * 0.18) * W
        const y = hill.y(x) + s * 0.1
        const tw = s * 0.62
        return (
          <g key={i}>
            <rect x={x - s * 0.06} y={y - s * 0.12} width={s * 0.12} height={s * 0.16} fill="var(--g-trunk)" />
            {[0, 1, 2].map((t) => (
              <path
                key={t}
                d={`M ${x - tw * (1 - t * 0.22)} ${y - s * 0.1 - t * s * 0.3} L ${x} ${y - s * 0.62 - t * s * 0.3} L ${x + tw * (1 - t * 0.22)} ${y - s * 0.1 - t * s * 0.3} Z`}
                fill="var(--g-tree)"
              />
            ))}
            {[
              [-0.25, -0.25, '#e63946'],
              [0.22, -0.42, '#f7c948'],
              [-0.1, -0.62, '#3a86ff'],
              [0.15, -0.8, '#e63946'],
            ].map(([dx, dy, c], j) => (
              <circle key={j} cx={x + (dx as number) * s} cy={y + (dy as number) * s} r={s * 0.045} fill={c as string} />
            ))}
            <path
              d={`M ${x} ${y - s * 1.32} l ${s * 0.05} ${s * 0.1} l ${s * 0.11} 0 l -${s * 0.09} ${s * 0.07} l ${s * 0.04} ${s * 0.11} l -${s * 0.11} -${s * 0.07} l -${s * 0.11} ${s * 0.07} l ${s * 0.04} -${s * 0.11} l -${s * 0.09} -${s * 0.07} l ${s * 0.11} 0 Z`}
              fill="#f7c948"
            />
          </g>
        )
      })}
    </g>
  )
}
