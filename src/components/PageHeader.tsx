import { Link } from 'react-router-dom'

/** Sticky top bar with a back link to the passport. */
export function PageHeader({ title, back = '/passport', backLabel = 'Passport' }: { title?: string; back?: string; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <Link to={back} className="flex min-h-12 items-center gap-1 px-3 font-semibold">
          <span aria-hidden="true">←</span> {backLabel}
        </Link>
        {title && <span className="px-3 font-mono text-xs tracking-[0.2em] text-ink-soft uppercase">{title}</span>}
      </div>
    </header>
  )
}
