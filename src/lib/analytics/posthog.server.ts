// Server-side PostHog client. Use captureServer() from server actions and
// API routes when you need to emit an analytics event from Node.
//
// In serverless contexts (Vercel functions) the process can exit immediately
// after a response is sent, so flushAt: 1 makes every event flush
// synchronously. For long-lived processes (local dev), the default batching
// behavior is fine — but we set flushAt: 1 for consistency.

import { PostHog } from 'posthog-node'
import type { EventName } from './events'

let _client: PostHog | null = null

function getClient(): PostHog | null {
  if (!process.env.POSTHOG_PROJECT_API_KEY) return null
  if (_client) return _client
  _client = new PostHog(process.env.POSTHOG_PROJECT_API_KEY, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  })
  return _client
}

export type ServerEvent = {
  event: EventName
  distinctId: string
  properties?: Record<string, unknown>
}

export async function captureServer({ event, distinctId, properties }: ServerEvent): Promise<void> {
  const client = getClient()
  if (!client) return // no-op if PostHog isn't configured

  client.capture({ distinctId, event, properties })
  // Force-flush so serverless functions don't drop the event.
  await client.flush()
}

// Call this from long-lived processes (scripts) before exit to flush in-flight
// events. Not needed in serverless because flushAt:1 + flush() handle it.
export async function shutdown(): Promise<void> {
  if (_client) {
    await _client.shutdown()
    _client = null
  }
}
