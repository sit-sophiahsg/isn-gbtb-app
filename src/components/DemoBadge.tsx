import { resetDemo } from '../lib/api/demo'

/** Slim strip at the top of every page so it's obvious the site is running on sample data, not Supabase. */
export function DemoBadge() {
  function reset() {
    if (!confirm('Reset the demo to its sample data?')) return
    resetDemo()
    try {
      localStorage.removeItem('postcards:session')
      localStorage.removeItem('postcards:admin')
    } catch {
      // ignore
    }
    location.assign('/')
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-gold-soft px-3 text-xs text-ink dark:bg-warn dark:text-paper">
      <p className="py-1">
        <span className="font-mono font-bold tracking-wider uppercase">Demo mode</span>
        <span className="hidden sm:inline"> · sample data in this browser only</span>
      </p>
      <button onClick={reset} className="min-h-6 font-semibold underline">
        Reset
      </button>
    </div>
  )
}
