/** Gold passport-cover emblem: a five-petal bloom inside a double ring. */
export function Emblem({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={className}>
      <g fill="none" stroke="currentColor">
        <circle cx="60" cy="60" r="56" strokeWidth="3" />
        <circle cx="60" cy="60" r="49" strokeWidth="1.2" />
      </g>
      <g fill="currentColor" transform="translate(60 58)">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} rx="8" ry="17" transform={`rotate(${r}) translate(0 -15)`} />
        ))}
        <circle r="7" className="fill-cover" />
        <circle r="4" />
      </g>
      <path d="M60 79 C 60 90, 58 96, 55 104" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <path d="M59 92 C 66 88, 72 89, 76 92 C 70 96, 64 96, 59 92 Z" fill="currentColor" />
    </svg>
  )
}
