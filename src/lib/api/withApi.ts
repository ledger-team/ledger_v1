// The default contract for every API route handler.
//
//   export const POST = withApi({ schema, rateLimit, public? }, handler)
//
// One wrapper bundles the three things every route needs, so that writing a
// *protected* route is the path of least resistance and skipping protection is
// an explicit, visible choice (`public: true`). Pipeline, in order:
//
//   1. Resolve session (used both for auth and as the rate-limit identity).
//   2. Rate limit — by user id when authed, else client IP. 429 on limit.
//      Runs before the auth check so unauthenticated hammering of a protected
//      route is itself throttled. Pass `rateLimit: false` to opt out.
//   3. Auth — 401 unless `public: true` or a session exists.
//   4. Validate — if `schema` is given, parse the JSON body; 400 on failure.
//
// The handler receives `{ req, session, data }`, where `data` is the parsed,
// typed body (or `undefined` when no schema is supplied).

import { NextResponse, type NextRequest } from 'next/server'
import { z, type ZodType } from 'zod'
import { getServerSession, type AppSession } from '@/lib/auth/session'
import { limit, type RateLimitConfig, type RateLimitPreset } from '@/lib/rate-limit/limiter'
import { logger } from '@/lib/log/logger'
import { EVENTS } from '@/lib/analytics/events'

export type RateLimitOption = RateLimitPreset | RateLimitConfig | false

export interface WithApiOptions<S extends ZodType = ZodType> {
  schema?: S
  /** Preset name, explicit config, or `false` to disable. Defaults to `'api'`. */
  rateLimit?: RateLimitOption
  /** When true, the route is reachable without a session. Defaults to false. */
  public?: boolean
}

export interface ApiContext<S extends ZodType = ZodType> {
  req: NextRequest
  session: AppSession | null
  data: S extends ZodType ? z.infer<S> : undefined
}

type ApiHandler<S extends ZodType> = (ctx: ApiContext<S>) => Response | Promise<Response>

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return req.headers.get('x-real-ip') ?? '127.0.0.1'
}

export function withApi<S extends ZodType = ZodType>(
  opts: WithApiOptions<S>,
  handler: ApiHandler<S>,
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest): Promise<Response> => {
    const path = req.nextUrl.pathname
    const session = await getServerSession()

    // 1. Rate limit (identity = user id when known, else IP).
    if (opts.rateLimit !== false) {
      const identity = session?.user.id ?? `ip:${clientIp(req)}`
      const result = await limit(`${path}:${identity}`, opts.rateLimit ?? 'api')
      if (!result.success) {
        const retryAfter = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000))
        logger.warn({ event: EVENTS.api.request_rate_limited, path }, 'request rate limited')
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        )
      }
    }

    // 2. Auth.
    if (!opts.public && !session) {
      logger.warn({ event: EVENTS.api.request_denied, path }, 'unauthenticated request denied')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Validation.
    let data: unknown
    if (opts.schema) {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        body = undefined
      }
      const parsed = opts.schema.safeParse(body)
      if (!parsed.success) {
        logger.warn({ event: EVENTS.api.request_invalid, path }, 'request failed validation')
        return NextResponse.json(
          { error: 'Invalid request', issues: parsed.error.issues },
          { status: 400 },
        )
      }
      data = parsed.data
    }

    return handler({ req, session, data } as ApiContext<S>)
  }
}
