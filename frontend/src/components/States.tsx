import type { ReactNode } from 'react'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error && error.message ? error.message : 'Something went wrong.'
  return (
    <div className="state state--error" role="alert">
      <PixelIcon kind="error" />
      <p className="state__title">That didn't load</p>
      <p className="state__text">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <PixelIcon kind="empty" />
      <p className="state__title">{title}</p>
      {children && <div className="state__text">{children}</div>}
    </div>
  )
}

/** Small pixel-art icon drawn with rectangles. */
function PixelIcon({ kind }: { kind: 'error' | 'empty' }) {
  const cells =
    kind === 'error'
      ? ['01110', '10001', '10101', '10001', '01110', '00100', '00100']
      : ['11111', '10001', '10101', '10001', '11111', '01010', '11011']
  return (
    <svg className="pixel-icon" viewBox="0 0 5 7" aria-hidden="true" shapeRendering="crispEdges">
      {cells.flatMap((row, y) =>
        [...row].map((c, x) => (c === '1' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)),
      )}
    </svg>
  )
}
