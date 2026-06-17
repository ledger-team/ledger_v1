import { ComingSoon } from '@/components/ComingSoon'

export default function StudyPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium text-foreground">Study</h1>
      <ComingSoon
        title="Coming soon"
        subtitle="AI study guides and grade predictor are coming soon."
      />
    </div>
  )
}
