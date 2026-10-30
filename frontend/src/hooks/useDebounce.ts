import { useEffect, useState } from 'react'

/** Returns `value` only after `delay` ms without changes, so typing doesn't fire a request per keystroke. */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
