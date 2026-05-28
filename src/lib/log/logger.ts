// Structured logger. Node-runtime only.
//
// IMPORTANT: do not import this from `src/middleware.ts` or any Edge-runtime
// code. Pino writes via sonic-boom (file-descriptor writes), which Edge
// doesn't provide. Middleware uses `console.warn` directly with the same
// JSON shape (see middleware.ts when it lands in Milestone E).
//
// Output: raw NDJSON to stdout in every environment. Vercel captures stdout
// in production; for pretty dev output, pipe through pino-pretty:
//   pnpm dev | npx pino-pretty
//
// Why no `transport: { target: '...' }` config?
//   Pino's transport config spawns a worker thread that loads modules via
//   require(). Next 15's webpack bundling doesn't emit the worker entry
//   points where Pino expects them, so the worker thread crashes with
//   "Cannot find module .../vendor-chunks/lib/worker.js" on first use.
//   The cleanest workaround in a Next runtime is to skip the transport
//   layer entirely and emit raw JSON.
//
// Better Stack integration (when configured): set up a Vercel log drain
// pointing at the Better Stack ingestion endpoint. No code change needed
// here — Vercel takes stdout and forwards it.
//
// Sensitive keys are auto-redacted to "[REDACTED]" before serialization.
// Add new sensitive keys to SENSITIVE_KEYS below as new fields appear.

import pino, { type DestinationStream, type LoggerOptions } from 'pino'

// Top-level keys to redact, plus one-level nested via the '*.x' form.
// Pino's redact does not support recursive wildcards, so we explicitly list
// both top-level and nested forms.
const SENSITIVE_KEYS = [
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'password',
  'authorization',
  'cookie',
  'canvasToken',
  'encryptedToken',
  'encryptionKey',
  'secret',
] as const

const REDACT_PATHS = [
  ...SENSITIVE_KEYS,
  ...SENSITIVE_KEYS.map((k) => `*.${k}`),
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
]

const isTest = process.env.NODE_ENV === 'test'
const isDev = process.env.NODE_ENV === 'development'

function loggerOptions(): LoggerOptions {
  return {
    level: process.env.LOG_LEVEL ?? (isTest ? 'debug' : isDev ? 'debug' : 'info'),
    base: { service: 'ledger', env: process.env.NODE_ENV ?? 'unknown' },
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  }
}

/**
 * Create a logger pointing at a custom destination. Used by tests to capture
 * structured output for assertions. Production code uses the default `logger`
 * export below.
 */
export function createLogger(destination?: DestinationStream) {
  if (destination) {
    return pino(loggerOptions(), destination)
  }
  return pino(loggerOptions())
}

export const logger = createLogger()

/**
 * Returns a logger with extra bindings (e.g. requestId, userId). Useful for
 * threading context through a server action without having to pass it
 * everywhere.
 */
export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings)
}
