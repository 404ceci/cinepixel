import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * The open movie lives in the URL (?movie=550). The modal works the same on
 * every page, the link can be shared, and the browser's back button closes it.
 */
export function useMovieModal() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('movie')
  const openId = raw && /^\d+$/.test(raw) ? Number(raw) : null

  const open = useCallback(
    (id: number) =>
      setParams((p) => {
        p.set('movie', String(id))
        return p
      }),
    [setParams],
  )

  const close = useCallback(
    () =>
      setParams((p) => {
        p.delete('movie')
        return p
      }),
    [setParams],
  )

  return { openId, open, close }
}
