import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CardSkeleton, MovieCard } from '../components/MovieCard'
import { InfiniteSentinel } from '../components/InfiniteSentinel'
import { EmptyState, ErrorState } from '../components/States'
import { useDebounce } from '../hooks/useDebounce'
import { useMovieModal } from '../hooks/useMovieModal'
import { useGenres, useMovieSearch } from '../hooks/useMovies'
import type { MovieFilters } from '../types/movie'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1919 }, (_, i) => CURRENT_YEAR + 1 - i)

const toInt = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null)

export function HomePage() {
  const [params, setParams] = useSearchParams()
  const { open } = useMovieModal()
  const genres = useGenres()

  // What's being typed lives in local state; the URL only gets the settled value.
  const [text, setText] = useState(params.get('q') ?? '')
  const debounced = useDebounce(text.trim(), 400)

  useEffect(() => {
    setParams(
      (p) => {
        if (debounced) p.set('q', debounced)
        else p.delete('q')
        return p
      },
      { replace: true },
    )
  }, [debounced, setParams])

  const filters: MovieFilters = useMemo(
    () => ({
      query: params.get('q') ?? '',
      genre: toInt(params.get('genre')),
      year: toInt(params.get('year')),
    }),
    [params],
  )

  const setFilter = (key: 'genre' | 'year', value: string) =>
    setParams(
      (p) => {
        if (value) p.set(key, value)
        else p.delete(key)
        return p
      },
      { replace: true },
    )

  const search = useMovieSearch(filters)
  const movies = search.data?.pages.flatMap((p) => p.results) ?? []
  const total = search.data?.pages[0]?.total_results ?? 0
  const isSearch = Boolean(filters.query)
  const typing = text.trim() !== debounced
  const genreName = genres.data?.find((g) => g.id === filters.genre)?.name

  const heading = isSearch
    ? `Results for “${filters.query}”`
    : [genreName ?? 'Popular', filters.year ? `from ${filters.year}` : 'right now'].join(' ')

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Powered by TMDB</p>
        <h1 className="hero__title">
          Find a movie.
          <br />
          <em>Rate it.</em>
        </h1>

        <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="search" className="sr-only">
            Search movies by title
          </label>
          <svg className="search__icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            id="search"
            type="search"
            placeholder="Search by title — try “Dune”"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {(typing || (search.isFetching && !search.isFetchingNextPage)) && (
            <span className="spinner" aria-label="Searching" />
          )}
        </form>

        <div className="filters">
          <label className="field">
            <span>Genre</span>
            <select
              value={filters.genre ?? ''}
              onChange={(e) => setFilter('genre', e.target.value)}
              disabled={isSearch || genres.isPending}
              aria-describedby={isSearch ? 'genre-hint' : undefined}
            >
              <option value="">All genres</option>
              {genres.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Year</span>
            <select value={filters.year ?? ''} onChange={(e) => setFilter('year', e.target.value)}>
              <option value="">Any year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          {isSearch && (
            <p id="genre-hint" className="filters__hint">
              Clear the search to filter by genre. TMDB's title search doesn't support genres.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="list-title">
        <div className="section-head">
          <h2 id="list-title" className="section-title">
            {heading}
          </h2>
          {search.isSuccess && total > 0 && (
            <span className="counter">
              {total.toLocaleString('en-US')} {total === 1 ? 'movie' : 'movies'}
            </span>
          )}
        </div>

        {search.isPending ? (
          <ul className="grid" aria-busy="true">
            {Array.from({ length: 12 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </ul>
        ) : search.isError && movies.length === 0 ? (
          <ErrorState error={search.error} onRetry={() => search.refetch()} />
        ) : movies.length === 0 ? (
          <EmptyState title="No movies match that">
            Check the spelling, or remove the year filter.
          </EmptyState>
        ) : (
          <>
            <ul className="grid">
              {movies.map((m) => (
                <MovieCard
                  key={m.id}
                  id={m.id}
                  title={m.title}
                  posterPath={m.poster_path}
                  releaseDate={m.release_date}
                  userScore={m.user_score}
                  onOpen={open}
                />
              ))}
              {search.isFetchingNextPage && Array.from({ length: 6 }, (_, i) => <CardSkeleton key={`s${i}`} />)}
            </ul>
            {search.isFetchNextPageError ? (
              <ErrorState error={search.error} onRetry={() => search.fetchNextPage()} />
            ) : (
              <InfiniteSentinel
                hasMore={Boolean(search.hasNextPage)}
                loading={search.isFetchingNextPage}
                onLoadMore={search.fetchNextPage}
              />
            )}
          </>
        )}
      </section>
    </>
  )
}
