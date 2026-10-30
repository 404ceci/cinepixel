import { posterUrl } from '../api/client'

interface Props {
  id: number
  title: string
  posterPath: string | null
  releaseDate: string | null
  userScore: number | null
  onOpen: (id: number) => void
}

export function MovieCard({ id, title, posterPath, releaseDate, userScore, onOpen }: Props) {
  const src = posterUrl(posterPath)
  const year = releaseDate?.slice(0, 4)

  return (
    <li className="card">
      <button type="button" className="card__btn" onClick={() => onOpen(id)}>
        <div className="card__poster">
          {src ? (
            <img src={src} alt="" loading="lazy" />
          ) : (
            <div className="noposter" aria-hidden="true">
              <span>{title}</span>
            </div>
          )}
          {userScore !== null && (
            <span className="card__badge">
              <span aria-hidden="true">★</span> {userScore}
              <span className="sr-only"> out of 5, your score</span>
            </span>
          )}
        </div>
        <h3 className="card__title">{title}</h3>
        <p className="card__year">{year || 'Unreleased'}</p>
      </button>
    </li>
  )
}

export function CardSkeleton() {
  return (
    <li className="card card--skeleton" aria-hidden="true">
      <div className="card__poster shimmer" />
      <div className="line shimmer" />
      <div className="line line--short shimmer" />
    </li>
  )
}
