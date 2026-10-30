import type { Genre, MovieDetail, MovieFilters, MoviePage, Rating, RatingSort, Session, User } from '../types/movie'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

/** Error carrying the user-facing message the backend sends in { error: { message } }. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message)
  }
}

/**
 * The auth context registers how to read the current token and what to do on
 * a 401. Keeping it here means every request is authenticated without each
 * caller having to pass the token around.
 */
let getToken: () => string | null = () => null
let onUnauthorized: () => void = () => {}

export function configureAuth(options: { getToken: () => string | null; onUnauthorized: () => void }) {
  getToken = options.getToken
  onUnauthorized = options.onUnauthorized
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError("Can't reach the server. Check that the app is running.", 0, 'network')
  }

  if (res.status === 204) return undefined as T

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const code = body?.error?.code ?? 'unknown'
    // An expired or invalid token: drop the session so the UI shows "Sign in" again.
    if (res.status === 401 && token && (code === 'token_expired' || code === 'invalid_token')) {
      onUnauthorized()
    }
    throw new ApiError(body?.error?.message ?? `Request failed (${res.status}).`, res.status, code)
  }
  return body as T
}

export const api = {
  searchMovies(filters: MovieFilters, page: number, signal?: AbortSignal) {
    const params = new URLSearchParams({ page: String(page) })
    if (filters.query) params.set('query', filters.query)
    if (filters.year) params.set('year', String(filters.year))
    if (filters.genre && !filters.query) params.set('genre', String(filters.genre))
    return request<MoviePage>(`/movies?${params}`, { signal })
  },
  movie: (id: number, signal?: AbortSignal) => request<MovieDetail>(`/movies/${id}`, { signal }),
  genres: () => request<Genre[]>('/genres'),

  ratings: (sort: RatingSort) => request<Rating[]>(`/ratings?sort=${sort}`),
  rate: (movieId: number, score: number) =>
    request<Rating>(`/ratings/${movieId}`, { method: 'PUT', body: JSON.stringify({ score }) }),
  removeRating: (movieId: number) => request<void>(`/ratings/${movieId}`, { method: 'DELETE' }),

  register: (email: string, password: string) =>
    request<Session>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<User>('/auth/me'),
}

const IMG = 'https://image.tmdb.org/t/p'
export const posterUrl = (path: string | null, size: 'w185' | 'w342' | 'w500' = 'w342') =>
  path ? `${IMG}/${size}${path}` : null
export const profileUrl = (path: string | null) => (path ? `${IMG}/w185${path}` : null)
export const backdropUrl = (path: string | null) => (path ? `${IMG}/w1280${path}` : null)
