// Verifies that every table carries the RLS policies its migration was supposed
// to create. Policies fail silently — a table with RLS on and zero policies
// returns no rows instead of erroring — so a missing policy looks exactly like
// "the user has no data" until a real student hits it.
//
//   pnpm tsx scripts/check-rls.ts
//
// Also prints which Supabase project it actually connected to. v1 lesson 15:
// verifying against the wrong project is its own failure mode.

import { prisma } from '../src/lib/db/prisma'

// table -> the commands that must have a policy
const EXPECTED: Record<string, string[]> = {
  GradeSnapshot: ['SELECT', 'INSERT'],
  AssignmentNote: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  CanvasToken: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  AuditLog: ['SELECT', 'INSERT'],
  StudyGuide: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  Enrollment: ['SELECT', 'INSERT', 'DELETE'],
}

type PolicyRow = { tablename: string; policyname: string; cmd: string }
type RlsRow = { relname: string; relrowsecurity: boolean }

async function main() {
  const host = (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '').match(
    /@([^/:]+)/,
  )?.[1]
  const ref = (process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '').match(
    /postgres\.([a-z0-9]+):/,
  )?.[1]
  console.log(`\nProject ref: ${ref ?? 'unknown'}   host: ${host ?? 'unknown'}`)
  console.log(ref === 'mdaewsjbsgezysmwzqac' ? '  (v2 — correct)' : '  ⚠ NOT the v2 project ref')

  const policies = await prisma.$queryRaw<PolicyRow[]>`
    SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public'
  `
  const rls = await prisma.$queryRaw<RlsRow[]>`
    SELECT relname, relrowsecurity FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
  `

  const rlsOff = rls.filter((r) => !r.relrowsecurity).map((r) => r.relname)
  console.log(`\nTables with RLS enabled: ${rls.length - rlsOff.length}/${rls.length}`)
  if (rlsOff.length) console.log(`  ⚠ RLS OFF: ${rlsOff.join(', ')}`)

  console.log(`\nTotal policies in public schema: ${policies.length}\n`)

  let failed = false
  for (const [table, commands] of Object.entries(EXPECTED)) {
    const mine = policies.filter((p) => p.tablename === table)
    const have = new Set(mine.map((p) => p.cmd.toUpperCase()))
    const missing = commands.filter((c) => !have.has(c))
    const ok = missing.length === 0
    if (!ok) failed = true
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'}  ${table.padEnd(16)} ${String(mine.length).padStart(2)} polic${mine.length === 1 ? 'y' : 'ies'}` +
        (missing.length ? `   missing: ${missing.join(', ')}` : ''),
    )
  }

  console.log(
    failed
      ? '\nA policy is missing. Do NOT edit the applied migration — add a new one.\n'
      : '\nAll expected policies present.\n',
  )
  process.exitCode = failed ? 1 : 0
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
