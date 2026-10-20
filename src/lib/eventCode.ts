const LAST_CODE_KEY = 'postcards:lastEventCode'

/** Remembered so the code survives logging out and reopening the site without the QR link. */
export function lastEventCode(): string {
  try {
    return localStorage.getItem(LAST_CODE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberEventCode(code: string) {
  try {
    localStorage.setItem(LAST_CODE_KEY, code)
  } catch {
    // Private browsing: they'll just type the code next time.
  }
}
