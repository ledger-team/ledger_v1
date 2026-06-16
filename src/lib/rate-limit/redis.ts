// Upstash Redis REST client (singleton). Used only by the rate limiter today.
//
// Credentials are optional in development: when absent, the limiter fails open
// (see ./limiter). They are mandatory in production. This module never throws at
// import time — callers gate on `hasUpstashCreds()` first.

import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

export function hasUpstashCreds(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

export function getRedis(): Redis {
  if (!hasUpstashCreds()) {
    throw new Error('Upstash Redis credentials are not configured')
  }
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return _redis
}
