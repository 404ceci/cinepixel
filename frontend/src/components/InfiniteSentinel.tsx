import { useEffect, useRef } from 'react'

interface Props {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}

/**
 * Invisible element at the end of the list: when it scrolls into view, the next
 * page loads. The button is the fallback for keyboard and screen-reader users.
 */
export function InfiniteSentinel({ hasMore, loading, onLoadMore }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore || loading) return
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && onLoadMore(),
      { rootMargin: '400px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, onLoadMore])

  if (!hasMore) return <p className="list-end">That's every result.</p>

  return (
    <div ref={ref} className="sentinel">
      <button type="button" className="btn btn--ghost" onClick={onLoadMore} disabled={loading}>
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  )
}
