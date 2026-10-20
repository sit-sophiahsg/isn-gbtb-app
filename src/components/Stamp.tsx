import { useId, type CSSProperties } from 'react'
import type { StampDef } from '../lib/stamps'

interface Props {
  def: StampDef
  inked: boolean
  /** Play the "slam down" animation (when a stamp has just been collected). */
  press?: boolean
  className?: string
}

/**
 * The round GBTB stamp: double ring, "GBTB" across the top, the stamp name in the centre,
 * "★ 2026 ★" at the bottom. Faint dashed outline until it's collected.
 */
export function Stamp({ def, inked, press, className = '' }: Props) {
  const uid = useId().replace(/:/g, '')
  const longest = Math.max(...def.lines.map((l) => l.length))
  const fontSize = Math.min(21, 98 / (0.6 * longest), def.lines.length === 3 ? 16 : 21)
  const lineHeight = fontSize * 1.08
  const firstY = 100 - ((def.lines.length - 1) * lineHeight) / 2 + fontSize * 0.36
  const seed = def.key.length * 7 + def.lines.join('').length

  const style = {
    '--stamp-ink': def.ink,
    '--stamp-ink-dark': def.inkDark,
    '--tilt': `${def.tilt}deg`,
    transform: inked && !press ? `rotate(${def.tilt}deg)` : undefined,
  } as CSSProperties

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={`${def.title} stamp${inked ? ', collected' : ', not collected yet'}`}
      className={`stamp ${press ? 'stamp-press' : ''} ${className}`}
      style={style}
    >
      <defs>
        <path id={`top-${uid}`} d="M 32 100 A 68 68 0 0 1 168 100" />
        <path id={`bot-${uid}`} d="M 21 100 A 79 79 0 0 0 179 100" />
        {inked && (
          <filter id={`ink-${uid}`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" result="rough" />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.9 1.95"
              result="speckle"
            />
            <feComposite in="rough" in2="speckle" operator="in" />
          </filter>
        )}
      </defs>

      <g
        filter={inked ? `url(#ink-${uid})` : undefined}
        opacity={inked ? 0.95 : 0.32}
        fill="none"
        stroke="currentColor"
        strokeDasharray={inked ? undefined : '5 4'}
      >
        <circle cx="100" cy="100" r="95" strokeWidth="4.5" />
        <circle cx="100" cy="100" r="88" strokeWidth="1.6" />
        <circle cx="100" cy="100" r="60" strokeWidth="1.6" />

        <g fill="currentColor" stroke="none" fontFamily="'Space Mono', monospace" fontWeight="700">
          <text fontSize="17" letterSpacing="5" textAnchor="middle">
            <textPath href={`#top-${uid}`} startOffset="50%">
              GBTB
            </textPath>
          </text>
          <text fontSize="12.5" letterSpacing="2" textAnchor="middle">
            <textPath href={`#bot-${uid}`} startOffset="50%">
              ★ 2026 ★
            </textPath>
          </text>
          {def.lines.map((line, i) => (
            <text key={i} x="100" y={firstY + i * lineHeight} fontSize={fontSize} textAnchor="middle">
              {line}
            </text>
          ))}
        </g>
      </g>
    </svg>
  )
}
