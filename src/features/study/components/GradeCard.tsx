import Link from 'next/link'
import { gradeTone, type CourseGrade } from '../grades'
import { Sparkline } from './Sparkline'

const TONE: Record<ReturnType<typeof gradeTone>, string> = {
  good: 'text-accent',
  neutral: 'text-foreground',
  warn: 'text-warn',
  bad: 'text-urgent',
  none: 'text-muted',
}

function DeltaBadge({ delta }: { delta: number }) {
  const down = delta < 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
        down ? 'bg-urgent/10 text-urgent' : 'bg-accent/10 text-accent'
      }`}
    >
      {down ? '▼' : '▲'} {Math.abs(delta).toFixed(1)}
    </span>
  )
}

export function GradeCard({ name, grade }: { name: string; grade: CourseGrade }) {
  const tone = TONE[gradeTone(grade.score)]

  return (
    <div className="flex items-center gap-4 rounded-xl border border-foreground/10 bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="mt-0.5 text-xs text-muted">
          {grade.delta !== null
            ? `${grade.delta > 0 ? 'Up' : grade.delta < 0 ? 'Down' : 'Steady'} over the last month`
            : grade.score === null
              ? 'No grade posted yet'
              : 'Tracking from here'}
        </p>
      </div>

      {grade.points.length > 1 && (
        <div className={tone}>
          <Sparkline points={grade.points} />
        </div>
      )}

      <div className="flex flex-col items-end gap-1">
        <span className={`text-xl font-semibold tabular-nums ${tone}`}>
          {grade.score !== null ? Math.round(grade.score) : '—'}
        </span>
        {grade.delta !== null && Math.abs(grade.delta) >= 0.5 && <DeltaBadge delta={grade.delta} />}
      </div>
    </div>
  )
}

export function GradeCardLink({ name, grade, href }: { name: string; grade: CourseGrade; href: string }) {
  return (
    <Link href={href} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <GradeCard name={name} grade={grade} />
    </Link>
  )
}
