import { Writable } from 'node:stream'
import { beforeEach, describe, expect, it } from 'vitest'
import { createLogger } from './logger'

// Captures every line a Pino logger writes. Each entry is the raw NDJSON line.
function captureSink() {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString())
      callback()
    },
  })
  return { lines, stream }
}

describe('logger', () => {
  let sink: ReturnType<typeof captureSink>
  let logger: ReturnType<typeof createLogger>

  beforeEach(() => {
    sink = captureSink()
    logger = createLogger(sink.stream)
  })

  function lastLine(): Record<string, unknown> {
    const raw = sink.lines[sink.lines.length - 1]
    if (!raw) throw new Error('no log lines captured')
    return JSON.parse(raw.trim())
  }

  it('emits structured JSON with service, env, level, time', () => {
    logger.info({ event: 'logger.test.basic' }, 'basic')
    const line = lastLine()
    expect(line).toMatchObject({
      service: 'ledger',
      env: expect.any(String),
      event: 'logger.test.basic',
      msg: 'basic',
    })
    expect(line.level).toBeTypeOf('number')
    expect(line.time).toBeTypeOf('number')
  })

  it('redacts top-level sensitive keys', () => {
    logger.info(
      {
        event: 'logger.test.redaction',
        token: 'super-secret-token',
        password: 'hunter2',
        canvasToken: 'cv-abc-123',
        encryptionKey: 'aes-256-key',
        userId: 'user-xyz',
      },
      'redaction',
    )
    const raw = sink.lines.join('\n')
    expect(raw).not.toContain('super-secret-token')
    expect(raw).not.toContain('hunter2')
    expect(raw).not.toContain('cv-abc-123')
    expect(raw).not.toContain('aes-256-key')
    expect(raw).toContain('[REDACTED]')
    expect(raw).toContain('user-xyz')
  })

  it('redacts one-level-nested sensitive keys', () => {
    logger.info(
      {
        event: 'logger.test.nested-redaction',
        canvasResult: { token: 'nested-canvas-token', userId: 'u-1' },
      },
      'nested',
    )
    const raw = sink.lines.join('\n')
    expect(raw).not.toContain('nested-canvas-token')
    expect(raw).toContain('[REDACTED]')
    expect(raw).toContain('u-1')
  })

  it('respects log levels — debug is dropped at info level', () => {
    const startLen = sink.lines.length
    const quiet = logger.child({}, { level: 'info' })
    quiet.debug({ event: 'logger.test.debug' }, 'should be dropped')
    expect(sink.lines.length).toBe(startLen)
  })

  it('child loggers carry bindings to every line', () => {
    const child = logger.child({ requestId: 'req-abc', actorUserId: 'user-1' })
    child.info({ event: 'logger.test.child' }, 'with bindings')
    const line = lastLine()
    expect(line.requestId).toBe('req-abc')
    expect(line.actorUserId).toBe('user-1')
    expect(line.event).toBe('logger.test.child')
  })
})
