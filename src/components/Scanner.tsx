import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'

/** Full-bleed camera view that reports the first QR it sees. */
export function Scanner({ onResult, paused }: { onResult: (text: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const scanner = useRef<QrScanner | null>(null)
  const cb = useRef(onResult)
  cb.current = onResult
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!video.current) return
    const s = new QrScanner(video.current, (r) => cb.current(r.data), {
      preferredCamera: 'environment',
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 8,
    })
    scanner.current = s
    s.start().catch((e: unknown) => {
      const msg = String((e as Error)?.message ?? e)
      setError(
        /denied|NotAllowed|permission/i.test(msg)
          ? 'Camera access was blocked. Allow camera for this site in your browser settings, then reload.'
          : 'Could not start the camera. ' + msg,
      )
    })
    return () => { s.stop(); s.destroy(); scanner.current = null }
  }, [])

  const wasPaused = useRef(false)
  useEffect(() => {
    const s = scanner.current
    if (!s || paused === wasPaused.current) return
    wasPaused.current = Boolean(paused)
    if (paused) void s.pause()
    else void s.start().catch(() => {})
  }, [paused])

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black">
      <video ref={video} className="h-full w-full object-cover" playsInline muted />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center font-semibold text-white">
          {error}
        </div>
      )}
    </div>
  )
}

export type ParsedQr = { type: 'checkpoint'; token: string } | { type: 'group'; token: string } | null

/** Our QR codes are URLs: <site>/s/<token> (checkpoint) or <site>/join/<token> (group). */
export function parseQr(text: string): ParsedQr {
  let path = text.trim()
  try { path = new URL(path).pathname } catch { /* not a URL: try as-is */ }
  const m = path.match(/\/(s|join)\/([a-f0-9]{32})\/?$/i)
  if (!m) return null
  return { type: m[1] === 's' ? 'checkpoint' : 'group', token: m[2].toLowerCase() }
}
