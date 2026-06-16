import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CanvasApiError,
  CanvasAuthError,
  CanvasUnavailableError,
  createCanvasClient,
  nextLink,
} from './canvas'

const client = createCanvasClient({ baseUrl: 'https://dsisd.instructure.com', token: 't0ken' })

function json(body: unknown, init: { status?: number; link?: string } = {}): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (init.link) headers.link = init.link
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers })
}

afterEach(() => vi.unstubAllGlobals())

describe('nextLink', () => {
  it('extracts the rel="next" URL', () => {
    const h = '<https://x/api/v1/courses?page=2>; rel="next", <https://x/api/v1/courses?page=9>; rel="last"'
    expect(nextLink(h)).toBe('https://x/api/v1/courses?page=2')
  })
  it('returns null when there is no next', () => {
    expect(nextLink('<https://x?page=9>; rel="last"')).toBeNull()
    expect(nextLink(null)).toBeNull()
  })
})

describe('createCanvasClient', () => {
  it('sends a Bearer token and hits /api/v1', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: 5, name: 'Sam' }))
    vi.stubGlobal('fetch', fetchMock)
    await client.getSelf()
    expect(fetchMock.mock.calls[0]![0]).toBe('https://dsisd.instructure.com/api/v1/users/self')
    expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer t0ken',
    })
  })

  it('follows Link rel="next" across pages', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json([{ id: 1, name: 'A' }, { id: 2, name: 'B' }], {
          link: '<https://dsisd.instructure.com/api/v1/courses/9/sections?page=2>; rel="next"',
        }),
      )
      .mockResolvedValueOnce(json([{ id: 3, name: 'C' }]))
    vi.stubGlobal('fetch', fetchMock)

    const sections = await client.listSections(9)
    expect(sections.map((s) => s.id)).toEqual([1, 2, 3])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]![0]).toContain('page=2')
  })

  it('throws CanvasAuthError on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })))
    await expect(client.getSelf()).rejects.toBeInstanceOf(CanvasAuthError)
  })

  it('throws CanvasApiError on other non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
    await expect(client.listCourses()).rejects.toBeInstanceOf(CanvasApiError)
  })

  it('throws CanvasUnavailableError on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    await expect(client.getSelf()).rejects.toBeInstanceOf(CanvasUnavailableError)
  })
})
