// One-off diagnostic: how much usable text does Canvas actually give us?
//
// An AI study guide is generated from Assignment.description. If most real
// DSISD assignments say "See attached" or nothing, the feature produces filler
// no matter how good the prompt is, and the design has to change (pull
// submissions/files, or lean on non-AI tools instead). Measure before building.
//
//   pnpm tsx scripts/check-assignment-content.ts
//
// Service-role client on purpose: this is a local operator script reading your
// own synced data, not a user-facing path.

import { prisma } from '../src/lib/db/prisma'

// Canvas descriptions are HTML. Strip tags and entities so length reflects
// actual prose rather than markup.
function toText(html: string | null): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Rough floor for "there is something here to study from". Two sentences of
// real instruction clears this; "See attached" does not.
const USABLE_CHARS = 200

// Where the real content lives when the description itself is thin.
//   canvasFile — hosted in Canvas, reachable server-side with the user's token
//   googleDrive — shared inside the DSISD Workspace; the server can never fetch
//     these, since auth belongs to the student's browser, not to us
const CANVAS_FILE = /\/(?:courses\/\d+\/)?files\/\d+/i
const GOOGLE_DRIVE = /(?:docs|drive)\.google\.com/i
const ANY_LINK = /<a\s[^>]*href=/i

async function main() {
  const assignments = await prisma.assignment.findMany({
    where: { isTestData: false },
    select: {
      name: true,
      description: true,
      pointsPossible: true,
      submissionType: true,
      course: { select: { name: true, courseCode: true } },
    },
  })

  if (assignments.length === 0) {
    console.log('No non-test assignments found. Has a real Canvas sync run against this database?')
    return
  }

  const rows = assignments.map((a) => ({
    name: a.name,
    course: a.course.courseCode || a.course.name,
    text: toText(a.description),
    submissionType: a.submissionType,
    // Run the link patterns against the RAW html — toText() strips hrefs.
    hasCanvasFile: CANVAS_FILE.test(a.description ?? ''),
    hasDrive: GOOGLE_DRIVE.test(a.description ?? ''),
    hasAnyLink: ANY_LINK.test(a.description ?? ''),
  }))

  const empty = rows.filter((r) => r.text.length === 0)
  const thin = rows.filter((r) => r.text.length > 0 && r.text.length < USABLE_CHARS)
  const usable = rows.filter((r) => r.text.length >= USABLE_CHARS)
  const pct = (n: number) => `${((n / rows.length) * 100).toFixed(0)}%`

  const lengths = rows.map((r) => r.text.length).sort((a, b) => a - b)
  const median = lengths[Math.floor(lengths.length / 2)] ?? 0

  console.log(`\nAssignments analyzed: ${rows.length}\n`)
  console.log(`  empty description        ${String(empty.length).padStart(4)}  ${pct(empty.length)}`)
  console.log(`  under ${USABLE_CHARS} chars (thin)   ${String(thin.length).padStart(4)}  ${pct(thin.length)}`)
  console.log(`  ${USABLE_CHARS}+ chars (usable)     ${String(usable.length).padStart(4)}  ${pct(usable.length)}`)
  console.log(`\n  median length            ${median} chars`)
  console.log(`  longest                  ${lengths[lengths.length - 1] ?? 0} chars`)

  // Where the content actually lives. These overlap with the buckets above on
  // purpose: what matters is the thin-description assignments, since those are
  // the ones that need a second source to be worth generating from.
  const canvasFile = rows.filter((r) => r.hasCanvasFile)
  const drive = rows.filter((r) => r.hasDrive)
  const linkOnly = rows.filter((r) => r.hasAnyLink && !r.hasCanvasFile && !r.hasDrive)
  console.log('\nContent location:')
  console.log(`  links a Canvas file      ${String(canvasFile.length).padStart(4)}  ${pct(canvasFile.length)}   (reachable with the user's token)`)
  console.log(`  links Google Drive       ${String(drive.length).padStart(4)}  ${pct(drive.length)}   (NOT reachable server-side)`)
  console.log(`  links something else     ${String(linkOnly.length).padStart(4)}  ${pct(linkOnly.length)}`)

  // The decisive number: of the assignments whose own text is too thin to use,
  // how many could be rescued by fetching a Canvas file vs. are locked in Drive
  // vs. have nothing anywhere.
  const needsSource = rows.filter((r) => r.text.length < USABLE_CHARS)
  const rescuable = needsSource.filter((r) => r.hasCanvasFile && !r.hasDrive)
  const lockedInDrive = needsSource.filter((r) => r.hasDrive && !r.hasCanvasFile)
  const nothing = needsSource.filter((r) => !r.hasCanvasFile && !r.hasDrive)
  console.log(`\nOf the ${needsSource.length} thin/empty assignments:`)
  console.log(`  rescuable via Canvas file    ${String(rescuable.length).padStart(4)}`)
  console.log(`  locked in Google Drive       ${String(lockedInDrive.length).padStart(4)}`)
  console.log(`  no source anywhere           ${String(nothing.length).padStart(4)}`)

  // Per-course, because one teacher who writes real instructions can carry the
  // average while every other class is blank.
  const byCourse = new Map<string, { total: number; usable: number }>()
  for (const r of rows) {
    const c = byCourse.get(r.course) ?? { total: 0, usable: 0 }
    c.total++
    if (r.text.length >= USABLE_CHARS) c.usable++
    byCourse.set(r.course, c)
  }
  console.log('\nBy course:')
  for (const [course, c] of [...byCourse.entries()].sort()) {
    console.log(
      `  ${course.padEnd(24).slice(0, 24)} ${String(c.usable).padStart(3)}/${String(c.total).padEnd(3)} usable`,
    )
  }

  console.log('\nSample of the longest 3 (what a guide would be built from):')
  for (const r of [...rows].sort((a, b) => b.text.length - a.text.length).slice(0, 3)) {
    console.log(`\n  ── ${r.name} (${r.course}, ${r.text.length} chars)`)
    console.log(`     ${r.text.slice(0, 280)}${r.text.length > 280 ? '…' : ''}`)
  }

  console.log('\nSample of 5 thin/empty ones (the failure case):')
  for (const r of [...empty, ...thin].slice(0, 5)) {
    console.log(`  ── ${r.name} (${r.course}) → ${r.text ? `"${r.text}"` : '[empty]'}`)
  }
  console.log('')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
