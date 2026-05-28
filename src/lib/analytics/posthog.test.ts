import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock posthog-node before importing the module under test.
const captureMock = vi.fn()
const flushMock = vi.fn().mockResolvedValue(undefined)
const shutdownMock = vi.fn().mockResolvedValue(undefined)

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: captureMock,
    flush: flushMock,
    shutdown: shutdownMock,
  })),
}))

describe('captureServer', () => {
  beforeEach(() => {
    captureMock.mockReset()
    flushMock.mockReset().mockResolvedValue(undefined)
    shutdownMock.mockReset().mockResolvedValue(undefined)
    // Ensure the env var exists so getClient() returns an instance.
    vi.stubEnv('POSTHOG_PROJECT_API_KEY', 'phc_test')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com')
    // Reset the module-level _client between tests.
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('captures event with the right shape and flushes', async () => {
    const { captureServer } = await import('./posthog.server')
    await captureServer({
      event: 'smoke.posthog.test',
      distinctId: 'user-xyz',
      properties: { foo: 'bar' },
    })
    expect(captureMock).toHaveBeenCalledWith({
      distinctId: 'user-xyz',
      event: 'smoke.posthog.test',
      properties: { foo: 'bar' },
    })
    expect(flushMock).toHaveBeenCalled()
  })

  it('no-ops cleanly when POSTHOG_PROJECT_API_KEY is missing', async () => {
    vi.stubEnv('POSTHOG_PROJECT_API_KEY', '')
    const { captureServer } = await import('./posthog.server')
    await expect(
      captureServer({ event: 'smoke.posthog.test', distinctId: 'x' }),
    ).resolves.toBeUndefined()
    expect(captureMock).not.toHaveBeenCalled()
  })
})
