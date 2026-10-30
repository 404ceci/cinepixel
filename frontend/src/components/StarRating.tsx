import { useState } from 'react'

const LABELS = ['Awful', 'Bad', 'Okay', 'Good', 'Excellent']

interface Props {
  value: number | null
  onChange?: (score: number) => void
  disabled?: boolean
  size?: 'sm' | 'lg'
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? 'star star--on' : 'star'}>
      <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8z" />
    </svg>
  )
}

/** Read-only without onChange; otherwise an accessible radio group. */
export function StarRating({ value, onChange, disabled, size = 'sm' }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0

  if (!onChange) {
    return (
      <span className={`stars stars--${size}`} role="img" aria-label={`Rated ${value ?? 0} out of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} filled={n <= (value ?? 0)} />
        ))}
      </span>
    )
  }

  return (
    <div className="stars-input">
      <div
        className={`stars stars--${size}`}
        role="radiogroup"
        aria-label="Your score"
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} — ${LABELS[n - 1]}`}
            className="star-btn"
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => onChange(n)}
          >
            <Star filled={n <= shown} />
          </button>
        ))}
      </div>
      <span className="stars-label" aria-live="polite">
        {shown ? (
          <>
            <b>{shown}/5</b> {LABELS[shown - 1]}
          </>
        ) : (
          'Pick a score from 1 to 5'
        )}
      </span>
    </div>
  )
}
