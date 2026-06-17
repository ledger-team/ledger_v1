// Typed Canvas REST API client. Handles Link-header pagination and maps Canvas
// HTTP failures to distinct error types so callers can react (401 = bad token
// vs. everything else). Base URL comes from School.canvasUrl — never hardcoded.

/** Canvas returned 401 — the token is missing/expired/invalid. */
export class CanvasAuthError extends Error {}
/** Canvas returned a non-2xx (and non-401) status. */
export class CanvasApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}
/** Network-level failure — Canvas couldn't be reached at all. */
export class CanvasUnavailableError extends Error {}

export type CanvasUser = { id: number; name: string | null }

export type CanvasCourseEnrollment = {
  type: string
  computed_current_score: number | null
  computed_current_grade: string | null
  computed_final_score: number | null
  computed_final_grade: string | null
}
export type CanvasCourse = {
  id: number
  name: string
  course_code: string
  enrollments?: CanvasCourseEnrollment[]
}
export type CanvasSection = { id: number; name: string }
export type CanvasSelfEnrollment = { course_id: number; course_section_id: number; type: string }
export type CanvasAssignment = {
  id: number
  name: string
  description: string | null
  due_at: string | null
  points_possible: number | null
  submission_types: string[] | null
}

export type CanvasClient = {
  getSelf(): Promise<CanvasUser>
  listCourses(): Promise<CanvasCourse[]>
  listSections(courseId: number): Promise<CanvasSection[]>
  listSelfEnrollments(): Promise<CanvasSelfEnrollment[]>
  listAssignments(courseId: number): Promise<CanvasAssignment[]>
}

export function createCanvasClient({
  baseUrl,
  token,
}: {
  baseUrl: string
  token: string
}): CanvasClient {
  const api = `${baseUrl.replace(/\/+$/, '')}/api/v1`

  async function fetchOrThrow(url: string): Promise<Response> {
    let res: Response
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
    } catch (err) {
      throw new CanvasUnavailableError(err instanceof Error ? err.message : 'network error')
    }
    if (res.status === 401) throw new CanvasAuthError('Canvas rejected the token (401)')
    if (!res.ok) throw new CanvasApiError(res.status, `Canvas API error ${res.status}`)
    return res
  }

  async function getOne<T>(path: string): Promise<T> {
    const res = await fetchOrThrow(`${api}${path}`)
    return (await res.json()) as T
  }

  // Follows the Link header's rel="next" until exhausted, concatenating pages.
  async function getAll<T>(path: string): Promise<T[]> {
    const out: T[] = []
    let url: string | null = `${api}${path}`
    while (url) {
      const res = await fetchOrThrow(url)
      out.push(...((await res.json()) as T[]))
      url = nextLink(res.headers.get('link'))
    }
    return out
  }

  return {
    getSelf: () => getOne<CanvasUser>('/users/self'),
    listCourses: () =>
      getAll<CanvasCourse>('/courses?enrollment_state=active&include[]=total_scores&per_page=100'),
    listSections: (courseId) => getAll<CanvasSection>(`/courses/${courseId}/sections?per_page=100`),
    listSelfEnrollments: () =>
      getAll<CanvasSelfEnrollment>('/users/self/enrollments?state[]=active&per_page=100'),
    listAssignments: (courseId) =>
      getAll<CanvasAssignment>(`/courses/${courseId}/assignments?per_page=100`),
  }
}

// Link: <https://…?page=2>; rel="next", <https://…?page=5>; rel="last"
export function nextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  for (const part of linkHeader.split(',')) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="next"/)
    if (m) return m[1]!
  }
  return null
}
