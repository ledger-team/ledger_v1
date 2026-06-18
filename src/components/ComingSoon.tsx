import { SparkleIcon } from './icons'

export function ComingSoon({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-surface p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised p-3 text-accent">
        <SparkleIcon />
      </div>
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      <p className="max-w-xs text-sm text-muted">{subtitle}</p>
    </div>
  )
}
