import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { backdropUrl, posterUrl, profileUrl } from '../api/client'
import { useAuth } from '../auth'
import { useMovie, useRateMovie, useRemoveRating } from '../hooks/useMovies'
import type { MovieDetail } from '../types/movie'
import { StarRating } from './StarRating'
import { ErrorState } from './States'

interface Props {
  movieId: number
  onClose: () => void
}

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

const formatRuntime = (min: number | null) =>
  min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m` : null

export function MovieModal({ movieId, onClose }: Props) {
  const { data, isPending, isError, error, refetch } = useMovie(movieId)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Esc closes, focus starts on the close button, page scroll is locked
  // and Tab cycles inside the dialog only.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus()
    }
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-busy={isPending}
      >
        <button ref={closeRef} type="button" className="modal__close" onClick={onClose}>
          <span aria-hidden="true">✕</span>
          <span className="sr-only">Close</span>
        </button>

        {isPending && <ModalSkeleton />}
        {isError && (
          <div className="modal__pad modal__pad--top">
            <h2 id="modal-title" className="sr-only">
              Couldn't load this movie
            </h2>
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        )}
        {data && <ModalContent movie={data} />}
      </div>
    </div>
  )
}

function ModalContent({ movie }: { movie: MovieDetail }) {
  const backdrop = backdropUrl(movie.backdrop_path)
  const poster = posterUrl(movie.poster_path, 'w500')
  const runtime = formatRuntime(movie.runtime)

  return (
    <>
      <div
        className="modal__hero"
        style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined}
        aria-hidden="true"
      />
      <div className="modal__pad modal__grid">
        <div className="modal__poster">
          {poster ? (
            <img src={poster} alt={`Poster for ${movie.title}`} />
          ) : (
            <div className="noposter">
              <span>{movie.title}</span>
            </div>
          )}
        </div>

        <div className="modal__info">
          <h2 id="modal-title" className="modal__title">
            {movie.title}
          </h2>
          {movie.original_title && movie.original_title !== movie.title && (
            <p className="modal__original">{movie.original_title}</p>
          )}
          <dl className="facts">
            <div className="facts__item">
              <dt>Released</dt>
              <dd>{movie.release_date ? formatDate(movie.release_date) : 'Not announced'}</dd>
            </div>
            {runtime && (
              <div className="facts__item">
                <dt>Runtime</dt>
                <dd>{runtime}</dd>
              </div>
            )}
            {movie.directors.length > 0 && (
              <div className="facts__item">
                <dt>Director</dt>
                <dd>{movie.directors.join(', ')}</dd>
              </div>
            )}
          </dl>
          {movie.genres.length > 0 && (
            <ul className="chips" aria-label="Genres">
              {movie.genres.map((g) => (
                <li key={g} className="chip">
                  {g}
                </li>
              ))}
            </ul>
          )}

          <RatingBox movie={movie} />

          <section className="modal__section">
            <h3 className="section-label">Synopsis</h3>
            {movie.tagline && <p className="modal__tagline">{movie.tagline}</p>}
            <p className="modal__overview">{movie.overview || 'TMDB has no synopsis for this movie yet.'}</p>
          </section>
        </div>
      </div>

      <section className="modal__pad modal__section">
        <h3 className="section-label">Cast</h3>
        {movie.cast.length === 0 ? (
          <p className="modal__muted">TMDB has no cast listed for this movie.</p>
        ) : (
          <ul className="cast">
            {movie.cast.map((c) => {
              const photo = profileUrl(c.profile_path)
              return (
                <li key={`${c.id}-${c.character}`} className="cast__item">
                  <div className="cast__photo">
                    {photo ? (
                      <img src={photo} alt="" loading="lazy" />
                    ) : (
                      <span aria-hidden="true">{c.name.charAt(0)}</span>
                    )}
                  </div>
                  <p className="cast__name">{c.name}</p>
                  {c.character && <p className="cast__role">{c.character}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

function RatingBox({ movie }: { movie: MovieDetail }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return (
      <div className="rating-box rating-box--locked">
        <h3 className="section-label">Your rating</h3>
        <StarRating value={null} size="lg" />
        <p className="modal__muted">
          <Link to={`/login?next=${next}`} className="link-strong">
            Sign in
          </Link>{' '}
          to rate this movie and keep it in your list.
        </p>
      </div>
    )
  }

  return <RatingControls movie={movie} />
}

function RatingControls({ movie }: { movie: MovieDetail }) {
  const rate = useRateMovie(movie.id)
  const remove = useRemoveRating(movie.id)
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState(false)
  const current = movie.user_rating?.score ?? null
  const busy = rate.isPending || remove.isPending
  const error = rate.error ?? remove.error

  useEffect(() => {
    if (!saved) return
    const id = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(id)
  }, [saved])

  const handleRate = (score: number) => {
    if (score === current) return
    setConfirming(false)
    rate.mutate(score, { onSuccess: () => setSaved(true) })
  }

  return (
    <div className={`rating-box${current ? ' rating-box--rated' : ''}`}>
      <div className="rating-box__head">
        <h3 className="section-label">{current ? 'Your rating' : 'Rate this movie'}</h3>
        <span className="rating-box__status" aria-live="polite">
          {busy ? 'Saving…' : saved ? 'Saved' : ''}
        </span>
      </div>

      <StarRating value={current} onChange={handleRate} disabled={busy} size="lg" />

      {current && (
        <div className="rating-box__actions">
          <span className="modal__muted">Pick another star to change it.</span>
          {confirming ? (
            <span className="confirm">
              Remove your rating?
              <button type="button" className="btn btn--danger btn--sm" onClick={() => remove.mutate()} disabled={busy}>
                Remove
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(true)}>
              Remove rating
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="rating-box__error" role="alert">
          {error.message}
        </p>
      )}
    </div>
  )
}

function ModalSkeleton() {
  return (
    <div aria-label="Loading movie">
      <h2 id="modal-title" className="sr-only">
        Loading…
      </h2>
      <div className="modal__hero shimmer" />
      <div className="modal__pad modal__grid">
        <div className="modal__poster shimmer" style={{ aspectRatio: '2 / 3' }} />
        <div className="modal__info">
          <div className="line line--title shimmer" />
          <div className="line line--short shimmer" />
          <div className="line shimmer" />
          <div className="line shimmer" />
          <div className="line line--short shimmer" />
        </div>
      </div>
    </div>
  )
}
