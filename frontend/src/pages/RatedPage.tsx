import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { CardSkeleton, MovieCard } from '../components/MovieCard'
import { EmptyState, ErrorState } from '../components/States'
import { useMovieModal } from '../hooks/useMovieModal'
import { useRatings } from '../hooks/useMovies'
import type { RatingSort } from '../types/movie'

const SORT_OPTIONS: { value: RatingSort; label: string }[] = [
  { value: 'recent', label: 'Recently rated' },
  { value: 'score', label: 'Highest score' },
  { value: 'title', label: 'Title (A–Z)' },
]

export function RatedPage() {
  const { user, checking } = useAuth()

  return (
    <>
      <section className="hero hero--compact">
        <p className="eyebrow">Your collection</p>
        <h1 className="hero__title">
          My <em>ratings</em>
        </h1>
      </section>
      {user ? (
        <RatedList />
      ) : checking ? null : (
        <EmptyState title="Sign in to see your ratings">
          <p>Your scores are saved to your account, so they follow you to any device.</p>
          <div className="state__actions">
            <Link to="/login?next=%2Frated" className="btn btn--primary">
              Sign in
            </Link>
            <Link to="/login?mode=register&next=%2Frated" className="btn btn--ghost">
              Create an account
            </Link>
          </div>
        </EmptyState>
      )}
    </>
  )
}

function RatedList() {
  const [params, setParams] = useSearchParams()
  const { open } = useMovieModal()
  const sortParam = params.get('sort')
  const sort: RatingSort = SORT_OPTIONS.find((o) => o.value === sortParam)?.value ?? 'recent'
  const ratings = useRatings(sort)

  const list = ratings.data ?? []
  const average = list.length ? list.reduce((s, r) => s + r.score, 0) / list.length : 0

  return (
    <section aria-labelledby="rated-title">
      <div className="section-head">
        <h2 id="rated-title" className="section-title">
          {list.length > 0 ? (
            <>
              {list.length} {list.length === 1 ? 'movie' : 'movies'}
              <span className="section-title__sub">
                avg <b>{average.toLocaleString('en-US', { maximumFractionDigits: 1 })}</b> / 5
              </span>
            </>
          ) : (
            'Rated movies'
          )}
        </h2>
        <label className="field field--inline">
          <span>Sort by</span>
          <select
            value={sort}
            onChange={(e) =>
              setParams(
                (p) => {
                  p.set('sort', e.target.value)
                  return p
                },
                { replace: true },
              )
            }
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ratings.isPending ? (
        <ul className="grid" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </ul>
      ) : ratings.isError ? (
        <ErrorState error={ratings.error} onRetry={() => ratings.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="Nothing rated yet">
          <p>Open any movie and pick a score from 1 to 5. It shows up here.</p>
          <div className="state__actions">
            <Link to="/" className="btn btn--primary">
              Find a movie
            </Link>
          </div>
        </EmptyState>
      ) : (
        <ul className="grid">
          {list.map((r) => (
            <MovieCard
              key={r.movie_id}
              id={r.movie_id}
              title={r.title}
              posterPath={r.poster_path}
              releaseDate={r.release_date}
              userScore={r.score}
              onOpen={open}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
