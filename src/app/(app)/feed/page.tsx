import { ComingSoon } from '@/components/ComingSoon'

export default function FeedPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium text-foreground">Feed</h1>
      <ComingSoon
        title="Coming soon"
        subtitle="Class feeds, Hype Feed, and Pulse are coming soon."
      />
    </div>
  )
}
