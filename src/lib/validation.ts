/** Every participant is an SIT student: student IDs are exactly 7 digits. */
export const STUDENT_ID_PATTERN = /^\d{7}$/

export function isValidStudentId(value: string): boolean {
  return STUDENT_ID_PATTERN.test(value.trim())
}

/** Name used for rejoin matching: ignores case, extra spaces and accents ("  José " matches "jose"). */
export function nameKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanFirstName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, 30)
}
