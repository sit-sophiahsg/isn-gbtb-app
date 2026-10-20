import type { EventInfo, Student } from '../lib/types'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function formatPassportDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`
}

function mrzText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '<')
}

/** ICAO 9303 check digit, so the MRZ looks the part. */
function checkDigit(s: string): number {
  const weights = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const v = c === '<' ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55
    sum += v * weights[i % 3]
  }
  return sum % 10
}

function mrzLines(student: Student, event: EventInfo): [string, string] {
  const line1 = `P<GBTB${mrzText(student.firstName)}<<${mrzText('Postcards from Singapore')}`.padEnd(44, '<').slice(0, 44)
  const date = event.eventDate.replace(/-/g, '').slice(2)
  const country = mrzText(student.country).replace(/</g, '').slice(0, 3).padEnd(3, '<')
  const line2 = `${student.studentId}${checkDigit(student.studentId)}${country}${date}${checkDigit(date)}<FLOWER<DOME`
    .padEnd(44, '<')
    .slice(0, 44)
  return [line1, line2]
}

export function PhotoPage({ student, event }: { student: Student; event: EventInfo }) {
  const [l1, l2] = mrzLines(student, event)
  return (
    <section
      aria-label="Passport photo page"
      className="paper relative overflow-hidden rounded-2xl border border-rule shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-rule px-4 pt-3 pb-2">
        <p className="font-mono text-[0.7rem] tracking-[0.18em] text-ink-soft uppercase">Passport · Passeport</p>
        <p className="font-mono text-[0.7rem] tracking-[0.18em] text-ink-soft uppercase">GBTB</p>
      </div>

      <div className="flex gap-4 px-4 py-4">
        <div
          aria-hidden="true"
          className="flex aspect-[3/4] w-[30%] max-w-28 shrink-0 flex-col items-center justify-center rounded-md border border-rule bg-paper-2"
        >
          <svg viewBox="0 0 100 100" className="w-3/4 text-cover dark:text-gold">
            <g fill="currentColor" opacity="0.85" transform="translate(50 46)">
              {[0, 72, 144, 216, 288].map((r) => (
                <ellipse key={r} rx="10" ry="22" transform={`rotate(${r}) translate(0 -19)`} />
              ))}
            </g>
            <circle cx="50" cy="46" r="9" className="fill-gold dark:fill-paper" />
            <path d="M50 66 C 50 80, 48 88, 46 96" stroke="currentColor" strokeWidth="3" fill="none" />
          </svg>
          <span className="mt-1 font-serif text-2xl text-ink">{student.firstName.charAt(0).toUpperCase()}</span>
        </div>

        <dl className="grid min-w-0 flex-1 gap-y-2 font-mono text-sm">
          <Field label="Given name" value={student.firstName} big />
          <Field label="Home country" value={student.country} />
          <Field label="Student ID" value={student.studentId} />
          <Field label="Issued at" value="Flower Dome" />
          <Field label="Date" value={formatPassportDate(event.eventDate)} />
        </dl>
      </div>

      <div className="mrz-wrap border-t border-rule bg-paper-2/70 px-4 py-2 text-ink-soft" aria-hidden="true">
        <div className="mrz">{l1}</div>
        <div className="mrz">{l2}</div>
      </div>
    </section>
  )
}

function Field({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.68rem] tracking-[0.12em] text-ink-soft uppercase">{label}</dt>
      <dd className={`break-words font-bold text-ink ${big ? 'font-serif text-2xl font-normal' : ''}`}>{value}</dd>
    </div>
  )
}
