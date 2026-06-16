// Sliding-window rate limiting backed by Upstash Redis.
//
// Presets (Phase 0 plan §D.3):
//   auth     10 / 60s   — login / magic-link request endpoints (keyed by IP)
//   mutation 20 / 60s   — writes / state-changing routes (keyed by user)
//   api      60 / 60s   — general authed routes (default; keyed by user, IP if anon)
//   read    120 / 60s   — read-heavy routes
//
// Smoke routes are NOT rate-limited via a preset here — they are dev-only and
// 404 in production.
//
// Missing-credentials behavior (Decision D2):
//   - development: fail OPEN (allow, warn once). Lets local dev run without Upstash.
//   - production:  fail CLOSED — `limit()` throws, surfacing as a 500, so a
//                  misconfigured prod deploy cannot silently run unprotected.

import { Ratelimit } from '@upstash/ratelimit'
import { getRedis, hasUpstashCreds } from './redis'
import { logger } from '@/lib/log/logger'

export type RateLimitConfig = { limit: number; windowSeconds: number }

export const RATE_LIMITS = {
  auth: { limit: 10, windowSeconds: 60 },
  mutation: { limit: 20, windowSeconds: 60 },
  api: { limit: 60, windowSeconds: 60 },
  read: { limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitConfig>

export type RateLimitPreset = keyof typeof RATE_LIMITS

export type RateLimitResult = {
  success: boolean
  limit: number
  remaining: number
  /** Epoch milliseconds at which the current window resets. */
  reset: number
}

const limiters = new Map<string, Ratelimit>()
let warnedNoCreds = false

function resolveConfig(preset: RateLimitPreset | RateLimitConfig): RateLimitConfig {
  return typeof preset === 'string' ? RATE_LIMITS[preset] : preset
}

function getLimiter(config: RateLimitConfig): Ratelimit | null {
  if (!hasUpstashCreds()) return null
  const cacheKey = `${config.limit}:${config.windowSeconds}`
  let rl = limiters.get(cacheKey)
  if (!rl) {
    rl = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
      prefix: 'ledger:rl',
    })
    limiters.set(cacheKey, rl)
  }
  return rl
}

/**
 * Consume one unit against `key` under the given preset/config. `key` should
 * already include enough context to be unique per caller (e.g. route + user id).
 */
export async function limit(
  key: string,
  preset: RateLimitPreset | RateLimitConfig = 'api',
): Promise<RateLimitResult> {
  const config = resolveConfig(preset)
  const rl = getLimiter(config)

  if (!rl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Rate limiting is required in production but Upstash credentials are missing')
    }
    if (!warnedNoCreds) {
      warnedNoCreds = true
      logger.warn(
        { event: 'ratelimit.disabled' },
        'Upstash credentials missing — rate limiting disabled (dev fail-open)',
      )
    }
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit,
      reset: Date.now() + config.windowSeconds * 1000,
    }
  }

  const res = await rl.limit(key)
  return { success: res.success, limit: res.limit, remaining: res.remaining, reset: res.reset }
}
