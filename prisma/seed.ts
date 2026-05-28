/**
 * Database seed.
 *
 * Runs in every environment via `pnpm db:seed`. Behavior splits by NODE_ENV:
 *   - production    → only ensure real School rows exist (Dripping Springs HS).
 *   - everything else → real schools + test school + test users + AP courses.
 *
 * Idempotent: every write is an upsert. Re-runnable as many times as you like.
 *
 * Uses the service-role PrismaClient (bypasses RLS) — seeding requires writes
 * across many tables before any user identity exists.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DSHS_CANVAS_URL = 'https://dsisd.instructure.com'
const TEST_CANVAS_URL = 'https://test.instructure.com'

async function ensureProductionSchools() {
  await prisma.school.upsert({
    where: { canvasUrl: DSHS_CANVAS_URL },
    update: { name: 'Dripping Springs High School', isActive: true },
    create: {
      name: 'Dripping Springs High School',
      canvasUrl: DSHS_CANVAS_URL,
      isActive: true,
    },
  })
}

async function ensureTestData() {
  if (process.env.NODE_ENV === 'production') {
    console.log('NODE_ENV=production — skipping test data.')
    return
  }

  console.log('Seeding test data...')

  const testSchool = await prisma.school.upsert({
    where: { canvasUrl: TEST_CANVAS_URL },
    update: { name: 'Dripping Springs Test', isActive: true },
    create: {
      name: 'Dripping Springs Test',
      canvasUrl: TEST_CANVAS_URL,
      isActive: true,
    },
  })

  const founder = await prisma.user.upsert({
    where: { email: 'test-founder@ledger.test' },
    update: { schoolId: testSchool.id },
    create: {
      email: 'test-founder@ledger.test',
      name: 'Test Founder',
      schoolId: testSchool.id,
      gradYear: 2027,
    },
  })

  const classmate = await prisma.user.upsert({
    where: { email: 'test-classmate@ledger.test' },
    update: { schoolId: testSchool.id },
    create: {
      email: 'test-classmate@ledger.test',
      name: 'Test Classmate',
      schoolId: testSchool.id,
      gradYear: 2027,
    },
  })

  const courses = [
    { code: 'test_apworld', name: 'AP World History', courseCode: 'APWORLD' },
    { code: 'test_apphys', name: 'AP Physics 1', courseCode: 'APPHYS1' },
    { code: 'test_aplang', name: 'AP English Language', courseCode: 'APLANG' },
    { code: 'test_precalc', name: 'Pre-Calculus', courseCode: 'PRECALC' },
  ]

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  for (const c of courses) {
    const course = await prisma.course.upsert({
      where: { schoolId_canvasCourseId: { schoolId: testSchool.id, canvasCourseId: c.code } },
      update: { name: c.name, courseCode: c.courseCode },
      create: {
        schoolId: testSchool.id,
        canvasCourseId: c.code,
        name: c.name,
        courseCode: c.courseCode,
        currentGrade: 'A-',
        currentScore: 91.5,
      },
    })

    const section = await prisma.section.upsert({
      where: {
        courseId_canvasSectionId: {
          courseId: course.id,
          canvasSectionId: `${c.code}_section_1`,
        },
      },
      update: { name: `${c.courseCode} - Section 1` },
      create: {
        courseId: course.id,
        canvasSectionId: `${c.code}_section_1`,
        name: `${c.courseCode} - Section 1`,
      },
    })

    for (const u of [founder, classmate]) {
      await prisma.enrollment.upsert({
        where: { userId_sectionId: { userId: u.id, sectionId: section.id } },
        update: {},
        create: { userId: u.id, sectionId: section.id },
      })
    }

    const assignments = [
      { suffix: 'rq1', name: `${c.courseCode} - Reading Quiz 1`, dueDays: 2, points: 10 },
      { suffix: 'essay', name: `${c.courseCode} - Essay Draft`, dueDays: 5, points: 50 },
      { suffix: 'ps3', name: `${c.courseCode} - Problem Set 3`, dueDays: 9, points: 25 },
      { suffix: 'review', name: `${c.courseCode} - Midterm Review`, dueDays: 14, points: 0 },
      { suffix: 'midterm', name: `${c.courseCode} - Midterm Exam`, dueDays: 21, points: 100 },
    ]

    for (const a of assignments) {
      await prisma.assignment.upsert({
        where: {
          courseId_canvasId: { courseId: course.id, canvasId: `${c.code}_${a.suffix}` },
        },
        update: {
          name: a.name,
          dueAt: new Date(now + a.dueDays * day),
          pointsPossible: a.points,
        },
        create: {
          courseId: course.id,
          canvasId: `${c.code}_${a.suffix}`,
          name: a.name,
          dueAt: new Date(now + a.dueDays * day),
          pointsPossible: a.points,
          submissionType: 'online_text_entry',
          isTestData: true,
        },
      })
    }
  }

  console.log('Test data seeded.')
}

async function main() {
  await ensureProductionSchools()
  await ensureTestData()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
