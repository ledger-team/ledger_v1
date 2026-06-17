// Deterministic course → color mapping. Same courseId always yields the same
// palette color (consistent dots across the app). Palette tokens live in
// globals.css (--color-course-1..7).

const PALETTE = [
  '--color-course-1',
  '--color-course-2',
  '--color-course-3',
  '--color-course-4',
  '--color-course-5',
  '--color-course-6',
  '--color-course-7',
] as const

export const COURSE_PALETTE_SIZE = PALETTE.length

export function courseColorVar(courseId: string): string {
  let hash = 0
  for (let i = 0; i < courseId.length; i++) {
    hash = (hash * 31 + courseId.charCodeAt(i)) >>> 0
  }
  return `var(${PALETTE[hash % PALETTE.length]})`
}
