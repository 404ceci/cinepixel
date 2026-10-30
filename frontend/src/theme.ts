import { useCallback, useState } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'cinepixel:theme'

/**
 * The initial theme is applied by a small script in index.html before React
 * loads, so the page never flashes light before turning dark. This hook only
 * reads that value and toggles it.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || 'light',
  )

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* storage unavailable */
      }
      return next
    })
  }, [])

  return { theme, toggle }
}
