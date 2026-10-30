import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../auth'
import type { MovieDetail, MovieFilters, MoviePage, RatingSort } from '../types/movie'

/**
 * React Query cache keys, kept in one place so mutations know exactly what to
 * update. Lists and details include the user's own scores, so the user id is
 * part of the key (the cache is also cleared on sign-in and sign-out).
 */
export const keys = {
  movies: (uid: number | null, f: MovieFilters) => ['movies', uid, f] as const,
  movie: (uid: number | null, id: number) => ['movie', uid, id] as const,
  ratings: (uid: number | null, sort: RatingSort) => ['ratings', uid, sort] as const,
  genres: ['genres'] as const,
}

export function useMovieSearch(filters: MovieFilters) {
  const uid = useAuth().user?.id ?? null
  return useInfiniteQuery({
    queryKey: keys.movies(uid, filters),
    queryFn: ({ pageParam, signal }) => api.searchMovies(filters, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.total_pages ? last.page + 1 : undefined),
    staleTime: 5 * 60_000,
  })
}

export function useMovie(id: number | null) {
  const uid = useAuth().user?.id ?? null
  return useQuery({
    queryKey: keys.movie(uid, id ?? 0),
    queryFn: ({ signal }) => api.movie(id!, signal),
    enabled: id !== null,
    staleTime: 10 * 60_000,
  })
}

export function useGenres() {
  return useQuery({ queryKey: keys.genres, queryFn: api.genres, staleTime: Infinity })
}

export function useRatings(sort: RatingSort) {
  const uid = useAuth().user?.id ?? null
  return useQuery({
    queryKey: keys.ratings(uid, sort),
    queryFn: () => api.ratings(sort),
    enabled: uid !== null,
  })
}

/**
 * After rating or removing, the same movie lives in three places in the cache:
 * its detail, any search lists, and the ratings list. The first two are
 * patched in place (no refetch); the third is invalidated.
 */
function useSyncRating() {
  const qc = useQueryClient()
  return (movieId: number, score: number | null, rating: MovieDetail['user_rating']) => {
    qc.setQueriesData<MovieDetail>({ queryKey: ['movie'] }, (old) =>
      old && old.id === movieId ? { ...old, user_rating: rating } : old,
    )
    qc.setQueriesData<InfiniteData<MoviePage>>({ queryKey: ['movies'] }, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              results: p.results.map((m) => (m.id === movieId ? { ...m, user_score: score } : m)),
            })),
          }
        : old,
    )
    qc.invalidateQueries({ queryKey: ['ratings'] })
  }
}

export function useRateMovie(movieId: number) {
  const sync = useSyncRating()
  return useMutation({
    mutationFn: (score: number) => api.rate(movieId, score),
    onSuccess: (rating) => sync(movieId, rating.score, rating),
  })
}

export function useRemoveRating(movieId: number) {
  const sync = useSyncRating()
  return useMutation({
    mutationFn: () => api.removeRating(movieId),
    onSuccess: () => sync(movieId, null, null),
  })
}
